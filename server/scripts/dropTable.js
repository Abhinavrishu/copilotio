const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

async function dropAll() {
  const connString = process.env.SUPABASE_CONNECTION_STRING;
  if (!connString) {
    console.error('ERROR: No connection string in server/.env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('Connected to Supabase. Removing data and dropping table case_law_chunks...');
  
  await client.query('DROP TABLE IF EXISTS case_law_chunks CASCADE;');
  console.log('✓ Table case_law_chunks dropped successfully from Supabase.');

  const check = await client.query("SELECT to_regclass('public.case_law_chunks') as table_exists;");
  console.log('Verification: Table exists in Supabase:', check.rows[0].table_exists !== null);

  client.release();
  await pool.end();
}

dropAll().catch(console.error);
