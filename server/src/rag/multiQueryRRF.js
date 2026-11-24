const vectorStore = require('./vectorStore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class MultiQueryRRF {
  constructor() {
    this.k = 60; // standard RRF constant
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (this.geminiApiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      } catch (err) {
        console.warn('Gemini client initialization notice:', err.message);
      }
    }
  }

  async generateMultiQueries(originalQuery, count = 4) {
    // 1. Try Gemini API first if API key is provided
    if (this.geminiApiKey) {
      try {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `You are an AI assistant for Uttar Pradesh Police Investigating Officers. 
Given the following user query about a criminal case or Indian criminal law (BNS 2023, BNSS 2023, BSA 2023, IT Act), generate ${count} different search queries to retrieve relevant law sections, case facts, evidence, and procedures.
Ensure variations include:
1. Formal legal terminology under BNS / BNSS / BSA (and old IPC / CrPC mappings).
2. Factual and evidentiary aspects (bank account, UTR, transactions, CDR, digital evidence).
3. Hindi translation / Hindi key phrases for police terminology.
4. Procedural steps (notices, freezing, victim update, default bail clock).

Original Query: "${originalQuery}"

Output ONLY a JSON array of strings, e.g. ["query1", "query2", "query3", "query4"]. No markdown formatting or extra text.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = [originalQuery, ...parsed.filter((q) => q !== originalQuery)].slice(0, count);
          return list;
        }
      } catch (err) {
        console.warn('Gemini MultiQuery API fallback triggered:', err.message);
      }
    }

    // 2. Deterministic Police & Law Query Expansion Engine (Fast, robust, offline-capable)
    return this.ruleBasedMultiQuery(originalQuery);
  }

  ruleBasedMultiQuery(query) {
    const qLower = query.toLowerCase();
    const queries = [query];

    // Cheating / Fraud
    if (qLower.includes('धोखा') || qLower.includes('fraud') || qLower.includes('cheat') || qLower.includes('420') || qLower.includes('318')) {
      queries.push('BNS Section 318(4) cheating dishonestly inducing property IPC 420');
      queries.push('धोखाधड़ी और बेईमानी से संपत्ति प्राप्त करना धारा 318(4) बीएनएस 2023');
      queries.push('bank transfer UTR transaction mule account freeze Section 107 BNSS');
    }

    // Freezing / Bank accounts
    if (qLower.includes('freeze') || qLower.includes('फ्रीज') || qLower.includes('bank') || qLower.includes('खाता') || qLower.includes('107') || qLower.includes('94')) {
      queries.push('BNSS Section 107 attachment freezing order bank account debit freeze');
      queries.push('BNSS Section 94 summons to produce bank statement KYC notice');
      queries.push('खाता डेबिट फ्रीज प्रक्रिया 1930 सीपीसीआरएमएस धारा 107 बीएनएसएस');
    }

    // Bail clock / Deadlines
    if (qLower.includes('bail') || qLower.includes('जमानत') || qLower.includes('deadline') || qLower.includes('187') || qLower.includes('60') || qLower.includes('90') || qLower.includes('घड़ी')) {
      queries.push('BNSS Section 187 default bail clock 60 days 90 days police custody');
      queries.push('डिफ़ॉल्ट जमानत धारा 187 बीएनएसएस 60 दिन 90 दिन रिमांड');
      queries.push('BNSS Section 193(3)(ii) mandatory 90 day progress report to victim');
    }

    // Digital evidence / Certificate
    if (qLower.includes('evidence') || qLower.includes('साक्ष्य') || qLower.includes('certificate') || qLower.includes('63') || qLower.includes('65b') || qLower.includes('chat') || qLower.includes('screenshot')) {
      queries.push('BSA 2023 Section 63 electronic evidence mandatory certificate Section 65B');
      queries.push('इलेक्ट्रॉनिक साक्ष्य ग्राह्यता धारा 63 भारतीय साक्ष्य अधिनियम 2023');
      queries.push('digital WhatsApp chat telegram printout certification IO duty');
    }

    // Telecom / CDR / Mobile
    if (qLower.includes('cdr') || qLower.includes('phone') || qLower.includes('mobile') || qLower.includes('फोन') || qLower.includes('नंबर') || qLower.includes('106')) {
      queries.push('BNSS Section 106 notice to telecom provider CDR CAF IPDR');
      queries.push('टेलीकॉम नोडल अधिकारी नोटिस धारा 106 बीएनएसएस सीडीआर टॉवर लोकेशन');
      queries.push('suspect phone IMEI cross case linkage');
    }

    // Contradictions / Gaps
    if (qLower.includes('gap') || qLower.includes('कमी') || qLower.includes('contradiction') || qLower.includes('clash') || qLower.includes('विरोध')) {
      queries.push('investigation gaps missing evidence Section 63 BSA bank KYC');
      queries.push('date mismatch amount contradiction complainant statement vs bank statement');
    }

    // Default general variations if few matched
    if (queries.length < 4) {
      queries.push(`${query} legal provisions under BNS 2023 BNSS 2023 BSA 2023`);
      queries.push(`${query} case facts and evidentiary documents`);
      queries.push(`${query} पुलिस विवेचना प्रक्रिया उत्तर प्रदेश`);
    }

    return Array.from(new Set(queries)).slice(0, 4);
  }

  /**
   * Reciprocal Rank Fusion (RRF) algorithm:
   * RRF_Score(d) = SUM_{q in Q} [ 1 / (k + rank(d, q)) ]
   * Default k = 60
   */
  reciprocalRankFusion(queryRankings, k = 60) {
    const scores = new Map();
    const docMap = new Map();
    const queryContributions = new Map();

    queryRankings.forEach(({ query, results }) => {
      results.forEach((doc, rankIndex) => {
        const rank = rankIndex + 1; // 1-indexed
        const rrfContribution = 1 / (k + rank);

        const currentScore = scores.get(doc.id) || 0;
        scores.set(doc.id, currentScore + rrfContribution);

        if (!docMap.has(doc.id)) {
          docMap.set(doc.id, doc);
          queryContributions.set(doc.id, []);
        }

        queryContributions.get(doc.id).push({
          query,
          rank,
          contribution: parseFloat(rrfContribution.toFixed(5))
        });
      });
    });

    // Sort documents by combined RRF score descending
    const fusedResults = Array.from(scores.entries())
      .map(([id, rrfScore]) => ({
        ...docMap.get(id),
        rrfScore: parseFloat(rrfScore.toFixed(5)),
        queryMatches: queryContributions.get(id) || [],
        matchCount: (queryContributions.get(id) || []).length
      }))
      .sort((a, b) => b.rrfScore - a.rrfScore);

    return fusedResults;
  }

  /**
   * Complete Multi-Query RAG Search with RRF
   */
  async searchWithMultiQueryRRF(query, options = {}) {
    const { caseId, filterType, topK = 8 } = options;

    // 1. Generate multi-queries
    const queries = await this.generateMultiQueries(query, 4);

    // 2. Perform retrieval for each generated query (using Supabase if configured, with local fallback)
    const queryRankings = await Promise.all(
      queries.map(async (subQuery) => {
        const results = await vectorStore.searchAsync(subQuery, { caseId, filterType, topK: 12 });
        return {
          query: subQuery,
          results
        };
      })
    );

    // 3. Apply Reciprocal Rank Fusion
    const fusedResults = this.reciprocalRankFusion(queryRankings, this.k);

    return {
      originalQuery: query,
      generatedQueries: queries,
      totalCandidatesConsidered: fusedResults.length,
      topResults: fusedResults.slice(0, topK)
    };
  }
}

module.exports = new MultiQueryRRF();
