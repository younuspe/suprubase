// Agent runner for Supru
// Runs headless CLI agents (Claude Code, Copilot) and parses their output
const { spawn } = require('child_process');
const path = require('path');

class AgentRunner {
  constructor() {
    this.runningProcesses = new Map();
    this.agentBuffers = new Map(); // Persistent buffers for getOutput()
    this.mainWindow = null;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async runAgent(agentId, command, args, cwd) {
    if (this.runningProcesses.has(agentId)) {
      await this.stopAgent(agentId);
    }
    // Initialize/reset buffers for this agent
    const buffers = {
      stdoutBuffer: '',
      stderrBuffer: '',
      stdout: '',
      stderr: ''
    };
    this.agentBuffers.set(agentId, buffers);
    
    const processEnv = process.env;
    const childProcess = spawn(command, args, {
      cwd,
      env: processEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      buffers.stdout += chunk;
      buffers.stdoutBuffer += chunk;
      const lines = buffers.stdoutBuffer.split('\n');
      buffers.stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this._emitAgentEvent(agentId, 'claude-event', event);
          } catch (err) {
            this._emitAgentEvent(agentId, 'stdout', line);
          }
        }
      }
    });
    childProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      buffers.stderr += chunk;
      buffers.stderrBuffer += chunk;
      const lines = buffers.stderrBuffer.split('\n');
      buffers.stderrBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this._emitAgentEvent(agentId, 'claude-event', event);
          } catch (err) {
            this._emitAgentEvent(agentId, 'stderr', line);
          }
        }
      }
    });
    childProcess.on('exit', (code, signal) => {
      if (buffers.stdoutBuffer.trim()) {
        this._emitAgentEvent(agentId, 'stdout', buffers.stdoutBuffer);
      }
      if (buffers.stderrBuffer.trim()) {
        this._emitAgentEvent(agentId, 'stderr', buffers.stderrBuffer);
      }
      this._emitAgentEvent(agentId, 'exit', { code, signal });
      // Process has exited, remove from running processes but keep buffers
      this.runningProcesses.delete(agentId);
    });
    childProcess.on('error', (err) => {
      this._emitAgentEvent(agentId, 'error', { message: err.message });
      // Process errored, remove from running processes but keep buffers
      this.runningProcesses.delete(agentId);
    });
    this.runningProcesses.set(agentId, {
      process: childProcess,
      buffers,
      args: args,
      cwd: cwd,
      command: command
    });
    return agentId;
  }

  async stopAgent(agentId) {
    const agentData = this.runningProcesses.get(agentId);
    if (agentData && agentData.process) {
      const process = agentData.process;
      process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // `process.killed` is true immediately after sending SIGTERM, so it is
      // not a valid check for whether the child is still alive. Use the exit
      // state instead to decide whether to force-kill the process.
      if (process.exitCode === null) {
        process.kill('SIGKILL');
      }

      this._emitAgentEvent(agentId, 'stopped');
      // Remove from running processes after stopping, but keep buffers
      this.runningProcesses.delete(agentId);
    }
  }

  getOutput(agentId) {
    const buffers = this.agentBuffers.get(agentId);
    if (buffers) {
      return {
        stdout: buffers.stdout,
        stderr: buffers.stderr
      };
    }
    return { stdout: '', stderr: '' };
  }

  isRunning(agentId) {
    return this.runningProcesses.has(agentId);
  }

  _emitAgentEvent(agentId, eventType, data) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('agent:data', agentId, eventType, data);
    } else {
      console.log(`Agent ${agentId} event: ${eventType}`, data);
    }
  }

  async resumeAgent(agentId, resumePath) {
    // Get cwd before stopping (since stopAgent removes from runningProcesses)
    const agentData = this.runningProcesses.get(agentId);
    const cwd = agentData ? agentData.cwd : process.cwd();
    
    if (this.runningProcesses.has(agentId)) {
      await this.stopAgent(agentId);
    }
    const args = ['--resume', resumePath];
    return await this.runAgent(agentId, 'claude', args, cwd);
  }

  buildClaudeArgs(options = {}) {
    const args = [];
    if (options.prompt) {
      args.push('-p', options.prompt);
    }
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    } else {
      args.push('--output-format', 'stream-json');
    }
    if (options.verbose) {
      args.push('--verbose');
    }
    if (options.permissionMode) {
      args.push('--permission-mode', options.permissionMode);
    }
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }
    if (options.maxTurns) {
      args.push('--max-turns', String(options.maxTurns));
    }
    if (options.resume) {
      args.push('--resume', options.resume);
    }
    return args;
  }
}

module.exports = { AgentRunner };
