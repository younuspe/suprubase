// Permission gate for Supru
// Every tool call from UI or agents passes through this gate
// It enforces policies: deny > ask > allow, with defaults

const path = require('path');
const fs = require('fs/promises');

// Get electron modules lazily from global
const getElectron = () => global.electronMainExports || require('electron');

class Gate {
  constructor(policies) {
    this.policies = policies || {
      defaultToolPermission: 'deny',
      humanApproval: [],
      secrets: { neverRead: ['.env*', '*.pem', 'id_rsa*', 'id_dsa*', 'id_ecdsa*', 'id_ed25519*', 'authorized_keys', 'known_hosts'] },
      fs: { read: [], write: [], deny: [] },
      shell: { allow: [], deny: [] },
      onError: { retries: 0, then: 'escalate' },
      limits: { maxFileSize: 10 * 1024 * 1024,
                maxMemory: 100 * 1024 * 1024,
                maxProcesses: 10 }
    };
    this.projectRoot = null;
    this._compilePatterns();
  }

  setProjectRoot(rootPath) {
    this.projectRoot = rootPath;
  }

  _compilePatterns() {
    this.fsReadRegexes = this.policies.fs?.read.map(p => this._globToRegex(p)) || [];
    this.fsWriteRegexes = this.policies.fs?.write.map(p => this._globToRegex(p)) || [];
    this.fsDenyRegexes = this.policies.fs?.deny.map(p => this._globToRegex(p)) || [];
    this.shellAllowRegexes = this.policies.shell?.allow.map(p => this._globToRegex(p)) || [];
    this.shellDenyRegexes = this.policies.shell?.deny.map(p => this._globToRegex(p)) || [];
    this.secretsRegexes = this.policies.secrets?.neverRead.map(p => this._globToRegex(p)) || [];
  }

  _globToRegex(glob) {
    let regexStr = glob
      .replace(/[-[\]{}()+.,\\^$|#\s]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp('^' + regexStr + '$');
  }

  _matchesAnyPattern(str, regexes) {
    return regexes.some(regex => regex.test(str));
  }

  _isPathAllowedForReading(filePath) {
    if (this._matchesAnyPattern(filePath, this.fsDenyRegexes)) return false;
    if (this.fsReadRegexes.length > 0) return this._matchesAnyPattern(filePath, this.fsReadRegexes);
    return false;
  }

  _isPathAllowedForWriting(filePath) {
    if (this._matchesAnyPattern(filePath, this.fsDenyRegexes)) return false;
    if (this.fsWriteRegexes.length > 0) return this._matchesAnyPattern(filePath, this.fsWriteRegexes);
    return false;
  }

  _isSecretFile(filePath) {
    const basename = path.basename(filePath);
    return this._matchesAnyPattern(basename, this.secretsRegexes);
  }

  _shellAllowed(command) {
    if (this._matchesAnyPattern(command, this.shellDenyRegexes)) return 'deny';
    if (this._matchesAnyPattern(command, this.shellAllowRegexes)) return 'allow';
    return this.policies.defaultToolPermission;
  }

  _checkLimits(tool, args) {
    const limits = this.policies.limits;
    if (!limits) return { permitted: true };

    if (tool.startsWith('fs:') && (tool === 'fs:write' || tool === 'fs:edit')) {
      const content = args[1] || '';
      if (Buffer.byteLength(content, 'utf8') > limits.maxFileSize) {
        return { permitted: false, reason: `File size exceeds limit of ${limits.maxFileSize} bytes` };
      }
    }
    return { permitted: true };
  }

  async execute(tool, args, agentId = null) {
    let permission = this.policies.defaultToolPermission;
    let reason = undefined;

    if (this.policies.humanApproval.includes(tool)) {
      permission = 'ask';
      reason = 'Requires human approval';
    }

    if (tool.startsWith('fs:')) {
      const pathArg = args[0] || '';
      
      if (this._isSecretFile(pathArg)) {
        await this._logAudit(tool, { path: pathArg, reason: 'Access to secret file denied' }, agentId);
        return { permitted: false, permission: 'deny', reason: 'Access to secret file denied' };
      }

      if (this._matchesAnyPattern(pathArg, this.fsDenyRegexes)) {
        await this._logAudit(tool, { path: pathArg, reason: `Path denied by policy` }, agentId);
        return { permitted: false, permission: 'deny', reason: `Path denied by policy` };
      }

      let pathAllowed = false;
      if (tool === 'fs:read' || tool === 'fs:edit') {
        pathAllowed = this._isPathAllowedForReading(pathArg);
      } else if (tool === 'fs:write' || tool === 'fs:move' || tool === 'fs:delete' || 
                 tool === 'fs:copy' || tool === 'fs:mkdir') {
        pathAllowed = this._isPathAllowedForWriting(pathArg);
      }
      
      if (!pathAllowed) {
        await this._logAudit(tool, { path: pathArg, reason: `Path not allowed for ${tool}` }, agentId);
        return { permitted: false, permission: 'deny', reason: `Path not allowed for ${tool}` };
      }
      
      if (permission !== 'ask') permission = 'allow';
      
      const limitsCheck = this._checkLimits(tool, args);
      if (!limitsCheck.permitted) {
        await this._logAudit(tool, { path: pathArg, reason: limitsCheck.reason }, agentId);
        return { permitted: false, permission: 'deny', reason: limitsCheck.reason };
      }
      
      await this._logAudit(tool, { path: pathArg }, agentId);
    }

    if (tool === 'shell:run') {
      const command = args[0] || '';
      const shellPerm = this._shellAllowed(command);
      if (shellPerm === 'deny') {
        await this._logAudit(tool, { command, reason: `Command denied by shell policy` }, agentId);
        return { permitted: false, permission: 'deny', reason: `Command denied by shell policy` };
      }
      if (shellPerm === 'ask') {
        permission = 'ask';
        reason = 'Requires human approval';
      }
      if (shellPerm === 'allow' && permission !== 'ask') permission = 'allow';
      await this._logAudit(tool, { command }, agentId);
    }

    const result = {
      permitted: permission !== 'deny',
      permission: permission,
      reason: permission === 'ask' ? reason : undefined
    };

    await this._logAudit(tool, args, agentId);
    return result;
  }

  getUserDataPath() {
    const { app } = getElectron();
    return app.getPath('userData');
  }

  async _getLogDir() {
    if (this.projectRoot) {
      return path.join(this.projectRoot, '.supru');
    }
    try {
      return path.join(this.getUserDataPath(), '.supru');
    } catch (e) {
      return null;
    }
  }

  async _logAudit(tool, args, agentId = null) {
    try {
      if (!this.policies.fs || !this.policies.fs.write || this.policies.fs.write.length === 0) return;
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        tool,
        args: JSON.stringify(args),
        agentId
      };
      
      const logDir = await this._getLogDir();
      if (!logDir) return;
      
      await fs.mkdir(logDir, { recursive: true });
      const logPath = path.join(logDir, 'audit.jsonl');
      await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.warn('Failed to log audit:', err.message);
    }
  }

  async logFileChange(action, target, oldValue = null, newValue = null) {
    try {
      if (!this.policies.fs || !this.policies.fs.write || this.policies.fs.write.length === 0) return;
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        target,
        oldValue,
        newValue
      };
      
      const logDir = await this._getLogDir();
      if (!logDir) return;
      
      await fs.mkdir(logDir, { recursive: true });
      const logPath = path.join(logDir, 'changes.jsonl');
      await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.warn('Failed to log file change:', err.message);
    }
  }
}

module.exports = { Gate };