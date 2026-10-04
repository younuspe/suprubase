// Wrapper to load Electron ESM modules and expose as CommonJS
let electronModule = null;

async function loadElectron() {
  if (electronModule) return electronModule;
  
  // Use dynamic import to load the ESM module
  const mod = await import('electron/main');
  electronModule = mod.default || mod;
  return electronModule;
}

// Synchronous getter that throws if not loaded
function getElectron() {
  if (!electronModule) {
    throw new Error('Electron not loaded yet. Call loadElectron() first.');
  }
  return electronModule;
}

// Export individual modules for convenience
module.exports = {
  loadElectron,
  getElectron,
  get app() { return getElectron().app; },
  get BrowserWindow() { return getElectron().BrowserWindow; },
  get ipcMain() { return getElectron().ipcMain; },
  get dialog() { return getElectron().dialog; },
  get shell() { return getElectron().shell; },
  get safeStorage() { return getElectron().safeStorage; },
  // Add more as needed
};
