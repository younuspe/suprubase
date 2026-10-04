// Settings service for Supru
// Handles window bounds, pill geometry, last project, and other persistent settings

const fs = require('fs');
const path = require('path');

// Get app from global electronMainExports (set by entry.mjs)
const { app } = global.electronMainExports || require('electron');

class SettingsService {
  constructor() {
    this._settingsPath = null;
    this.settings = {
      windowBounds: null,
      pillGeometry: null,
      lastProjectRoot: null,
      claudeCode: {
        permissionMode: 'acceptEdits',
        allowedTools: [],
        maxTurns: 30,
      }
    };
    this._loaded = false;
  }

  get settingsPath() {
    if (!this._settingsPath) {
      this._settingsPath = path.join(app.getPath('userData'), 'settings.json');
    }
    return this._settingsPath;
  }

  loadSettings() {
    if (this._loaded) return;
    this._loaded = true;
    try {
      const data = fs.readFileSync(this.settingsPath, 'utf8');
      Object.assign(this.settings, JSON.parse(data));
    } catch (err) {
      console.log('No settings file found, using defaults');
    }
  }

  saveSettings() {
    try {
      const path = this.settingsPath;
      console.log('[settings] Saving to:', path);
      const json = JSON.stringify(this.settings, null, 2);
      console.log('[settings] Data:', json);
      fs.writeFileSync(path, json);
      console.log('[settings] Save successful');
    } catch (err) {
      console.error('[settings] Failed to save settings:', err);
    }
  }

  getSettings() {
    return this.settings;
  }
}

// Export a singleton instance with the original API
const settingsService = new SettingsService();
module.exports = {
  loadSettings: () => settingsService.loadSettings(),
  saveSettings: () => settingsService.saveSettings(),
  get settings() { return settingsService.getSettings(); },
  settingsService,
};