const electron = require('electron');
console.log('typeof electron:', typeof electron);
console.log('electron is:', electron);
const { app, BrowserWindow, ipcMain } = electron;
console.log('Destructured:', !!app, !!BrowserWindow, !!ipcMain);
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
console.log('ipcMain:', ipcMain);
app.quit();