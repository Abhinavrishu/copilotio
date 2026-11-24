const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function setupSchema() {
  console.log('================================================================');
  console.log(' SETTING UP NEW TWO-BRANCH SUPABASE VECTOR DATABASE STRUCTURE');
  console.log(' Branch 1: legal_documents (Shared, Read-Only)');
  console.log(' Branch 2: cases -> case_files -> case_chunks (Per Case, Written by Officers)');
  console.log('================================================================\n');

  const connString = process.env.SUPABASE_CONNECTION_STRING;
  if (!connString) {
    console.error('ERROR: SUPABASE_CONNECTION_STRING is missing in server/.env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  const client = await pool.connect();
  console.log('Connected to Supabase PostgreSQL.');

  // 1. Drop old tables and clean up
  console.log('Cleaning up existing tables...');
  await client.query(`
    DROP TABLE IF EXISTS case_chunks CASCADE;
    DROP TABLE IF EXISTS case_files CASCADE;
    DROP TABLE IF EXISTS cases CASCADE;
    DROP TABLE IF EXISTS legal_documents CASCADE;
    DROP TABLE IF EXISTS case_law_chunks CASCADE;
  `);
  console.log('✓ Old tables dropped cleanly.');

  // 2. Ensure vector extension
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector extension verified.');
  } catch (e) {
    console.warn('pgvector notice:', e.message);
  }

  // 3. Create Branch 1: legal_documents
  console.log('Creating legal_documents table...');
  await client.query(`
    CREATE TABLE legal_documents (
      id TEXT PRIMARY KEY,
      act TEXT,
      act_full TEXT,
      section TEXT,
      old_section TEXT,
      title_en TEXT,
      title_hi TEXT,
      summary TEXT,
      hindi_summary TEXT,
      content TEXT NOT NULL,
      metadata JSONB,
      embedding vector(768),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_legal_docs_act ON legal_documents(act);
    CREATE INDEX IF NOT EXISTS idx_legal_docs_section ON legal_documents(section);
  `);
  console.log('✓ legal_documents table created.');

  // 4. Create Branch 2: cases -> case_files -> case_chunks
  console.log('Creating cases, case_files, and case_chunks tables...');
  await client.query(`
    CREATE TABLE cases (
      id TEXT PRIMARY KEY,
      fir_number TEXT NOT NULL,
      fir_date TIMESTAMPTZ,
      case_title TEXT NOT NULL,
      case_title_hi TEXT,
      police_station TEXT,
      district TEXT,
      state TEXT DEFAULT 'Uttar Pradesh',
      io_name TEXT,
      io_rank TEXT,
      io_pno TEXT,
      complainant_name TEXT,
      complainant_phone TEXT,
      defrauded_amount NUMERIC,
      recovered_amount NUMERIC,
      sections_invoked JSONB,
      status TEXT DEFAULT 'Under Investigation',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cases_fir ON cases(fir_number);
    CREATE INDEX IF NOT EXISTS idx_cases_station ON cases(police_station);

    CREATE TABLE case_files (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by TEXT,
      total_pages INT DEFAULT 1,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON case_files(case_id);

    CREATE TABLE case_chunks (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      file_id TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
      chunk_index INT DEFAULT 1,
      page_number INT DEFAULT 1,
      title TEXT,
      content TEXT NOT NULL,
      metadata JSONB,
      embedding vector(768),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_case_chunks_case_id ON case_chunks(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_chunks_file_id ON case_chunks(file_id);
  `);
  console.log('✓ cases, case_files, and case_chunks tables created with foreign keys.');

  // 5. Initialize Gemini embedding model
  let genAI = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log('✓ Gemini API initialized for generating 768-dim embeddings');
    } catch (e) {
      console.warn('Gemini init notice:', e.message);
    }
  }

  async function getEmbedding(text) {
    if (!genAI) return null;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const res = await model.embedContent({
        content: { parts: [{ text: text.slice(0, 2000) }] },
        outputDimensionality: 768
      });
      return `[${res.embedding.values.join(',')}]`;
    } catch (err) {
      console.warn('Embedding warning:', err.message);
      return null;
    }
  }

  // 6. Populate Branch 1: legal_documents
  const lawCorpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/law_corpus.json'), 'utf8'));
  console.log(`\nPopulating ${lawCorpus.length} legal documents into 'legal_documents'...`);

  for (let i = 0; i < lawCorpus.length; i++) {
    const l = lawCorpus[i];
    const fullContent = `${l.act_full} ${l.section}: ${l.title_en} (${l.title_hi || ''}). Summary: ${l.summary} ${l.hindi_summary || ''}. Keywords: ${(l.keywords || []).join(', ')}`;
    const embedding = await getEmbedding(fullContent);

    if (embedding) {
      await client.query(
        `INSERT INTO legal_documents (id, act, act_full, section, old_section, title_en, title_hi, summary, hindi_summary, content, metadata, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)`,
        [l.id, l.act, l.act_full, l.section, l.old_section || '', l.title_en, l.title_hi, l.summary, l.hindi_summary, fullContent, JSON.stringify(l), embedding]
      );
    } else {
      await client.query(
        `INSERT INTO legal_documents (id, act, act_full, section, old_section, title_en, title_hi, summary, hindi_summary, content, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [l.id, l.act, l.act_full, l.section, l.old_section || '', l.title_en, l.title_hi, l.summary, l.hindi_summary, fullContent, JSON.stringify(l)]
      );
    }
    process.stdout.write(`\rStored legal_documents: ${i + 1}/${lawCorpus.length}`);
  }
  console.log('\n✓ Branch 1 (legal_documents) populated successfully.');

  // 7. Populate Branch 2: cases -> case_files -> case_chunks
  const casesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/cases.json'), 'utf8'));
  console.log(`\nPopulating ${casesData.length} cases into 'cases', 'case_files', and 'case_chunks'...`);

  let totalFiles = 0;
  let totalChunks = 0;

  for (const c of casesData) {
    // 7.1 Insert case
    await client.query(
      `INSERT INTO cases (id, fir_number, fir_date, case_title, case_title_hi, police_station, district, state, io_name, io_rank, io_pno, complainant_name, complainant_phone, defrauded_amount, recovered_amount, sections_invoked, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        c.id,
        c.fir_number,
        c.fir_date,
        c.case_title,
        c.case_title_hi,
        c.police_station,
        c.district,
        c.state || 'Uttar Pradesh',
        c.io?.name,
        c.io?.rank,
        c.io?.pno,
        c.complainant?.name,
        c.complainant?.phone,
        c.defrauded_amount,
        c.recovered_amount,
        JSON.stringify(c.sections_invoked || []),
        c.status,
        JSON.stringify({
          complainant: c.complainant,
          io: c.io,
          planted_contradiction: c.planted_contradiction,
          contradiction_details: c.contradiction_details,
          linked_identifiers: c.linked_identifiers,
          transactions: c.transactions,
          gaps: c.gaps
        })
      ]
    );

    // Group chunks by source document to create case_files
    const fileMap = new Map();
    (c.chunks || []).forEach((chk, idx) => {
      const fileName = chk.source_doc || `Document_${idx + 1}`;
      if (!fileMap.has(fileName)) {
        let fileType = 'OTHER';
        const fn = fileName.toUpperCase();
        if (fn.includes('FIR')) fileType = 'FIR';
        else if (fn.includes('COMPLAINT') || fn.includes('शिकायत')) fileType = 'COMPLAINT';
        else if (fn.includes('BANK') || fn.includes('RECONCILIATION') || fn.includes('RTGS')) fileType = 'BANK_STATEMENT';
        else if (fn.includes('1930') || fn.includes('CFCFRMS')) fileType = '1930_MEMO';
        else if (fn.includes('ARREST') || fn.includes('SEIZURE')) fileType = 'ARREST_MEMO';

        const fileId = `${c.id}_f_${fileMap.size + 1}`;
        fileMap.set(fileName, { fileId, fileName, fileType, chunks: [] });
      }
      fileMap.get(fileName).chunks.push(chk);
    });

    for (const fileObj of fileMap.values()) {
      // 7.2 Insert case_file
      await client.query(
        `INSERT INTO case_files (id, case_id, file_name, file_type, uploaded_by, total_pages, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          fileObj.fileId,
          c.id,
          fileObj.fileName,
          fileObj.fileType,
          c.io?.name || 'Investigating Officer',
          fileObj.chunks.length,
          JSON.stringify({ source_doc: fileObj.fileName })
        ]
      );
      totalFiles++;

      // 7.3 Insert case_chunks
      for (let chkIdx = 0; chkIdx < fileObj.chunks.length; chkIdx++) {
        const chk = fileObj.chunks[chkIdx];
        const chunkText = `Case ${c.fir_number} (${c.case_title}) - Page ${chk.page_number} [${chk.source_doc}]: ${chk.text}`;
        const embedding = await getEmbedding(chunkText);

        if (embedding) {
          await client.query(
            `INSERT INTO case_chunks (id, case_id, file_id, chunk_index, page_number, title, content, metadata, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
            [
              chk.chunk_id,
              c.id,
              fileObj.fileId,
              chkIdx + 1,
              chk.page_number || 1,
              chk.title,
              chunkText,
              JSON.stringify(chk),
              embedding
            ]
          );
        } else {
          await client.query(
            `INSERT INTO case_chunks (id, case_id, file_id, chunk_index, page_number, title, content, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              chk.chunk_id,
              c.id,
              fileObj.fileId,
              chkIdx + 1,
              chk.page_number || 1,
              chk.title,
              chunkText,
              JSON.stringify(chk)
            ]
          );
        }
        totalChunks++;
        process.stdout.write(`\rStored case_chunks: ${totalChunks}`);
      }
    }
  }

  console.log(`\n✓ Branch 2 populated: ${casesData.length} cases, ${totalFiles} case_files, ${totalChunks} case_chunks.`);

  // 8. Verification Queries
  console.log('\n================================================================');
  console.log(' SUPABASE SCHEMA VERIFICATION REPORT');
  console.log('================================================================');
  const countLegal = await client.query('SELECT count(*) as total, count(embedding) as with_embed FROM legal_documents');
  const countCases = await client.query('SELECT count(*) as total FROM cases');
  const countFiles = await client.query('SELECT count(*) as total FROM case_files');
  const countChunks = await client.query('SELECT count(*) as total, count(embedding) as with_embed FROM case_chunks');

  console.log(`1. legal_documents: ${countLegal.rows[0].total} rows (${countLegal.rows[0].with_embed} with 768-dim embeddings)`);
  console.log(`2. cases:           ${countCases.rows[0].total} rows`);
  console.log(`3. case_files:      ${countFiles.rows[0].total} rows`);
  console.log(`4. case_chunks:     ${countChunks.rows[0].total} rows (${countChunks.rows[0].with_embed} with 768-dim embeddings)`);

  client.release();
  await pool.end();
  console.log('\nSchema setup and data seeding completed successfully!');
}

setupSchema().catch((err) => {
  console.error('Fatal schema setup error:', err);
  process.exit(1);
});
