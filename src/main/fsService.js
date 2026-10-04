// src/main/fsService.js
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// Get electron modules lazily from global
const getElectron = () => global.electronMainExports || require('electron');

class FSService extends EventEmitter {
  constructor() {
    super();
    this.projectRoot = null;
    this.watchers = new Map();
    this.lastProjectRootKey = 'lastProjectRoot';
    this.ignoredPatterns = ['node_modules', '.git', 'dist'];
    this.gate = null;
  }

  setGate(gate) {
    this.gate = gate;
  }

  getUserDataPath() {
    const { app } = getElectron();
    return app.getPath('userData');
  }

  getDialog() {
    const { dialog } = getElectron();
    return dialog;
  }

  /**
   * Set the project root (without showing a dialog).
   * @param {string} rootPath - The absolute path to the project root.
   * @returns {Promise<boolean>} True if the path is valid and set, false otherwise.
   */
  async setProjectRoot(rootPath) {
    this.stopAllWatchers();
    try {
      const stats = await fs.stat(rootPath);
      if (!stats.isDirectory()) return false;
    } catch (err) {
      return false;
    }

    this.projectRoot = rootPath;
    await this.saveLastProjectRoot(this.projectRoot);
    this.startWatcher(this.projectRoot);
    return true;
  }

  async getLastProjectRoot() {
    const userDataPath = this.getUserDataPath();
    const settingsPath = path.join(userDataPath, 'last-project-root.json');
    try {
      const data = await fs.readFile(settingsPath, 'utf8');
      const json = JSON.parse(data);
      return json.root;
    } catch (err) {
      return null;
    }
  }

  async saveLastProjectRoot(rootPath) {
    const userDataPath = this.getUserDataPath();
    const settingsPath = path.join(userDataPath, 'last-project-root.json');
    const data = JSON.stringify({ root: rootPath }, null, 2);
    await fs.writeFile(settingsPath, data);
  }

