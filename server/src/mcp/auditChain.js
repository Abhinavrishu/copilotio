const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class AuditChain {
  constructor() {
    this.chain = [];
    this.storagePath = path.join(__dirname, '../../data/audit_log.json');
    this.genesisBlockCreated = false;
    this.initialize();
  }

  initialize() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        this.chain = JSON.parse(raw);
        if (this.chain.length > 0) {
          this.genesisBlockCreated = true;
          return;
        }
      }
    } catch (e) {
      this.chain = [];
    }

    // Create Genesis Block if chain is empty
    this.createGenesisBlock();
  }

  calculateHash(prevHash, timestamp, actor, role, tool, caseId, inputPayload, outputPayload) {
    const dataStr = `${prevHash}|${timestamp}|${actor}|${role}|${tool}|${caseId || 'NONE'}|${JSON.stringify(inputPayload)}|${JSON.stringify(outputPayload)}`;
    return crypto.createHash('sha256').update(dataStr).digest('hex');
  }

  createGenesisBlock() {
    const timestamp = '2025-10-01T00:00:00.000Z';
    const genesisHash = crypto
      .createHash('sha256')
      .update('UP_POLICE_INVESTIGATION_COPILOT_GENESIS_ROOT')
      .digest('hex');

    const genesis = {
      index: 0,
      timestamp,
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: genesisHash,
      actor: 'SYSTEM_INIT',
      role: 'ADMIN',
      tool: 'GENESIS_BOOTSTRAP',
      caseId: 'ROOT',
      inputPayload: { system: 'UP Police AI Samadhan Hackathon' },
      outputPayload: { status: 'Audit Chain Genesis Initialized' }
    };

    this.chain = [genesis];
    this.genesisBlockCreated = true;
    this.persist();
  }

  logCall(params) {
    const { actor = 'OFFICER_DEFAULT', role = 'IO', tool, caseId, inputPayload, outputPayload } = params;
    const timestamp = new Date().toISOString();
    const lastBlock = this.chain[this.chain.length - 1];
    const prevHash = lastBlock ? lastBlock.hash : '0';

    const hash = this.calculateHash(prevHash, timestamp, actor, role, tool, caseId, inputPayload, outputPayload);

    const block = {
      index: this.chain.length,
      timestamp,
      prevHash,
      hash,
      actor,
      role,
      tool,
      caseId: caseId || 'N/A',
      inputPayload,
      outputPayload
    };

    this.chain.push(block);
    this.persist();
    return block;
  }

  validateChain() {
    if (this.chain.length === 0) return { isValid: false, error: 'Empty chain' };

    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // 1. Verify prevHash matches
      if (current.prevHash !== previous.hash) {
        return {
          isValid: false,
          brokenAtIndex: i,
          error: `Broken link at block ${i}: expected prevHash ${previous.hash}, found ${current.prevHash}`
        };
      }

      // 2. Recompute current hash
      const recomputed = this.calculateHash(
        current.prevHash,
        current.timestamp,
        current.actor,
        current.role,
        current.tool,
        current.caseId,
        current.inputPayload,
        current.outputPayload
      );

      if (recomputed !== current.hash) {
        return {
          isValid: false,
          brokenAtIndex: i,
          error: `Tampered payload at block ${i}: recomputed hash ${recomputed} does not match stored hash ${current.hash}`
        };
      }
    }

    return {
      isValid: true,
      totalBlocks: this.chain.length,
      latestHash: this.chain[this.chain.length - 1].hash
    };
  }

  getEntries(options = {}) {
    const { caseId, tool, limit = 50 } = options;
    let list = [...this.chain].reverse();
    if (caseId) list = list.filter((b) => b.caseId === caseId);
    if (tool) list = list.filter((b) => b.tool === tool);
    return list.slice(0, limit);
  }

  persist() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.chain, null, 2), 'utf8');
    } catch (e) {
      console.warn('Audit log write error:', e.message);
    }
  }
}

module.exports = new AuditChain();
