const path = require('path');
console.log('resolve electron:', require.resolve('electron'));
const { app, BrowserWindow, ipcMain } = require('electron');
console.log('app:', !!app);
console.log('BrowserWindow:', !!BrowserWindow);
console.log('ipcMain:', !!ipcMain);