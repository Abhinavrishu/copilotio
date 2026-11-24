const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function syncAllChunks() {
  console.log('====================================================');
  console.log(' SYNCING CASE & LAW CHUNKS TO SUPABASE VECTOR DB');
  console.log('====================================================\n');

  const connString = process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL;
  if (!connString) {
    console.error('ERROR: SUPABASE_CONNECTION_STRING is missing in server/.env');
    process.exit(1);
  }

  console.log('Connecting to Supabase PostgreSQL at:');
  console.log(connString.replace(/:([^:@]+)@/, ':****@'));

  const pool = new Pool({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  let client;
  try {
    client = await pool.connect();
    const dbRes = await client.query('SELECT current_database(), version(), NOW()');
    console.log(`Connected to database: ${dbRes.rows[0].current_database}`);
    console.log(`PostgreSQL version: ${dbRes.rows[0].version.split(' ')[0]} ${dbRes.rows[0].version.split(' ')[1]}`);
  } catch (err) {
    console.error('Failed to connect to Supabase PostgreSQL:', err.message);
    process.exit(1);
  }

  // 1. Enable pgvector if available
  let vectorSupported = false;
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    vectorSupported = true;
    console.log('✓ pgvector extension verified / enabled in Supabase');
  } catch (err) {
    console.warn('Note: pgvector extension not enabled or permission restricted:', err.message);
  }

  // 2. Create case_law_chunks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS case_law_chunks (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      type TEXT,
      act TEXT,
      section TEXT,
      source_doc TEXT,
      page_number INT,
      title TEXT,
      content TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_case_law_chunks_case_id ON case_law_chunks(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_law_chunks_type ON case_law_chunks(type);
  `);

  if (vectorSupported) {
    try {
      await client.query('ALTER TABLE case_law_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);');
      console.log('✓ embedding vector(768) column ready');
    } catch (err) {
      vectorSupported = false;
    }
  }

  // 3. Load pre-stored chunks
  const lawCorpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/law_corpus.json'), 'utf8'));
  const casesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/cases.json'), 'utf8'));

  const chunksToSync = [];

  // Add law chunks
  lawCorpus.forEach((law) => {
    chunksToSync.push({
      id: law.id,
      case_id: null,
      type: 'LAW',
      act: law.act,
      section: law.section,
      source_doc: law.act_full,
      page_number: 1,
      title: `${law.act} ${law.section}: ${law.title_en}`,
      content: `${law.act_full} ${law.section}: ${law.title_en} (${law.title_hi || ''}). Summary: ${law.summary} ${law.hindi_summary || ''}. Keywords: ${(law.keywords || []).join(', ')}`,
      metadata: {
        cognizable: law.cognizable,
        bailable: law.bailable,
        max_punishment: law.max_punishment_years,
        old_section: law.old_section,
        keywords: law.keywords || []
      }
    });
  });

  // Add case chunks
  casesData.forEach((c) => {
    (c.chunks || []).forEach((chk) => {
      chunksToSync.push({
        id: chk.chunk_id,
        case_id: c.id,
        type: 'CASE',
        act: null,
        section: null,
        source_doc: chk.source_doc,
        page_number: chk.page_number,
        title: chk.title,
        content: `Case ${c.fir_number} (${c.case_title}) - Page ${chk.page_number} [${chk.source_doc}]: ${chk.text}`,
        metadata: {
          caseId: c.id,
          fir_number: c.fir_number,
          police_station: c.police_station,
          keywords: chk.keywords || []
        }
      });
    });
  });

  console.log(`\nPreparing to store ${chunksToSync.length} chunks (${lawCorpus.length} legal sections + ${chunksToSync.length - lawCorpus.length} case documents)...`);

  // Initialize Gemini for embeddings if available
  let genAI = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log('✓ Google Gemini API initialized for generating vector embeddings');
    } catch (e) {
      console.warn('Gemini embedding setup notice:', e.message);
    }
  }

  let storedCount = 0;
  for (const chk of chunksToSync) {
    let embeddingVal = null;
    if (vectorSupported && genAI) {
      try {
        const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const res = await embedModel.embedContent({
          content: { parts: [{ text: chk.content.slice(0, 2000) }] },
          outputDimensionality: 768
        });
        embeddingVal = res.embedding.values;
      } catch (embErr) {
        console.warn(`Embedding generation error for ${chk.id}:`, embErr.message);
      }
    }

    if (embeddingVal && vectorSupported) {
      const vectorLiteral = `[${embeddingVal.join(',')}]`;
      await client.query(
        `
        INSERT INTO case_law_chunks (id, case_id, type, act, section, source_doc, page_number, title, content, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)
        ON CONFLICT (id) DO UPDATE SET
          case_id = EXCLUDED.case_id,
          type = EXCLUDED.type,
          act = EXCLUDED.act,
          section = EXCLUDED.section,
          source_doc = EXCLUDED.source_doc,
          page_number = EXCLUDED.page_number,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding;
      `,
        [
          chk.id,
          chk.case_id,
          chk.type,
          chk.act,
          chk.section,
          chk.source_doc,
          chk.page_number,
          chk.title,
          chk.content,
          JSON.stringify(chk.metadata),
          vectorLiteral
        ]
      );
    } else {
      await client.query(
        `
        INSERT INTO case_law_chunks (id, case_id, type, act, section, source_doc, page_number, title, content, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          case_id = EXCLUDED.case_id,
          type = EXCLUDED.type,
          act = EXCLUDED.act,
          section = EXCLUDED.section,
          source_doc = EXCLUDED.source_doc,
          page_number = EXCLUDED.page_number,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata;
      `,
        [
          chk.id,
          chk.case_id,
          chk.type,
          chk.act,
          chk.section,
          chk.source_doc,
          chk.page_number,
          chk.title,
          chk.content,
          JSON.stringify(chk.metadata)
        ]
      );
    }

    storedCount++;
    process.stdout.write(`\rStored ${storedCount}/${chunksToSync.length} chunks...`);
  }

  console.log('\n\n✓ All chunks stored successfully in Supabase!');

  // Verify in database
  const countRes = await client.query('SELECT count(*) as total, count(embedding) as with_embeddings FROM case_law_chunks');
  console.log(`\nVerification from Supabase:`);
  console.log(`  Total Chunks in Supabase: ${countRes.rows[0].total}`);
  console.log(`  Chunks with Vector Embeddings: ${countRes.rows[0].with_embeddings}`);

  const sampleRes = await client.query('SELECT id, type, title, created_at FROM case_law_chunks ORDER BY created_at DESC LIMIT 5');
  console.log('\nRecent Stored Records:');
  sampleRes.rows.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.type}] ${r.id}: ${r.title}`);
  });

  client.release();
  await pool.end();
}

syncAllChunks().catch((err) => {
  console.error('\nError during sync:', err);
  process.exit(1);
});
