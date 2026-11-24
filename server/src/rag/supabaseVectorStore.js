const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Two-Branch Architecture for Investigation Copilot:
 *
 * Existing (shared, read-only)          New (per case, written by officers)
 * ┌────────────────────────┐            ┌──────────────────────────────┐
 * │ legal_documents        │            │ cases                        │
 * │ (IPC, BNS, BSA, CSI..) │            │   └─ case_files (FIR, etc.)  │
 * └───────────┬────────────┘            │        └─ case_chunks        │
 *             │                         └──────────────┬───────────────┘
 *             └────────────┬───────────────────────────┘
 *                          ▼
 *               Chat: search both → merge → LLM
 */
class SupabaseVectorStore {
  constructor() {
    this.pool = null;
    this.connectionString =
      process.env.SUPABASE_CONNECTION_STRING ||
      process.env.SUPABASE_DB_URL ||
      process.env.DATABASE_URL ||
      '';
    this.isReady = false;
    this.lastError = null;
    this.genAI = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      } catch (e) {
        console.warn('Gemini embedding init notice:', e.message);
      }
    }

    if (this.connectionString) {
      this.initPool();
    }
  }

  initPool(customConnectionString = null) {
    if (customConnectionString) {
      this.connectionString = customConnectionString;
    }

    if (!this.connectionString) {
      return false;
    }

    try {
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000
      });

      this.pool.on('error', (err) => {
        console.warn('Supabase Pool error:', err.message);
        this.isReady = false;
        this.lastError = err.message;
      });

      return true;
    } catch (err) {
      this.lastError = err.message;
      this.isReady = false;
      return false;
    }
  }

  async checkConnection() {
    if (!this.connectionString) {
      return {
        connected: false,
        reason: 'SUPABASE_CONNECTION_STRING is not set in environment or configuration.'
      };
    }

    if (!this.pool) {
      this.initPool();
    }

    try {
      const client = await this.pool.connect();
      const res = await client.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
      
      // Also check tables in the two-branch architecture
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('legal_documents', 'cases', 'case_files', 'case_chunks');
      `);
      client.release();

      this.isReady = true;
      this.lastError = null;

      return {
        connected: true,
        database: res.rows[0].db_name,
        time: res.rows[0].current_time,
        version: res.rows[0].pg_version,
        activeTables: tableCheck.rows.map((r) => r.table_name)
      };
    } catch (err) {
      this.isReady = false;
      this.lastError = err.message;
      return {
        connected: false,
        error: err.message
      };
    }
  }

  async generateEmbedding(text) {
    if (this.genAI && process.env.GEMINI_API_KEY) {
      try {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent({
          content: { parts: [{ text: text.slice(0, 2000) }] },
          outputDimensionality: 768
        });
        return result.embedding.values;
      } catch (err) {
        console.warn('Gemini embedding generation notice:', err.message);
      }
    }
    return null;
  }

  /**
   * Search Branch 1: legal_documents (Shared, read-only)
   */
  async searchLegalDocuments(query, queryEmbedding, topK = 6) {
    const client = await this.pool.connect();
    try {
      if (queryEmbedding) {
        const vecLiteral = `[${queryEmbedding.join(',')}]`;
        const res = await client.query(
          `SELECT 
             id, 'LAW' as type, act, section, title_en as title, content, metadata,
             (1 - (embedding <=> $1)) as relevance_score
           FROM legal_documents
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1 ASC
           LIMIT $2`,
          [vecLiteral, topK]
        );
        return res.rows.map((r, idx) => ({
          ...r,
          source_branch: 'legal_documents (shared)',
          relevanceScore: parseFloat(r.relevance_score || 0.5),
          rank: idx + 1
        }));
      } else {
        const res = await client.query(
          `SELECT 
             id, 'LAW' as type, act, section, title_en as title, content, metadata, 0.7 as relevance_score
           FROM legal_documents
           WHERE LOWER(content) LIKE LOWER($1) OR LOWER(title_en) LIKE LOWER($1)
           LIMIT $2`,
          [`%${query}%`, topK]
        );
        return res.rows.map((r, idx) => ({
          ...r,
          source_branch: 'legal_documents (shared)',
          relevanceScore: 0.7,
          rank: idx + 1
        }));
      }
    } finally {
      client.release();
    }
  }

  /**
   * Search Branch 2: case_chunks (Per case, written by officers)
   * Joins with case_files to provide file context (FIR, statements, etc.)
   */
  async searchCaseChunks(query, queryEmbedding, caseId = null, topK = 6) {
    const client = await this.pool.connect();
    try {
      if (queryEmbedding) {
        const vecLiteral = `[${queryEmbedding.join(',')}]`;
        let sql = `
          SELECT 
            c.id, 'CASE' as type, c.case_id as "caseId", c.file_id as "fileId",
            f.file_name as source_doc, f.file_type, c.page_number, c.title, c.content, c.metadata,
            (1 - (c.embedding <=> $1)) as relevance_score
          FROM case_chunks c
          JOIN case_files f ON c.file_id = f.id
          WHERE c.embedding IS NOT NULL
        `;
        const params = [vecLiteral];
        let paramIdx = 2;

        if (caseId) {
          sql += ` AND c.case_id = $${paramIdx}`;
          params.push(caseId);
          paramIdx++;
        }

        sql += ` ORDER BY c.embedding <=> $1 ASC LIMIT $${paramIdx}`;
        params.push(topK);

        const res = await client.query(sql, params);
        return res.rows.map((r, idx) => ({
          ...r,
          source_branch: 'cases -> case_files -> case_chunks (officer data)',
          relevanceScore: parseFloat(r.relevance_score || 0.5),
          rank: idx + 1
        }));
      } else {
        let sql = `
          SELECT 
            c.id, 'CASE' as type, c.case_id as "caseId", c.file_id as "fileId",
            f.file_name as source_doc, f.file_type, c.page_number, c.title, c.content, c.metadata, 0.7 as relevance_score
          FROM case_chunks c
          JOIN case_files f ON c.file_id = f.id
          WHERE (LOWER(c.content) LIKE LOWER($1) OR LOWER(c.title) LIKE LOWER($1))
        `;
        const params = [`%${query}%`];
        let paramIdx = 2;

        if (caseId) {
          sql += ` AND c.case_id = $${paramIdx}`;
          params.push(caseId);
          paramIdx++;
        }

        sql += ` LIMIT $${paramIdx}`;
        params.push(topK);

        const res = await client.query(sql, params);
        return res.rows.map((r, idx) => ({
          ...r,
          source_branch: 'cases -> case_files -> case_chunks (officer data)',
          relevanceScore: 0.7,
          rank: idx + 1
        }));
      }
    } finally {
      client.release();
    }
  }

  /**
   * Search Both Branches → Merge Results → Ready for LLM
   */
  async search(query, options = {}) {
    const connCheck = await this.checkConnection();
    if (!connCheck.connected) {
      return null; // Fallback to memory store
    }

    const { caseId, filterType, topK = 10 } = options;

    try {
      const queryEmbedding = await this.generateEmbedding(query);

      let legalHits = [];
      let caseHits = [];

      // 1. Search Branch 1 (legal_documents) unless filterType is strictly 'CASE'
      if (filterType !== 'CASE') {
        legalHits = await this.searchLegalDocuments(query, queryEmbedding, topK);
      }

      // 2. Search Branch 2 (cases -> case_files -> case_chunks) unless filterType is strictly 'LAW'
      if (filterType !== 'LAW') {
        caseHits = await this.searchCaseChunks(query, queryEmbedding, caseId, topK);
      }

      // 3. Merge both result streams
      const merged = [...caseHits, ...legalHits].sort(
        (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
      );

      return merged.slice(0, topK).map((r, idx) => ({
        id: r.id,
        caseId: r.caseId || null,
        type: r.type,
        act: r.act || null,
        section: r.section || null,
        source_doc: r.source_doc || `${r.act || ''} ${r.section || ''}`.trim(),
        page_number: r.page_number || 1,
        title: r.title,
        content: r.content,
        metadata: r.metadata || {},
        source_branch: r.source_branch,
        relevanceScore: r.relevanceScore,
        rank: idx + 1,
        engine: 'supabase_two_branch_architecture'
      }));
    } catch (err) {
      console.warn('Supabase two-branch search error, falling back to local memory store:', err.message);
      return null;
    }
  }

  /**
   * Officer Writing Methods (Branch 2: New Data written by officers)
   */
  async addCase(caseData) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO cases (id, fir_number, fir_date, case_title, case_title_hi, police_station, district, io_name, io_rank, complainant_name, defrauded_amount, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           case_title = EXCLUDED.case_title,
           status = EXCLUDED.status,
           metadata = EXCLUDED.metadata;`,
        [
          caseData.id,
          caseData.fir_number,
          caseData.fir_date || new Date().toISOString(),
          caseData.case_title,
          caseData.case_title_hi || '',
          caseData.police_station,
          caseData.district,
          caseData.io_name,
          caseData.io_rank,
          caseData.complainant_name,
          caseData.defrauded_amount || 0,
          caseData.status || 'Under Investigation',
          JSON.stringify(caseData.metadata || {})
        ]
      );
      return { success: true, caseId: caseData.id };
    } finally {
      client.release();
    }
  }

  async addCaseFile(caseId, fileData) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO case_files (id, case_id, file_name, file_type, uploaded_by, total_pages, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           file_name = EXCLUDED.file_name,
           total_pages = EXCLUDED.total_pages;`,
        [
          fileData.id,
          caseId,
          fileData.file_name,
          fileData.file_type || 'OTHER',
          fileData.uploaded_by || 'Investigating Officer',
          fileData.total_pages || 1,
          JSON.stringify(fileData.metadata || {})
        ]
      );
      return { success: true, fileId: fileData.id };
    } finally {
      client.release();
    }
  }

  async addCaseChunk(caseId, fileId, chunkData) {
    const client = await this.pool.connect();
    try {
      const embedding = await this.generateEmbedding(chunkData.content);
      if (embedding) {
        const vecLiteral = `[${embedding.join(',')}]`;
        await client.query(
          `INSERT INTO case_chunks (id, case_id, file_id, chunk_index, page_number, title, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             embedding = EXCLUDED.embedding;`,
          [
            chunkData.id,
            caseId,
            fileId,
            chunkData.chunk_index || 1,
            chunkData.page_number || 1,
            chunkData.title,
            chunkData.content,
            JSON.stringify(chunkData.metadata || {}),
            vecLiteral
          ]
        );
      } else {
        await client.query(
          `INSERT INTO case_chunks (id, case_id, file_id, chunk_index, page_number, title, content, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             content = EXCLUDED.content;`,
          [
            chunkData.id,
            caseId,
            fileId,
            chunkData.chunk_index || 1,
            chunkData.page_number || 1,
            chunkData.title,
            chunkData.content,
            JSON.stringify(chunkData.metadata || {})
          ]
        );
      }
      return { success: true, chunkId: chunkData.id };
    } finally {
      client.release();
    }
  }

  /**
   * Get Two-Branch Schema Statistics
   */
  async getStats() {
    const client = await this.pool.connect();
    try {
      const q1 = await client.query('SELECT count(*) as total, count(embedding) as with_embed FROM legal_documents');
      const q2 = await client.query('SELECT count(*) as total FROM cases');
      const q3 = await client.query('SELECT count(*) as total FROM case_files');
      const q4 = await client.query('SELECT count(*) as total, count(embedding) as with_embed FROM case_chunks');

      return {
        success: true,
        legal_documents: {
          totalRows: parseInt(q1.rows[0].total, 10),
          withEmbeddings: parseInt(q1.rows[0].with_embed, 10),
          description: 'Branch 1: Existing legal corpus (IPC, BNS, BSA, CSI/rules) [Shared, Read-Only]'
        },
        cases: {
          totalRows: parseInt(q2.rows[0].total, 10),
          description: 'Branch 2: Investigated Cases [Written by Officers]'
        },
        case_files: {
          totalRows: parseInt(q3.rows[0].total, 10),
          description: 'Branch 2: Case Files (FIR, statements, bank receipts, memos)'
        },
        case_chunks: {
          totalRows: parseInt(q4.rows[0].total, 10),
          withEmbeddings: parseInt(q4.rows[0].with_embed, 10),
          description: 'Branch 2: Case Chunks with vector embeddings'
        }
      };
    } finally {
      client.release();
    }
  }
}

module.exports = new SupabaseVectorStore();
