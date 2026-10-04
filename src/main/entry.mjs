// ESM entry point for Supru
// Patches the electron module at runtime to provide main-process APIs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Create require function first
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Patch the electron module BEFORE any other code loads it
// The electron package's index.js exports the binary path string
// We replace it with a proper module that provides main-process APIs

// First, require the electron package to get its module object in cache
const electronPkgPath = require.resolve('electron');
const electronModule = require(electronPkgPath);

// Now we need to create a proper Electron API object
// We'll use the internal Electron bindings that ARE available in the main process
// The key insight: in the actual main process, some Electron APIs are available as globals
// or through the internal module system

// Check if we're in the main process by trying to access process.electronBinding
// or process._linkedBinding for common modules that don't crash

// Strategy: Use the fact that in the main process, we can access the internal
// Electron modules through the Module._load system

// Create a shim that provides the main Electron APIs
const electronShim = {
  // These will be populated lazily when first accessed
  _initialized: false,
  _cache: {},
  
  _init() {
    if (this._initialized) return;
    this._initialized = true;
    
    // Try to get Electron APIs through various methods
    // Method 1: Check if they're already on global (set by Electron)
    // Method 2: Use require on the internal electron module path
    // Method 3: Use process.electronBinding if available
    
    // For now, we'll use a minimal approach: 
    // The main process actually has these as built-in modules
    // We can try to load them via the internal Module._load
    const Module = require('module');
    
    const apiNames = [
      'app', 'BrowserWindow', 'ipcMain', 'dialog', 'shell', 
      'safeStorage', 'Menu', 'Tray', 'nativeImage', 'clipboard',
      'crashReporter', 'desktopCapturer', 'globalShortcut',
      'net', 'netLog', 'protocol', 'session', 'systemPreferences',
      'webContents', 'webFrame', 'webFrameMain'
    ];
    
    for (const name of apiNames) {
      try {
        // Try to load as a built-in module
        const mod = Module._load(name, require, true);
        if (mod) {
          this._cache[name] = mod;
        }
      } catch (e) {
        // Not available as built-in
      }
    }
    
    // Also try to get from electron package's internal modules
    try {
      const electronInternal = require('electron/main');
      if (electronInternal && typeof electronInternal === 'object') {
        for (const key of Object.keys(electronInternal)) {
          if (!this._cache[key] && electronInternal[key]) {
            this._cache[key] = electronInternal[key];
          }
        }
      }
    } catch (e) {
      // electron/main might be empty
    }
  },
  
  // Proxy getter to lazily initialize
  get app() { this._init(); return this._cache.app; },
  get BrowserWindow() { this._init(); return this._cache.BrowserWindow; },
  get ipcMain() { this._init(); return this._cache.ipcMain; },
  get dialog() { this._init(); return this._cache.dialog; },
  get shell() { this._init(); return this._cache.shell; },
  get safeStorage() { this._init(); return this._cache.safeStorage; },
  get Menu() { this._init(); return this._cache.Menu; },
  get Tray() { this._init(); return this._cache.Tray; },
  get nativeImage() { this._init(); return this._cache.nativeImage; },
  get clipboard() { this._init(); return this._cache.clipboard; },
  get crashReporter() { this._init(); return this._cache.crashReporter; },
  get desktopCapturer() { this._init(); return this._cache.desktopCapturer; },
  get globalShortcut() { this._init(); return this._cache.globalShortcut; },
  get net() { this._init(); return this._cache.net; },
  get netLog() { this._init(); return this._cache.netLog; },
  get protocol() { this._init(); return this._cache.protocol; },
  get session() { this._init(); return this._cache.session; },
  get systemPreferences() { this._init(); return this._cache.systemPreferences; },
  get webContents() { this._init(); return this._cache.webContents; },
  get webFrame() { this._init(); return this._cache.webFrame; },
  get webFrameMain() { this._init(); return this._cache.webFrameMain; },
};

// Replace the electron module's exports with our shim
// This affects all subsequent require('electron') calls
require.cache[electronPkgPath].exports = electronShim;

// Also patch the Module._load to intercept 'electron' requires
const originalLoad = require('module')._load;
require('module')._load = function(request, parent, isMain) {
  if (request === 'electron') {
    return electronShim;
  }
  return originalLoad.apply(this, arguments);
};

// Now set global for CommonJS modules
global.electronMainExports = electronShim;

// Initialize the shim
electronShim._init();

// Log what we got
console.log('Electron shim initialized:');
console.log('  app:', !!electronShim.app);
console.log('  BrowserWindow:', !!electronShim.BrowserWindow);
console.log('  ipcMain:', !!electronShim.ipcMain);
console.log('  dialog:', !!electronShim.dialog);

// Now load the CommonJS main.cjs
import('./main.cjs').catch(err => {
  console.error('Failed to load main.cjs:', err);
  process.exit(1);
});