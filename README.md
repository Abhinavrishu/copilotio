# Investigation Copilot — UP AI Samadhan Hackathon

> **An AI assistant that helps every Investigating Officer run a lawful, timely investigation, while the officer stays in charge of every decision.**
> *(Problem Statement: UP AI Mission, Department of IT & Electronics, Govt. of Uttar Pradesh)*

---

## 🏛️ System Overview & Architecture

Built specifically for **Investigating Officers (IOs)** of Uttar Pradesh Police and supervised by **SHOs, Circle Officers (COs), and SPs**, this system addresses the acute paperwork bottleneck (~14,000 cybercrime cases in UP in 2025, mostly financial fraud) and strict procedural duties under India's new criminal codes:
- **BNS 2023** (*Bharatiya Nyaya Sanhita*)
- **BNSS 2023** (*Bharatiya Nagarik Suraksha Sanhita*)
- **BSA 2023** (*Bharatiya Sakshya Adhiniyam*)
- **IT Act 2000** & **UP Police Cyber Financial SOPs (1930 / CFCFRMS)**

---

## 🌟 The 10 Core Problem Statement Use Cases (Slide 4)

1. **UC-1: Read the Case**: Extracts key entities from Hindi & English complaints, FIRs, bank statements, and handwritten papers.
2. **UC-2: Step-by-Step Investigation Plan**: Law-grounded procedure where each step cites the exact statutory section.
3. **UC-3: Spot Gaps as the Case Moves**: Automated audit for missing evidence (*Section 63 BSA certificate*, *CDR*, *Bank KYC*, *CCTV logs*).
4. **UC-4: Law Q&A in Hindi, by Text or Voice**: Multi-Query RAG powered by Google Gemini API and LangChain.
5. **UC-5: Draft Notices**: Statutory notices under *Section 94, 106, 107 BNSS* to banks, telecom nodal officers, and payment gateways.
6. **UC-6: Case Diary & Timeline Draft**: Chronological *Parcha* (case diary) generation with tamper-evident record keeping.
7. **UC-7: Deadline Tracker**:
   - **60/90 Day Default Bail Clock** under **Section 187 BNSS** (miss it and accused walks free).
   - **90-Day Mandatory Victim Update** under **Section 193(3)(ii) BNSS**.
8. **UC-8: Money Trail & Freeze Priority**: Layer 1, Layer 2, Layer 3 mule account tracking with CFCFRMS / 1930 portal integration.
9. **UC-9: Link Related Cases**: Cross-case linkage identifying interstate syndicates sharing suspect phones, UPIs, accounts, or IMEIs.
10. **UC-10: Supervisor View**: Real-time dashboard for SHO, CO, and SP to monitor impending default bail deadlines, overdue victim reports, and weak cases.
* **Extra: Contradiction Check**: Catches planted date mismatches, amount variance, and account clashes before a defence lawyer does.

---

## 🛠️ The MCP Server: "The Only Door the AI Can Use" (Slide 8)

The Model Context Protocol (MCP) server exposes 8 typed tools with strict guardrails:
1. `search_case`: RAG search over case documents using Multi-Query and Reciprocal Rank Fusion (RRF).
2. `get_law`: Verified statutory lookup (cited only).
3. `compute_deadlines`: Computes Section 187 BNSS bail clock & Section 193 victim report deadlines.
4. `trace_money`: Multi-layer mule account tracing and freeze prioritization under Section 107 BNSS.
5. `find_gaps`: Evidentiary checklist verification.
6. `list_links`: Cross-FIR syndicate matching.
7. `draft_notice`: Formal Section 94/107 BNSS notice formatting.
8. `check_citations`: Citation verifier validating all legal sections against the authoritative law corpus.

### Guardrails on Every MCP Call:
- **Role and case access checked each time** (IO, SHO, CO, SP, Admin).
- **Every call written to the tamper-evident SHA-256 audit chain**.
- **No tool can send, approve or delete** — Officer in charge approval gate.
- **Complaint text is treated as data, never instructions** (prompt injection defense).

