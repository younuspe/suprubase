const pty = require('node-pty');
const path = require('path');

// Get electron modules lazily from global
const getElectron = () => global.electronMainExports || require('electron');

class PtyService {
  constructor() {
    this.terminals = new Map();
  }

  getIpcMain() {
    const { ipcMain } = getElectron();
    return ipcMain;
  }

  /**
   * Create a new terminal session.
   * @param {string} cwd - Current working directory.
   * @param {string[]} args - The command and arguments to run.
   * @returns {Promise<string>} The terminal ID.
   */
  async createTerminal(cwd, args, webContents) {
    const termId = Math.random().toString(36).substr(2, 9);
    const shellProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', args, {
      name: 'xterm-color',
      cwd,
      env: process.env
    });

    shellProcess.onData((data) => {
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('pty:data', termId, data);
      }
    });

    shellProcess.onExit((exitCode) => {
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('pty:exit', termId, exitCode);
      }
    });

    this.terminals.set(termId, { process: shellProcess });
    return termId;
  }

  writeToTerminal(termId, data) {
    const terminal = this.terminals.get(termId);
    if (terminal && terminal.process) {
      terminal.process.write(data);
    }
  }

  resizeTerminal(termId, size) {
    const terminal = this.terminals.get(termId);
    if (terminal && terminal.process) {
      terminal.process.resize(size.cols, size.rows);
    }
  }

  killTerminal(termId) {
    const terminal = this.terminals.get(termId);
    if (terminal && terminal.process) {
      terminal.process.kill();
      this.terminals.delete(termId);
    }
  }

  /**
   * Set up IPC handlers for the renderer.
   * Called from main.cjs after services are initialized.
   */
  setupIpcHandlers() {
    const ipcMain = this.getIpcMain();

    ipcMain.handle('pty:create', async (event, cwd, args) => {
      return await this.createTerminal(cwd, args, event.sender);
    });

    ipcMain.on('pty:write', (event, termId, data) => {
      this.writeToTerminal(termId, data);
    });

    ipcMain.on('pty:resize', (event, termId, size) => {
      this.resizeTerminal(termId, size);
    });

    ipcMain.on('pty:kill', (event, termId) => {
      this.killTerminal(termId);
    });
  }
}

module.exports = { PtyService };