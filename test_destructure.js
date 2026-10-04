const electron = require('electron');
console.log('electron:', electron);
console.log('typeof:', typeof electron);

const { app, BrowserWindow, ipcMain } = electron;
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
console.log('ipcMain:', ipcMain);
