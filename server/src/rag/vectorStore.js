const fs = require('fs');
const path = require('path');
const supabaseVectorStore = require('./supabaseVectorStore');

class VectorStore {
  constructor() {
    this.chunks = [];
    this.lawChunks = [];
    this.caseChunks = [];
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    try {
      const lawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/law_corpus.json'), 'utf8'));
      this.lawChunks = lawData.map((item) => ({
        id: item.id,
        type: 'LAW',
        act: item.act,
        act_full: item.act_full,
        section: item.section,
        old_section: item.old_section || '',
        title: `${item.act} ${item.section}: ${item.title_en} (${item.title_hi})`,
        content: `${item.act_full} ${item.section}: ${item.title_en} (${item.title_hi}). Summary: ${item.summary} ${item.hindi_summary || ''} Keywords: ${(item.keywords || []).join(', ')}`,
        metadata: {
          cognizable: item.cognizable,
          bailable: item.bailable,
          max_punishment: item.max_punishment_years,
          keywords: item.keywords || []
        }
      }));

      const caseData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cases.json'), 'utf8'));
      this.caseChunks = [];
      caseData.forEach((c) => {
        (c.chunks || []).forEach((chk) => {
          this.caseChunks.push({
            id: chk.chunk_id,
            caseId: c.id,
            fir_number: c.fir_number,
            type: 'CASE',
            source_doc: chk.source_doc,
            page_number: chk.page_number,
            title: chk.title,
            content: `Case ${c.fir_number} (${c.case_title}) - Page ${chk.page_number} [${chk.source_doc}]: ${chk.text}`,
            metadata: {
              caseId: c.id,
              fir_number: c.fir_number,
              keywords: chk.keywords || []
            }
          });
        });
      });

      this.chunks = [...this.lawChunks, ...this.caseChunks];
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize VectorStore:', err);
    }
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  computeScore(query, chunk) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return 0;

    const chunkTokens = this.tokenize(chunk.content + ' ' + (chunk.title || ''));
    const chunkTokenSet = new Set(chunkTokens);

    let matchCount = 0;
    let weightBonus = 0;

    for (const q of queryTokens) {
      if (chunkTokenSet.has(q)) {
        matchCount++;
      } else {
        for (const ct of chunkTokenSet) {
          if (ct.includes(q) || q.includes(ct)) {
            matchCount += 0.5;
            break;
          }
        }
      }

      if (chunk.metadata && chunk.metadata.keywords) {
        if (chunk.metadata.keywords.some((k) => k.toLowerCase().includes(q))) {
          weightBonus += 1.5;
        }
      }
    }

    const jaccard = matchCount / (queryTokens.length + chunkTokenSet.size - matchCount || 1);
    const score = (matchCount / queryTokens.length) * 0.7 + jaccard * 0.3 + (weightBonus * 0.1);
    return score;
  }

  async searchAsync(query, options = {}) {
    this.initialize();

    // 1. If Supabase connection is available, attempt remote Supabase query
    if (supabaseVectorStore.connectionString) {
      try {
        const supabaseResults = await supabaseVectorStore.search(query, options);
        if (supabaseResults && supabaseResults.length > 0) {
          return supabaseResults;
        }
      } catch (e) {
        console.warn('Supabase search fallback:', e.message);
      }
    }

    // 2. Local vectorized ranking fallback (Deterministic, offline-safe)
    return this.search(query, options);
  }

  search(query, options = {}) {
    this.initialize();
    const { caseId, filterType, topK = 10 } = options;

    let candidateChunks = this.chunks;
    if (caseId) {
      candidateChunks = candidateChunks.filter(
        (c) => c.type === 'LAW' || (c.type === 'CASE' && c.caseId === caseId)
      );
    }
    if (filterType) {
      candidateChunks = candidateChunks.filter((c) => c.type === filterType);
    }

    const scored = candidateChunks.map((chunk) => {
      const score = this.computeScore(query, chunk);
      return { chunk, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item, index) => ({
        ...item.chunk,
        relevanceScore: parseFloat(item.score.toFixed(4)),
        rank: index + 1
      }));
  }

  async syncToSupabase() {
    this.initialize();
    return await supabaseVectorStore.syncChunks(this.chunks);
  }
}

module.exports = new VectorStore();
