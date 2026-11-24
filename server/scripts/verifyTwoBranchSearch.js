const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabaseVectorStore = require('../src/rag/supabaseVectorStore');

async function verifyTwoBranch() {
  console.log('Testing Two-Branch Search on query: "धोखाधड़ी में बैंक खाता फ्रीज" for case_001...\n');

  const stats = await supabaseVectorStore.getStats();
  console.log('Database Stats:');
  console.log('  1. legal_documents:', stats.legal_documents.totalRows, 'rows');
  console.log('  2. cases:', stats.cases.totalRows, 'rows');
  console.log('  3. case_files:', stats.case_files.totalRows, 'rows');
  console.log('  4. case_chunks:', stats.case_chunks.totalRows, 'rows\n');

  const results = await supabaseVectorStore.search('धोखाधड़ी में बैंक खाता फ्रीज', {
    caseId: 'case_001',
    topK: 6
  });

  console.log(`Retrieved ${results.length} merged results from both branches:`);
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.type}] from ${r.source_branch}`);
    console.log(`     Title: ${r.title}`);
    console.log(`     Similarity Score: ${(r.relevanceScore * 100).toFixed(1)}%`);
  });
}

verifyTwoBranch().catch(console.error);
