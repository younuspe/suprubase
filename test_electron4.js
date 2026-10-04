const electron = require('electron/main');
console.log('electron:', electron);
console.log('typeof:', typeof electron);
console.log('keys:', Object.keys(electron));
console.log('app:', electron.app);
console.log('BrowserWindow:', electron.BrowserWindow);
console.log('ipcMain:', electron.ipcMain);
