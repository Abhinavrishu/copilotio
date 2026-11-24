const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testSearch() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

  const queryText = 'धोखाधड़ी में बैंक खाता फ्रीज करने की प्रक्रिया';
  console.log(`Querying Supabase Vector DB: "${queryText}"`);

  const embedRes = await model.embedContent({
    content: { parts: [{ text: queryText }] },
    outputDimensionality: 768
  });
  const vec = `[${embedRes.embedding.values.join(',')}]`;

  const client = await pool.connect();
  const res = await client.query(
    `SELECT id, type, title, (1 - (embedding <=> $1)) as similarity
     FROM case_law_chunks 
     WHERE embedding IS NOT NULL 
     ORDER BY embedding <=> $1 
     LIMIT 5`,
    [vec]
  );

  console.log('\nTop 5 Semantic Vector Matches from Supabase pgvector:');
  res.rows.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.type}] ${r.id} (${(r.similarity * 100).toFixed(1)}% match): ${r.title}`);
  });

  client.release();
  await pool.end();
}

testSearch().catch(console.error);
