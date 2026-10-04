// Try dynamic import in CommonJS
async function loadElectron() {
  try {
    const electron = await import('electron/main');
    console.log('electron:', electron);
    console.log('app:', electron.app);
    console.log('BrowserWindow:', electron.BrowserWindow);
    console.log('ipcMain:', electron.ipcMain);
    return electron;
  } catch (e) {
    console.error('Dynamic import failed:', e);
  }
}
loadElectron();
