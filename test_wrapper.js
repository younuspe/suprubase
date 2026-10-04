const electron = require('./electron-wrapper');
(async () => {
  await electron.loadElectron();
  console.log('app:', electron.app);
  console.log('BrowserWindow:', electron.BrowserWindow);
  console.log('ipcMain:', electron.ipcMain);
  console.log('dialog:', electron.dialog);
})();
