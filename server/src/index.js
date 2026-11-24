require('dotenv').config();
const express = require('express');
const cors = require('cors');

const casesRouter = require('./routes/casesRouter');
const ragRouter = require('./routes/ragRouter');
const mcpRouter = require('./routes/mcpRouter');
const supervisorRouter = require('./routes/supervisorRouter');
const auditRouter = require('./routes/auditRouter');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Investigation Copilot - UP AI Samadhan',
    version: '1.0.0',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    lawsSupported: ['BNS 2023', 'BNSS 2023', 'BSA 2023', 'IT Act 2000', 'UP Police SOPs'],
    time: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/cases', casesRouter);
app.use('/api/rag', ragRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/audit', auditRouter);

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[UP Police Investigation Copilot Server] running on http://localhost:${PORT}`);
  });
}

module.exports = app;
