// Direct test: Does Electron 44/45 provide main-process APIs?
import * as electron from 'electron/main';
console.log('=== electron/main import ===');
console.log('Module:', electron);
console.log('Keys:', Object.keys(electron));
console.log('app:', electron.app);
console.log('BrowserWindow:', electron.BrowserWindow);
console.log('ipcMain:', electron.ipcMain);
console.log('dialog:', electron.dialog);

// Also try to access the internal binding directly
console.log('\n=== process._linkedBinding ===');
try {
  const appBinding = process._linkedBinding('electron_browser_app');
  console.log('electron_browser_app:', appBinding);
} catch (e) {
  console.log('electron_browser_app error:', e.message);
}

try {
  const bwBinding = process._linkedBinding('electron_browser_browser_window');
  console.log('electron_browser_browser_window:', bwBinding);
} catch (e) {
  console.log('electron_browser_browser_window error:', e.message);
}

try {
  const ipcBinding = process._linkedBinding('electron_browser_ipc_main');
  console.log('electron_browser_ipc_main:', ipcBinding);
} catch (e) {
  console.log('electron_browser_ipc_main error:', e.message);
}

console.log('\n=== process.type ===');
console.log('process.type:', process.type);

console.log('\n=== Electron version ===');
console.log('process.versions.electron:', process.versions.electron);
