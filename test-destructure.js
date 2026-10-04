const electron = require('electron');
console.log('Electron starting...', typeof electron, electron);
const { app, BrowserWindow, ipcMain } = electron;
console.log('Destructured:', !!app, !!BrowserWindow, !!ipcMain);
app.quit();