  async openProjectRoot() {
    const dialog = this.getDialog();
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      const success = await this.setProjectRoot(selectedPath);
      return success ? selectedPath : null;
    }
    return null;
  }

  isPathAllowed(targetPath) {
    if (!this.projectRoot) return false;
    let resolved;
    try {
      resolved = path.resolve(this.projectRoot, targetPath);
    } catch (err) {
      return false;
    }
    if (!resolved.startsWith(this.projectRoot)) return false;
    const relativePath = path.relative(this.projectRoot, resolved);
    for (const pattern of this.ignoredPatterns) {
      if (relativePath === pattern || 
          relativePath.startsWith(`${pattern}${path.sep}`) || 
          relativePath.includes(`${path.sep}${pattern}${path.sep}`) ||
          relativePath.endsWith(`${path.sep}${pattern}`)) {
        return false;
      }
    }
    return true;
  }

  async list(relativePath = '') {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    })).filter(entry => {
      const entryRelative = path.join(relativePath, entry.name);
      return this.isPathAllowed(entryRelative);
    });
  }

  async read(relativePath, options = {}) {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    if (options.start !== undefined && options.end !== undefined) {
      const buffer = await fs.readFile(fullPath);
      const text = buffer.toString('utf8');
      const lines = text.split('\n');
      const slice = lines.slice(options.start, options.end + 1);
      return slice.join('\n');
    } else {
      return await fs.readFile(fullPath, 'utf8');
    }
  }

  async write(relativePath, content) {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    if (this.gate) {
      await this.gate.logFileChange('write', relativePath, null, content);
    }
    this.emit('change', { action: 'write', path: relativePath });
  }

  async edit(relativePath, oldString, newString) {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    let content;
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      return { success: false, message: 'File not found' };
    }
    if (!content.includes(oldString)) {
      return { success: false, message: 'Old string not found' };
    }
    const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches && matches.length > 1) {
      return { success: false, message: 'Old string is not unique' };
    }
    const newContent = content.replace(oldString, newString);
    await fs.writeFile(fullPath, newContent, 'utf8');
    if (this.gate) {
      await this.gate.logFileChange('edit', relativePath, oldString, newString);
    }
    this.emit('change', { action: 'edit', path: relativePath, oldString, newString });
    return { success: true };
  }

  async move(fromRelativePath, toRelativePath) {
    if (!this.isPathAllowed(fromRelativePath) || !this.isPathAllowed(toRelativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fromFull = path.join(this.projectRoot, fromRelativePath);
    const toFull = path.join(this.projectRoot, toRelativePath);
    const toDir = path.dirname(toFull);
    await fs.mkdir(toDir, { recursive: true });
    await fs.rename(fromFull, toFull);
    if (this.gate) {
      await this.gate.logFileChange('move', { from: fromRelativePath, to: toRelativePath });
    }
    this.emit('change', { action: 'move', from: fromRelativePath, to: toRelativePath });
  }

  async delete(relativePath) {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    const trashDir = path.join(this.projectRoot, '.supru', 'trash');
    await fs.mkdir(trashDir, { recursive: true });
    const timestamp = Date.now();
    const basename = path.basename(relativePath);
    const trashPath = path.join(trashDir, `${timestamp}-${basename}`);
    await fs.rename(fullPath, trashPath);
    if (this.gate) {
      await this.gate.logFileChange('delete', relativePath);
    }
    this.emit('change', { action: 'delete', path: relativePath });
  }

  async copy(fromRelativePath, toRelativePath) {
    if (!this.isPathAllowed(fromRelativePath) || !this.isPathAllowed(toRelativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fromFull = path.join(this.projectRoot, fromRelativePath);
    const toFull = path.join(this.projectRoot, toRelativePath);
    const stats = await fs.stat(fromFull);
    if (stats.isDirectory()) {
      await this.copyDirectory(fromFull, toFull);
    } else {
      const toDir = path.dirname(toFull);
      await fs.mkdir(toDir, { recursive: true });
      await fs.copyFile(fromFull, toFull);
    }
    if (this.gate) {
      await this.gate.logFileChange('copy', { from: fromRelativePath, to: toRelativePath });
    }
    this.emit('change', { action: 'copy', from: fromRelativePath, to: toRelativePath });
  }

  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async mkdir(relativePath) {
    if (!this.isPathAllowed(relativePath)) {
      throw new Error('Access denied: path is outside project root');
    }
    const fullPath = path.join(this.projectRoot, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
    if (this.gate) {
      await this.gate.logFileChange('mkdir', relativePath);
    }
    this.emit('change', { action: 'mkdir', path: relativePath });
  }

  async search(query, glob = '**/*') {
    if (!this.projectRoot) return [];
    const files = await this._getAllFiles(this.projectRoot, '');
    const results = [];
    for (const file of files) {
      try {
        const content = await this.read(file);
        const lines = content.split('\n');
        const matchingLines = [];
        lines.forEach((line, lineIndex) => {
          if (line.includes(query)) {
            matchingLines.push(lineIndex + 1);
          }
        });
        if (matchingLines.length > 0) {
          results.push({ file, lines: matchingLines });
        }
      } catch (err) {
        continue;
      }
    }
    return results;
  }

  async _getAllFiles(dir, relative) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (this.ignoredPatterns.includes(entry.name)) continue;
        const subFiles = await this._getAllFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
    return files;
  }

  async logChange(action, target, oldValue = null, newValue = null) {
    if (!this.projectRoot) return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      target,
      oldValue,
      newValue
    };
    const logPath = path.join(this.projectRoot, '.supru', 'changes.jsonl');
    const supruDir = path.join(this.projectRoot, '.supru');
    await fs.mkdir(supruDir, { recursive: true });
    await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
  }

  startWatcher(rootPath) {
    this.stopWatcher(rootPath);
    const watcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
      const absolutePath = path.join(rootPath, filename || '');
      const relativePath = path.relative(this.projectRoot, absolutePath);
      if (!this.isPathAllowed(relativePath)) return;
      this.emit('change', { action: eventType, path: relativePath, filename });
    });
    this.watchers.set(rootPath, watcher);
  }

  stopWatcher(rootPath) {
    const watcher = this.watchers.get(rootPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(rootPath);
    }
  }

  stopAllWatchers() {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

module.exports = { FSService };