---

## 🔬 Multi-Query RAG & Reciprocal Rank Fusion (RRF)

When an officer asks a question in Hindi or English:
1. **Multi-Query Generator**: Uses Google Gemini API (or rule-based legal engine) to generate 4 distinct search perspectives:
   - Statutory provisions (BNS / BNSS / BSA / IPC mapping)
   - Evidentiary & transaction facts (UTR, accounts, CDR)
   - Hindi colloquial & legal terms
   - Procedural next steps
2. **Reciprocal Rank Fusion (RRF)**:
   $$RRF(d) = \sum_{q \in Q} \frac{1}{60 + \text{rank}(d, q)}$$
   Fuses and ranks candidate chunks across both the verified legal corpus and pre-stored case chunks.
3. **Citation Verifier**: Validates every cited statute and page reference before output.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **npm** (v9+)

### 2. Run Backend Automated Test Suite (33 Tests)
```bash
npm test
```
All 33 tests validate:
- 6 synthetic cases
- BNS/BNSS/BSA law corpus & IPC mapping
- Multi-query generation and RRF ranking
- All 8 MCP typed tools
- Default bail clock calculations (60 vs 90 days)
- Money trail layering
- Planted date mismatch detection
- Tamper-evident cryptographic audit chain integrity

### 3. Start Server & Client
In terminal 1 (Server):
```bash
npm run server
```
*Server runs on `http://localhost:5000`*

In terminal 2 (Client):
```bash
npm run client
```
*Client runs on `http://localhost:5173`*

---

## 🗄️ Two-Branch Supabase Vector Database Architecture

The system implements the required dual-branch data architecture:

```
Existing (shared, read-only)          New (per case, written by officers)
┌────────────────────────┐            ┌──────────────────────────────┐
│ legal_documents        │            │ cases                        │
│ (IPC, BNS, BSA, CSI..) │            │   └─ case_files (FIR, etc.)  │
└───────────┬────────────┘            │        └─ case_chunks        │
            │                         └──────────────┬───────────────┘
            └────────────┬───────────────────────────┘
                         ▼
              Chat: search both → merge → LLM
```

### Table Schemas:

#### Branch 1: `legal_documents` (Shared, Read-Only)
```sql
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
```

#### Branch 2: `cases` -> `case_files` -> `case_chunks` (Per Case, Written by Officers)
```sql
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  fir_number TEXT NOT NULL,
  fir_date TIMESTAMPTZ,
  case_title TEXT NOT NULL,
  police_station TEXT,
  district TEXT,
  io_name TEXT,
  io_rank TEXT,
  complainant_name TEXT,
  defrauded_amount NUMERIC,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE case_files (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,           -- 'FIR', 'COMPLAINT', 'BANK_STATEMENT', '1930_MEMO', 'ARREST_MEMO'
  uploaded_by TEXT,
  total_pages INT DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

### Search Both & Merge:
- When a query is initiated, the system simultaneously searches:
  1. `legal_documents` for statutory provisions (BNS, BNSS, BSA, IT Act, UP SOPs)
  2. `case_chunks` (filtered by the case) for factual evidence written by officers
- The cosine similarity results from both branches are merged, rank-ordered, and passed directly into the Gemini LLM prompt.

---

## 🧪 Tech Stack
- **Vector Database**: Supabase PostgreSQL / pgvector (via connection string URI)
- **AI / LLM**: Google Gemini API (`gemini-1.5-flash`), `@langchain/google-genai`, `@google/generative-ai`
- **Backend**: Node.js, Express, LangChain Core, `pg`, Cryptographic SHA-256 Chaining
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Data Corpus**: Pre-chunked BNS 2023, BNSS 2023, BSA 2023, IT Act, UP Police Cyber SOPs, 6 Synthetic Test Cases
