// @electron/remote/main needs to be initialized
require('@electron/remote/main').initialize();

const { app, BrowserWindow, ipcMain, dialog } = require('@electron/remote/main');
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
console.log('ipcMain:', ipcMain);
console.log('dialog:', dialog);
