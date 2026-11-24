import React, { useState, useEffect } from 'react';
import {
  Shield,
  Scale,
  Search,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Users,
  Layers,
  Link2,
  Send,
  RefreshCw,
  Printer,
  Edit3,
  Sliders,
  Database,
  Sparkles,
  HelpCircle,
  Activity,
  DollarSign,
  AlertOctagon,
  Volume2,
  BookOpen,
  ChevronRight,
  Eye,
  FileCheck,
  Check
} from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState('hi'); // 'hi' or 'en'
  const [role, setRole] = useState('IO'); // 'IO', 'SHO', 'CO', 'SP', 'ADMIN'
  const [activeTab, setActiveTab] = useState('copilot'); // 'overview', 'copilot', 'deadlines', 'moneytrail', 'gaps', 'contradictions', 'notices', 'crosslinks', 'supervisor', 'mcp'
  
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('case_001');
  const [caseDetail, setCaseDetail] = useState(null);
  const [loadingCase, setLoadingCase] = useState(false);

  // RAG Copilot State
  const [query, setQuery] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResult, setRagResult] = useState(null);

  // Draft Notice State
  const [noticeType, setNoticeType] = useState('bank_freeze_notice');
  const [noticeLanguage, setNoticeLanguage] = useState('en');
  const [noticeDraft, setNoticeDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  // Supervisor Dashboard State
  const [supervisorData, setSupervisorData] = useState(null);

  // Audit Chain State
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [tamperSimResult, setTamperSimResult] = useState(null);

  // MCP Execution State
  const [mcpTools, setMcpTools] = useState([]);
  const [selectedMcpTool, setSelectedMcpTool] = useState('search_case');
  const [mcpResult, setMcpResult] = useState(null);
  const [mcpLoading, setMcpLoading] = useState(false);

  // Supabase Vector DB State
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [supabaseConnInput, setSupabaseConnInput] = useState('');
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [testingConn, setTestingConn] = useState(false);

  // Notification Banner
  const [banner, setBanner] = useState(null);

  const showBanner = (msg, type = 'success') => {
    setBanner({ msg, type });
    setTimeout(() => setBanner(null), 4000);
  };

  // Fetch initial case list
  useEffect(() => {
    fetchCases();
    fetchSupervisorDashboard();
    fetchAuditChain();
    fetchMcpTools();
    fetchSupabaseStatus();
  }, []);

  // Fetch selected case details
  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseDetails(selectedCaseId);
      setIsApproved(false);
      setIsEdited(false);
    }
  }, [selectedCaseId]);

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      if (data.success) {
        setCases(data.cases);
      }
    } catch (e) {
      console.error('Fetch cases error:', e);
    }
  };

  const fetchCaseDetails = async (id) => {
    setLoadingCase(true);
    try {
      const res = await fetch(`/api/cases/${id}`);
      const data = await res.json();
      if (data.success) {
        setCaseDetail(data);
      }
    } catch (e) {
      console.error('Fetch case detail error:', e);
    } finally {
      setLoadingCase(false);
    }
  };

  const fetchSupervisorDashboard = async () => {
    try {
      const res = await fetch(`/api/supervisor/dashboard?role=${role}`);
      const data = await res.json();
      if (data.success) {
        setSupervisorData(data);
      }
    } catch (e) {
      console.error('Fetch supervisor error:', e);
    }
  };

  const fetchAuditChain = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/audit/chain');
      const data = await res.json();
      if (data.success) {
        setAuditData(data);
      }
    } catch (e) {
      console.error('Fetch audit error:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchMcpTools = async () => {
    try {
      const res = await fetch('/api/mcp/tools');
      const data = await res.json();
      if (data.success) {
        setMcpTools(data.tools);
      }
    } catch (e) {
      console.error('Fetch MCP tools error:', e);
    }
  };

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/rag/supabase-status');
      const data = await res.json();
      if (data.success) {
        setSupabaseStatus(data);
        if (data.configured && !supabaseConnInput) {
          setSupabaseConnInput(data.maskedConnectionString || '');
        }
      }
    } catch (e) {
      console.error('Fetch supabase status error:', e);
    }
  };

  const handleSaveSupabaseConn = async () => {
    if (!supabaseConnInput.trim()) return;
    setTestingConn(true);
    try {
      const res = await fetch('/api/rag/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: supabaseConnInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showBanner('Supabase Vector Database connected successfully!');
        fetchSupabaseStatus();
      } else {
        showBanner(`Supabase connection failed: ${data.result?.error || 'Check connection string'}`, 'error');
      }
    } catch (e) {
      showBanner(`Connection error: ${e.message}`, 'error');
    } finally {
      setTestingConn(false);
    }
  };

  const handleSyncToSupabase = async () => {
    setSupabaseSyncing(true);
    try {
      const res = await fetch('/api/rag/supabase-sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showBanner(`Synced ${data.syncedCount} chunks to Supabase case_law_chunks table!`);
        fetchSupabaseStatus();
      } else {
        showBanner(`Sync failed: ${data.reason}`, 'error');
      }
    } catch (e) {
      showBanner(`Sync error: ${e.message}`, 'error');
    } finally {
      setSupabaseSyncing(false);
    }
  };

  const handleAskRag = async (inputQuery) => {
    const q = inputQuery || query;
    if (!q.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          caseId: selectedCaseId,
          role,
          language: lang
        })
      });
      const data = await res.json();
      if (data.success) {
        setRagResult(data);
        fetchAuditChain(); // Refresh audit log
      } else {
        showBanner(`RAG error: ${data.error}`, 'error');
      }
    } catch (e) {
      showBanner(`RAG error: ${e.message}`, 'error');
    } finally {
      setRagLoading(false);
    }
  };

  const handleGenerateNotice = async () => {
    setDraftLoading(true);
    try {
      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'draft_notice',
          params: {
            caseId: selectedCaseId,
            noticeType,
            language: noticeLanguage
          },
          context: { role, actor: 'Inspector Rajesh Verma' }
        })
      });
      const data = await res.json();
      if (data.success) {
        setNoticeDraft(data.data);
        setIsEdited(false);
        setIsApproved(false);
        fetchAuditChain();
        showBanner('Statutory Notice draft generated under BNSS powers.');
      } else {
        showBanner(data.error, 'error');
      }
    } catch (e) {
      showBanner(e.message, 'error');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleOfficerApprove = async () => {
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officerName: 'Inspector Rajesh Verma',
          role: 'IO',
          itemType: noticeType || 'STATUTORY_DRAFT'
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsApproved(true);
        fetchAuditChain();
        showBanner(`Approved by IO! Tamper-evident hash: ${data.auditHash.substring(0, 16)}...`);
      }
    } catch (e) {
      showBanner(e.message, 'error');
    }
  };

  const handleSimulateTamper = async () => {
    try {
      const res = await fetch('/api/audit/simulate-tamper', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTamperSimResult(data);
        fetchAuditChain();
        showBanner('Simulated record alteration tested against SHA-256 chain.');
      }
    } catch (e) {
      showBanner(e.message, 'error');
    }
  };

  const currentCase = caseDetail?.case;
  const analysis = caseDetail?.liveAnalysis;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Banner Message */}
      {banner && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center space-x-2 transition-all ${
          banner.type === 'error' ? 'bg-rose-900 border border-rose-500 text-rose-100' : 'bg-emerald-900 border border-emerald-500 text-emerald-100'
        }`}>
          {banner.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>{banner.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">Investigation Copilot</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold">
                  UP AI Samadhan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'hi' 
                  ? 'उत्तर प्रदेश पुलिस विवेचना सहायक · अधिकारी निर्णय नियंत्रण प्रणाली (BNS, BNSS, BSA)'
                  : 'Uttar Pradesh Police AI Assistant · Officer-in-Charge Decision Protocol (BNS, BNSS, BSA)'}
              </p>
            </div>
          </div>

          {/* Right Controls: Supabase DB, Role Switcher & Language Toggle */}
          <div className="flex items-center space-x-3">
            {/* Supabase Vector DB Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
              title="Configure Supabase Vector Database Connection String"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">Supabase</span>
              <span className={`w-2 h-2 rounded-full ${
                supabaseStatus?.status?.connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`} />
            </button>

            {/* Role Switcher */}
            <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 px-2 font-medium">Role:</span>
              {['IO', 'SHO', 'CO', 'SP', 'ADMIN'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-2.5 py-1 rounded font-semibold transition ${
                    role === r ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Language Toggle */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded transition ${lang === 'hi' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded transition ${lang === 'en' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Case Selector Ribbon */}
      <section className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            {lang === 'hi' ? 'केस चुनें (6 सिंथेटिक केस):' : 'Select Case (6 Synthetic Cases):'}
          </span>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fir_number} - {lang === 'hi' ? (c.case_title_hi || c.case_title) : c.case_title} ({c.police_station})
              </option>
            ))}
          </select>
        </div>

        {currentCase && (
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
              <strong className="text-amber-300">IO:</strong> {currentCase.io?.name} ({currentCase.io?.rank})
            </span>
            <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
              <strong className="text-amber-300">{lang === 'hi' ? 'मुकदमा धाराएं:' : 'Sections:'}</strong> {currentCase.sections_invoked?.join(', ')}
            </span>
            <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
              <strong className="text-amber-300">{lang === 'hi' ? 'कुल ठगी:' : 'Defrauded:'}</strong> ₹{(currentCase.defrauded_amount || 0).toLocaleString('en-IN')}
            </span>
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-600/40 px-2 py-1 rounded">
              <strong>{lang === 'hi' ? 'फ्रीज:' : 'Frozen:'}</strong> ₹{(currentCase.recovered_amount || 0).toLocaleString('en-IN')}
            </span>
            {currentCase.planted_contradiction && (
              <span className="bg-rose-950/80 text-rose-300 border border-rose-500/60 px-2 py-1 rounded font-semibold animate-pulse flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                {lang === 'hi' ? 'विरोधाभास अलर्ट' : 'Contradiction Alert'}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Main 10-Tab Navigation Bar */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-6 py-1 overflow-x-auto flex space-x-1">
        {[
          { id: 'copilot', label: lang === 'hi' ? 'विवेचना सहायक (RAG)' : 'Copilot RAG (UC 1, 2, 4)', icon: Sparkles },
          { id: 'deadlines', label: lang === 'hi' ? 'जमानत व पीड़ित समय-सीमा' : 'Deadlines (UC-7)', icon: Clock },
          { id: 'moneytrail', label: lang === 'hi' ? 'मनी ट्रेल व फ्रीज (1930)' : 'Money Trail (UC-8)', icon: DollarSign },
          { id: 'gaps', label: lang === 'hi' ? 'साक्ष्य व खामी ऑडिट' : 'Gaps Audit (UC-3)', icon: AlertTriangle },
          { id: 'contradictions', label: lang === 'hi' ? 'विरोधाभास जांच' : 'Contradiction Check', icon: AlertOctagon },
          { id: 'notices', label: lang === 'hi' ? 'नोटिस व केस डायरी' : 'Notices & Diary (UC-5, 6)', icon: FileText },
          { id: 'crosslinks', label: lang === 'hi' ? 'केस लिंकेज सिंडिकेट' : 'Cross-Links (UC-9)', icon: Link2 },
          { id: 'supervisor', label: lang === 'hi' ? 'पर्यवेक्षक डैशबोर्ड (SHO/SP)' : 'Supervisor View (UC-10)', icon: Users },
          { id: 'mcp', label: lang === 'hi' ? 'MCP टूल्स व ऑडिट चेन' : 'MCP & Audit Chain', icon: Lock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-md whitespace-nowrap transition border-b-2 ${
                isActive
                  ? 'border-amber-400 text-amber-300 bg-slate-800/80 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ================= TAB 1: RAG INVESTIGATION COPILOT ================= */}
        {activeTab === 'copilot' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Officer Prompt & MultiQuery RRF */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    {lang === 'hi' ? 'विवेचना सहायक: विधिक एवं तथ्य प्रश्नोत्तर' : 'Officer Law & Case Inquiry'}
                  </h2>
                  <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Gemini API + MultiQuery + RRF
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  {lang === 'hi'
                    ? 'जांच अधिकारी हिन्दी या अंग्रेजी में केस पत्रावली, धारा 318(4) बीएनएस, धारा 107 बीएनएसएस, बैंक फ्रीज, सीडीआर या साक्ष्य प्रमाण पत्र के विषय में पूछ सकते हैं।'
                    : 'The Investigating Officer can ask legal, procedural or factual questions. AI answers are grounded in verified law and case documents.'}
                </p>

                {/* Quick Preset Prompts */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    'धोखाधड़ी की धारा और बैंक खाता फ्रीज करने का नियम क्या है?',
                    'केनरा बैंक के संदिग्ध खाते को किस धारा में फ्रीज करें?',
                    'डिफ़ॉल्ट जमानत की 60 दिन की मियाद कब समाप्त हो रही है?',
                    'केस में कौन सा डिजिटल साक्ष्य प्रमाण पत्र (धारा 63 बीएसए) अधूरा है?',
                    'शिकायत पत्र और बैंक स्टेटमेंट की तारीखों में क्या अंतर है?'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(preset);
                        handleAskRag(preset);
                      }}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Question Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskRag()}
                      placeholder={lang === 'hi' ? 'अपना प्रश्न यहां लिखें... (उदा. धोखाधड़ी की धारा क्या है?)' : 'Ask about law, case facts, freeze rules, or deadlines...'}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => handleAskRag('धोखाधड़ी की धारा और बैंक खाता फ्रीज करने का नियम क्या है?')}
                      title="Voice Question Simulation"
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-amber-400"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleAskRag()}
                    disabled={ragLoading}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-sm flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    {ragLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{lang === 'hi' ? 'पूछें' : 'Query'}</span>
                  </button>
                </div>
              </div>

              {/* RAG Answer Display */}
              {ragResult && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <Scale className="w-5 h-5 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">
                        {lang === 'hi' ? 'सत्यापित विधिक एवं विवेचना विश्लेषण' : 'Grounded Legal & Factual Analysis'}
                      </h3>
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      Model: {ragResult.modelUsed}
                    </span>
                  </div>

                  {/* Citations Badge */}
                  {ragResult.citations && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center space-x-2">
                        {ragResult.citations.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {ragResult.citations.isValid ? 'Citation Verifier Passed' : 'Citation Warning'}
                        </span>
                      </div>
                      <span className="text-slate-400">
                        Verified Statutes: {(ragResult.citations.verifiedCitations || []).join(', ') || 'BNS / BNSS'}
                      </span>
                    </div>
                  )}

                  {/* Answer Text */}
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                    {ragResult.answer}
                  </div>

                  {/* Officer in Charge Notice */}
                  <div className="bg-amber-950/30 border border-amber-600/30 rounded-lg p-3 text-xs text-amber-300/90 flex items-start space-x-2">
                    <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      {lang === 'hi'
                        ? 'विवेचक हेतु वैधानिक सूचना: यह विश्लेषण अन्वेषण सहायक द्वारा प्रस्तुत है। न्यायालय में प्रेषित की जाने वाली अंतिम केस डायरी (पर्चा) और आरोप पत्र पर विवेचना अधिकारी का अनुमोदन अनिवार्य है।'
                        : 'Statutory Notice for IO: The model asks, the rules engine answers, the officer approves. Judicial responsibility remains solely with the Investigating Officer.'}
                    </span>
                  </div>

                  {/* Multi-Query RRF Ranking Details Table */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      {lang === 'hi' ? 'मल्टी-क्वेरी और रेसिप्रोकल रैंक फ्यूजन (RRF) तालिका' : 'Multi-Query & RRF Fusion Rankings'}
                    </h4>
                    
                    {/* Generated Sub-Queries */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                      <div className="text-slate-400 font-medium">Generated Multi-Query Perspectives:</div>
                      {ragResult.multiQueryUsed?.map((mq, idx) => (
                        <div key={idx} className="text-slate-300 font-mono text-[11px] pl-2 border-l-2 border-amber-500/50">
                          {idx + 1}. {mq}
                        </div>
                      ))}
                    </div>

                    {/* RRF Results Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-800 rounded-lg">
                        <thead className="bg-slate-800/60 text-slate-300">
                          <tr>
                            <th className="p-2">Rank</th>
                            <th className="p-2">Source Document / Statute</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">RRF Score</th>
                            <th className="p-2">Sub-query Hits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {ragResult.rrfRanks?.map((rankItem, i) => (
                            <tr key={i} className="hover:bg-slate-800/30">
                              <td className="p-2 font-bold text-amber-400">#{i + 1}</td>
                              <td className="p-2 text-slate-200">{rankItem.source}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  rankItem.type === 'LAW' ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'
                                }`}>
                                  {rankItem.type}
                                </span>
                              </td>
                              <td className="p-2 text-emerald-400">{rankItem.rrfScore}</td>
                              <td className="p-2 text-slate-400">{rankItem.matchCount} queries</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Pre-Stored Case Chunks */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-amber-400" />
                    {lang === 'hi' ? 'केस पत्रावली चंक्स (Pre-stored)' : 'Pre-Stored Case Chunks'}
                  </h3>
                  <span className="text-[10px] text-slate-400">{currentCase?.chunks?.length || 0} Chunks</span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {currentCase?.chunks?.map((chk) => (
                    <div
                      key={chk.chunk_id}
                      className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-amber-300">{chk.source_doc}</span>
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Page {chk.page_number}</span>
                      </div>
                      <div className="font-medium text-slate-200">{chk.title}</div>
                      <div className="text-slate-400 text-[11px] line-clamp-3 leading-relaxed">
                        {chk.text}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {chk.keywords?.slice(0, 3).map((kw, i) => (
                          <span key={i} className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: DEADLINES & BAIL CLOCK (UC-7) ================= */}
        {activeTab === 'deadlines' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {lang === 'hi' ? 'वैधानिक समय-सीमा व डिफ़ॉल्ट जमानत ट्रैकर (BNSS 187 एवं 193)' : 'Statutory Bail Clock & Victim Update Tracker'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'hi'
                  ? 'बीएनएसएस 2023 की धारा 187 के तहत 60 / 90 दिन की डिफ़ॉल्ट जमानत घड़ी तथा धारा 193(3)(ii) के अंतर्गत पीड़ित को 90 दिनों में अनिवार्य जांच प्रगति सूचना।'
                  : 'Tracks Section 187 BNSS 60/90-day default bail clock and mandatory 90-day victim progress reporting under Section 193(3)(ii) BNSS.'}
              </p>
            </div>

            {analysis?.deadlines && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Default Bail Clock Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      {lang === 'hi' ? 'डिफ़ॉल्ट जमानत घड़ी (धारा 187 बीएनएसएस)' : 'Default Bail Clock (BNSS Sec 187)'}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                      analysis.deadlines.bailClock?.urgency === 'CRITICAL' || analysis.deadlines.bailClock?.urgency === 'EXPIRED'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500'
                        : analysis.deadlines.bailClock?.urgency === 'WARNING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                    }`}>
                      {analysis.deadlines.bailClock?.status || 'NO_ARREST'}
                    </span>
                  </div>

                  {analysis.deadlines.bailClock?.status !== 'NO_ARREST_YET' ? (
                    <div className="space-y-4">
                      {/* Big Countdown Number */}
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">Days Remaining to File Chargesheet:</div>
                          <div className={`text-3xl font-extrabold ${
                            analysis.deadlines.bailClock.days_remaining <= 10 ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            {analysis.deadlines.bailClock.days_remaining} Days
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>Total Limit: <strong className="text-slate-200">{analysis.deadlines.bailClock.bail_period_days} Days</strong></div>
                          <div>Elapsed: <strong className="text-slate-200">{analysis.deadlines.bailClock.days_elapsed} Days</strong></div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Custody Progress</span>
                          <span>{Math.min(100, Math.round((analysis.deadlines.bailClock.days_elapsed / analysis.deadlines.bailClock.bail_period_days) * 100))}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${
                              analysis.deadlines.bailClock.days_remaining <= 10 ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((analysis.deadlines.bailClock.days_elapsed / analysis.deadlines.bailClock.bail_period_days) * 100))}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                        <strong>Legal Risk:</strong> {analysis.deadlines.bailClock.legal_consequence}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-400">
                      No arrest registered yet in this case. Bail clock initiates automatically upon police remand.
                    </div>
                  )}
                </div>

                {/* 2. Mandatory 90-Day Victim Update */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      {lang === 'hi' ? 'पीड़ित को 90-दिवसीय प्रगति रिपोर्ट (धारा 193)' : '90-Day Victim Update (BNSS Sec 193(3)(ii))'}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                      analysis.deadlines.victimUpdate?.urgency === 'OVERDUE'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500'
                        : 'bg-blue-950 text-blue-300 border border-blue-500'
                    }`}>
                      {analysis.deadlines.victimUpdate?.urgency}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">Days to Dispatch Victim Update:</div>
                      <div className="text-3xl font-extrabold text-blue-400">
                        {analysis.deadlines.victimUpdate?.days_remaining} Days
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>FIR Date: <strong className="text-slate-200">{analysis.deadlines.victimUpdate?.fir_date?.substring(0, 10)}</strong></div>
                      <div>Deadline: <strong className="text-slate-200">{analysis.deadlines.victimUpdate?.deadline_date?.substring(0, 10)}</strong></div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                    <strong>Statutory Duty:</strong> {analysis.deadlines.victimUpdate?.duty}
                  </div>

                  <button
                    onClick={() => {
                      setNoticeType('victim_progress_report');
                      setActiveTab('notices');
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{lang === 'hi' ? 'पीड़ित प्रगति रिपोर्ट ड्राफ्ट तैयार करें' : 'Generate Victim Progress Report Draft'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: MONEY TRAIL & 1930 FREEZE (UC-8) ================= */}
        {activeTab === 'moneytrail' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  {lang === 'hi' ? 'मनी ट्रेल विश्लेषण एवं खाता फ्रीज प्राथमिकता (1930/CFCFRMS)' : 'Money Trail & Freeze Priority (CFCFRMS / 1930)'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'hi'
                    ? 'लेयर-1, लेयर-2 और लेयर-3 म्यूल खातों का प्रवाह, 1930 पोर्टल समन्वय एवं धारा 107 बीएनएसएस के तहत डेबिट फ्रीज।'
                    : 'Multi-layer money trail tracing under UP Police Cyber SOP and immediate Section 107 BNSS freeze orders.'}
                </p>
              </div>

              {analysis?.moneyTrail && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400">Disputed: </span>
                    <strong className="text-slate-100">₹{analysis.moneyTrail.totalDisputedAmount?.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400">Frozen: </span>
                    <strong className="text-emerald-400">₹{analysis.moneyTrail.totalFrozenAmount?.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400">Recovery: </span>
                    <strong className="text-amber-400">{analysis.moneyTrail.recoveryRatio}%</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Freeze Priority Action Order */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                {lang === 'hi' ? 'प्राथमिकता के अनुसार खाता फ्रीज सूची (Section 107 BNSS Action)' : 'Freeze Priority Queue (Actionable)'}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-lg">
                  <thead className="bg-slate-800/70 text-slate-300">
                    <tr>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Layer</th>
                      <th className="p-3">Beneficiary / Mule Account</th>
                      <th className="p-3">Bank IFSC</th>
                      <th className="p-3">Amount Received</th>
                      <th className="p-3">Current Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {analysis?.moneyTrail?.freezePriorityList?.map((mule, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            mule.freezePriority === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500'
                              : mule.freezePriority === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {mule.freezePriority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 font-bold">Layer {mule.layer || 1}</td>
                        <td className="p-3 font-sans">
                          <div className="font-semibold text-slate-200">{mule.holder}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{mule.accountNumber}</div>
                        </td>
                        <td className="p-3 text-slate-300">{mule.ifsc}</td>
                        <td className="p-3 text-emerald-400 font-bold">₹{mule.receivedAmount?.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-sans text-slate-300">{mule.currentFreezeStatus}</td>
                        <td className="p-3 font-sans">
                          <button
                            onClick={() => {
                              setNoticeType('bank_freeze_notice');
                              setActiveTab('notices');
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-2.5 py-1 rounded text-xs transition"
                          >
                            Draft Notice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Full Transactions Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-400" />
                {lang === 'hi' ? 'सभी हस्तांतरण एवं यूटीआर विवरण' : 'Reconciled Bank UTR Transactions'}
              </h3>
              <div className="space-y-2">
                {currentCase?.transactions?.map((tx, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-amber-400 font-mono">L{tx.layer}</span>
                      <div>
                        <div className="text-slate-200 font-medium">{tx.sender} → <strong className="text-amber-300">{tx.receiver}</strong></div>
                        <div className="text-[11px] text-slate-500 font-mono">{tx.sender_acc} → {tx.receiver_acc} ({tx.ifsc || 'N/A'})</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm font-mono">₹{tx.amount?.toLocaleString('en-IN')}</div>
                      <div className="text-[11px] text-slate-400 font-mono">UTR: {tx.utr}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: GAPS AUDIT (UC-3) ================= */}
        {activeTab === 'gaps' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  {lang === 'hi' ? 'साक्ष्य खामी ऑडिट (Spot Gaps as Case Moves)' : 'Evidentiary Gaps & Weak Case Audit'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'hi'
                    ? 'जांच अधिकारी को आरोप पत्र खारिज होने से पूर्व डिजिटल साक्ष्य (BSA 63), सीडीआर और बैंक विवरण में कमियां बताता है।'
                    : 'Systematic check against statutory requirements before charge sheet filing to prevent acquittal.'}
                </p>
              </div>

              {analysis?.gaps && (
                <div className="flex items-center space-x-3">
                  <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                    analysis.gaps.weakCaseAlert ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  }`}>
                    {analysis.gaps.weakCaseAlert ? 'Weak Case Alert: Critical Gaps' : 'Case Health: Strong'}
                  </div>
                  <div className="text-xs text-slate-400">
                    Checklist Completion: <strong className="text-slate-200">{analysis.gaps.completionPercentage}%</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis?.gaps?.checklist?.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border ${
                    item.status === 'MISSING'
                      ? 'bg-rose-950/30 border-rose-600/40'
                      : item.status === 'PENDING'
                      ? 'bg-amber-950/30 border-amber-600/40'
                      : 'bg-emerald-950/30 border-emerald-600/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200">{item.item}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      item.status === 'MISSING'
                        ? 'bg-rose-900 text-rose-200'
                        : item.status === 'PENDING'
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-emerald-900 text-emerald-200'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{item.description}</div>
                  <div className="text-[11px] text-amber-300 font-mono">
                    Statute: {item.statute}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 5: CONTRADICTION CHECKER ================= */}
        {activeTab === 'contradictions' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                {lang === 'hi' ? 'केस आंतरिक विरोधाभास जांच (Contradiction Checker)' : 'Internal Contradiction & Clash Detector'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'hi'
                  ? 'वादी की लिखित शिकायत, बैंक स्टेटमेंट और एफआईआर में तारीखों, रकम और खातों के टकराव को पहले ही पकड़ता है ताकि बचाव पक्ष का वकील फायदा न उठा सके।'
                  : 'Flags clashes inside the case (amounts, dates, accounts, witness timing) before a defense lawyer does.'}
              </p>
            </div>

            {analysis?.contradictions?.contradictions?.length > 0 ? (
              <div className="space-y-4">
                {analysis.contradictions.contradictions.map((contra, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900 border border-rose-600/50 rounded-xl p-5 shadow-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertOctagon className="w-5 h-5 text-rose-400" />
                        <h3 className="text-sm font-bold text-rose-300">
                          {contra.type}: {contra.description}
                        </h3>
                      </div>
                      <span className="text-xs bg-rose-950 text-rose-300 px-2.5 py-1 rounded font-bold border border-rose-500">
                        {contra.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-semibold mb-1">Source / Claim A:</div>
                        <div className="text-slate-200">{contra.sourceA}</div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-semibold mb-1">Source / Claim B:</div>
                        <div className="text-slate-200">{contra.sourceB}</div>
                      </div>
                    </div>

                    <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-800/40 text-xs text-rose-200">
                      <strong>Defense Cross-Examination Risk:</strong> {contra.defenseRisk}
                    </div>

                    <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/40 text-xs text-emerald-200">
                      <strong>IO Remedial Action:</strong> {contra.remedy}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="font-semibold text-slate-200">No Internal Contradictions Detected</div>
                <div className="text-xs">Dates, amounts, and account logs are internally consistent.</div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: NOTICES & CASE DIARY (UC-5 & UC-6) ================= */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  {lang === 'hi' ? 'वैधानिक नोटिस एवं केस डायरी (पर्चा) ड्राफ्ट' : 'Statutory Notices & Case Diary (Parcha) Drafts'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'hi'
                    ? 'बीएनएसएस धारा 94, 106, 107 के अंतर्गत नोटिस। अधिकारी द्वारा अनुमोदन (Approval Gate) के पश्चात ही अंतिम।'
                    : 'Section 94/107 BNSS ready-to-print notices. All AI drafts are tagged until IO approval.'}
                </p>
              </div>

              {/* Notice Type Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={noticeType}
                  onChange={(e) => setNoticeType(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="bank_freeze_notice">Bank Debit Freeze Notice (BNSS Sec 94 & 107)</option>
                  <option value="telecom_cdr_notice">Telecom CDR & CAF Notice (BNSS Sec 94 & 106)</option>
                  <option value="victim_progress_report">Victim Progress Update (BNSS Sec 193(3)(ii))</option>
                </select>

                <select
                  value={noticeLanguage}
                  onChange={(e) => setNoticeLanguage(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="en">English (Official)</option>
                  <option value="hi">हिन्दी (राजभाषा)</option>
                </select>

                <button
                  onClick={handleGenerateNotice}
                  disabled={draftLoading}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded text-xs flex items-center space-x-1 transition disabled:opacity-50"
                >
                  {draftLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate</span>
                </button>
              </div>
            </div>

            {/* Generated Notice Draft */}
            {noticeDraft && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{noticeDraft.title}</span>
                    {/* Slide 6: "Tracks AI text vs officer edits" */}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      isApproved
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                        : isEdited
                        ? 'bg-blue-950 text-blue-300 border border-blue-500'
                        : 'bg-amber-950 text-amber-300 border border-amber-500'
                    }`}>
                      {isApproved ? 'Officer Signed & Approved' : isEdited ? 'Officer Edited' : 'AI Draft - Pending IO Approval'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => window.print()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs flex items-center space-x-1 border border-slate-700 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Notice</span>
                    </button>

                    {/* Officer in Charge Approval Button (Slide 12) */}
                    <button
                      onClick={handleOfficerApprove}
                      disabled={isApproved}
                      className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1 transition ${
                        isApproved
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isApproved ? 'Approved by IO' : 'Officer Sign & Approve'}</span>
                    </button>
                  </div>
                </div>

                {/* Editable Text Area */}
                <textarea
                  value={noticeDraft.draftContent}
                  onChange={(e) => {
                    setNoticeDraft({ ...noticeDraft, draftContent: e.target.value });
                    setIsEdited(true);
                  }}
                  rows={16}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-amber-500"
                />

                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded border border-slate-800">
                  <strong>Statutory Basis:</strong> {noticeDraft.statutoryActs?.join(', ')} | Recipient: {noticeDraft.recipientType}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 7: CROSS-CASE LINKAGES (UC-9) ================= */}
        {activeTab === 'crosslinks' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                <Link2 className="w-5 h-5 text-amber-400" />
                {lang === 'hi' ? 'अंतर-थाना साइबर सिंडिकेट लिंकेज (Cross-Case Linkages)' : 'Cross-Case Syndicate Identifier Matcher'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'hi'
                  ? 'एक ही संदिग्ध फोन नंबर, यूपीआई आईडी या बैंक खाते से जुड़े विभिन्न जिलों (लखनऊ, नोएडा, प्रयागराज आदि) के मामलों को आपस में जोड़ता है।'
                  : 'Identifies common suspect phones, bank accounts, UPI IDs, and IMEIs across other FIRs in UP Police records.'}
              </p>
            </div>

            {analysis?.crossLinks?.links?.length > 0 ? (
              <div className="space-y-4">
                {analysis.crossLinks.links.map((link, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">{link.policeStation}, {link.district}</div>
                        <h3 className="text-sm font-bold text-amber-300">{link.linkedFir}: {link.linkedTitle}</h3>
                      </div>
                      <span className="text-xs bg-amber-950 text-amber-300 border border-amber-500 px-2.5 py-1 rounded font-bold">
                        {link.syndicateRisk}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 font-mono">
                      <div className="text-slate-400 font-sans font-semibold">Matched Common Suspect Infrastructure:</div>
                      {link.sharedIdentifiers.phones?.length > 0 && (
                        <div className="text-slate-200">
                          <strong className="text-amber-400">Common Mobile:</strong> {link.sharedIdentifiers.phones.join(', ')}
                        </div>
                      )}
                      {link.sharedIdentifiers.accounts?.length > 0 && (
                        <div className="text-slate-200">
                          <strong className="text-blue-400">Common Bank A/c:</strong> {link.sharedIdentifiers.accounts.join(', ')}
                        </div>
                      )}
                      {link.sharedIdentifiers.upi?.length > 0 && (
                        <div className="text-slate-200">
                          <strong className="text-purple-400">Common UPI:</strong> {link.sharedIdentifiers.upi.join(', ')}
                        </div>
                      )}
                      {link.sharedIdentifiers.imei?.length > 0 && (
                        <div className="text-slate-200">
                          <strong className="text-emerald-400">Common Handset IMEI:</strong> {link.sharedIdentifiers.imei.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                No shared identifiers matched with other FIRs in database.
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 8: SUPERVISOR DASHBOARD (UC-10) ================= */}
        {activeTab === 'supervisor' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  {lang === 'hi' ? 'पर्यवेक्षक डैशबोर्ड: थाना / सर्किल / जनपद निगरानी (SHO, CO, SP)' : 'Supervisor Oversight Dashboard (SHO, CO, SP)'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'hi'
                    ? 'समय-सीमा से बाहर हो रहे केस, कमजोर विवेचनाएं तथा जिले भर में फ्रीज राशि का समग्र विवरण।'
                    : 'District and station-wide oversight of impending bail expirations, overdue victim reports, and weak cases.'}
                </p>
              </div>

              <span className="text-xs px-3 py-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Viewing as: {role}
              </span>
            </div>

            {/* Metrics Grid */}
            {supervisorData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow">
                  <div className="text-xs text-slate-400">Active Cases</div>
                  <div className="text-2xl font-extrabold text-white">{supervisorData.summary.totalCases}</div>
                  <div className="text-[11px] text-slate-500">Across 6 Stations</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow">
                  <div className="text-xs text-slate-400">Total Defrauded / Frozen</div>
                  <div className="text-xl font-extrabold text-emerald-400">
                    ₹{(supervisorData.summary.totalFrozenAmount / 100000).toFixed(1)}L / ₹{(supervisorData.summary.totalDefraudedAmount / 100000).toFixed(1)}L
                  </div>
                  <div className="text-[11px] text-amber-400">{supervisorData.summary.recoveryPercentage}% Recovery Rate</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow">
                  <div className="text-xs text-slate-400">Imminent / Expired Bail</div>
                  <div className="text-2xl font-extrabold text-rose-400">{supervisorData.summary.imminentBailCount}</div>
                  <div className="text-[11px] text-rose-400">Action Required &lt;10 Days</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow">
                  <div className="text-xs text-slate-400">Weak Cases / Contradictions</div>
                  <div className="text-2xl font-extrabold text-amber-400">{supervisorData.summary.contradictionCasesCount}</div>
                  <div className="text-[11px] text-amber-400">Evidentiary Gaps Detected</div>
                </div>
              </div>
            )}

            {/* Cases Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white">Station Cases Under Supervision</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-lg">
                  <thead className="bg-slate-800/60 text-slate-300">
                    <tr>
                      <th className="p-3">FIR No</th>
                      <th className="p-3">Station</th>
                      <th className="p-3">IO</th>
                      <th className="p-3">Defrauded</th>
                      <th className="p-3">Frozen</th>
                      <th className="p-3">Bail Clock</th>
                      <th className="p-3">Victim Update</th>
                      <th className="p-3">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {supervisorData?.cases?.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-amber-400">{c.fir_number}</td>
                        <td className="p-3 text-slate-200">{c.police_station}</td>
                        <td className="p-3 text-slate-300">{c.io_name}</td>
                        <td className="p-3 text-slate-300 font-mono">₹{c.defrauded_amount?.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-emerald-400 font-mono">₹{c.recovered_amount?.toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            c.bailClockUrgency === 'CRITICAL' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {c.bailDaysRemaining ? `${c.bailDaysRemaining}d remaining` : 'No arrest'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px]">
                            {c.victimDaysRemaining}d left
                          </span>
                        </td>
                        <td className="p-3">
                          {c.hasContradiction ? (
                            <span className="text-rose-400 font-bold">Contradiction</span>
                          ) : (
                            <span className="text-emerald-400">Normal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 9: MCP TOOLS & AUDIT CHAIN ================= */}
        {activeTab === 'mcp' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                  {lang === 'hi' ? 'MCP सर्वर टूल्स एवं छेड़छाड़-रोधी ऑडिट चेन' : 'MCP Typed Tools & Tamper-Evident Audit Chain'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'hi'
                    ? 'स्लाइड 8 व 9: AI केवल 8 टाइप्ड टूल्स से ही कार्य कर सकता है। प्रत्येक कॉल का क्रिप्टोग्राफिक SHA-256 हैश चेन में दर्ज होता है।'
                    : 'Slide 8 & 9: The only door the AI can use. Every execution is cryptographically chained via SHA-256.'}
                </p>
              </div>

              <button
                onClick={handleSimulateTamper}
                className="bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-500/60 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Record Tampering Test</span>
              </button>
            </div>

            {/* Tamper Simulation Banner */}
            {tamperSimResult && (
              <div className="bg-rose-950/60 border border-rose-500 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  Tamper Detection Test Passed (Slide 9 Specification)
                </div>
                <div className="text-rose-200">{tamperSimResult.defenseNotice}</div>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                  {JSON.stringify(tamperSimResult.detectionResult, null, 2)}
                </div>
              </div>
            )}

            {/* 8 Typed MCP Tools Grid */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white">Slide 8: The 8 Typed MCP Tools</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {mcpTools.map((t) => (
                  <div
                    key={t.name}
                    className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1 hover:border-amber-500/50 transition cursor-pointer"
                    onClick={() => {
                      setSelectedMcpTool(t.name);
                    }}
                  >
                    <div className="font-bold text-amber-400 font-mono">{t.name}()</div>
                    <div className="text-slate-400 text-[11px] line-clamp-2">{t.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Cryptographic Audit Chain Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Cryptographic Hash-Chained Audit Chain (Total Blocks: {auditData?.totalBlocks || 0})
                  </h3>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    auditData?.chainValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-rose-950 text-rose-300 border border-rose-500'
                  }`}>
                    {auditData?.chainValid ? 'Chain Intact: SHA-256 Validated' : 'Chain Broken! Tamper Detected'}
                  </span>
                  <button
                    onClick={fetchAuditChain}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {auditData?.entries?.map((block) => (
                  <div
                    key={block.index}
                    className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-amber-400 font-bold">Block #{block.index} - {block.tool}</span>
                      <span className="text-[10px] text-slate-500">{block.timestamp}</span>
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      Actor: <span className="text-blue-300">{block.actor}</span> | Role: <span className="text-purple-300">{block.role}</span> | Case: <span className="text-emerald-300">{block.caseId}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      SHA256: {block.hash}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">
                      PrevHash: {block.prevHash}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Supabase Vector Database Configuration Modal */}
        {showSupabaseModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Supabase Vector Database Configuration</h3>
                </div>
                <button
                  onClick={() => setShowSupabaseModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Supabase PostgreSQL Connection String (Session / Transaction Pooler or Direct):
                  </label>
                  <input
                    type="password"
                    value={supabaseConnInput}
                    onChange={(e) => setSupabaseConnInput(e.target.value)}
                    placeholder="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Found in your Supabase Dashboard &gt; Project Settings &gt; Database &gt; Connection String (URI).
                  </p>
                </div>

                {/* Connection Status Box */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Connection Status:</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      supabaseStatus?.status?.connected
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                        : 'bg-amber-950 text-amber-300 border border-amber-500'
                    }`}>
                      {supabaseStatus?.status?.connected ? 'Connected to Supabase' : 'Offline / In-Memory Fallback'}
                    </span>
                  </div>
                  {supabaseStatus?.status?.connected && (
                    <div className="text-slate-400 font-mono text-[11px] space-y-0.5">
                      <div>Database: <strong className="text-slate-200">{supabaseStatus.status.database}</strong></div>
                      <div>PostgreSQL Version: <strong className="text-slate-200">{supabaseStatus.status.version?.substring(0, 30)}...</strong></div>
                    </div>
                  )}
                  {!supabaseStatus?.status?.connected && (
                    <div className="text-slate-400 text-[11px]">
                      {supabaseStatus?.status?.reason || supabaseStatus?.status?.error || 'Enter your Supabase connection string above and click Test & Connect.'}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    onClick={handleSaveSupabaseConn}
                    disabled={testingConn || !supabaseConnInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    {testingConn ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Test & Save Connection</span>
                  </button>

                  <button
                    onClick={handleSyncToSupabase}
                    disabled={supabaseSyncing || !supabaseStatus?.status?.connected}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    {supabaseSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Sync Pre-stored Chunks to Supabase</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span>UP AI Samadhan Hackathon · Investigation Copilot</span>
          <span>•</span>
          <span className="text-slate-300">UP Police & Dept. of IT & Electronics</span>
        </div>
        <div className="flex items-center space-x-3 text-slate-500">
          <span>BNS 2023 · BNSS 2023 · BSA 2023</span>
          <span>•</span>
          <span>33/33 Tests Passing</span>
        </div>
      </footer>
    </div>
  );
}
