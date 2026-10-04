const electronLoader = require('./src/main/electron-loader');
electronLoader.then(({ app, BrowserWindow, ipcMain }) => {
  console.log('app:', !!app);
  console.log('BrowserWindow:', !!BrowserWindow);
  console.log('ipcMain:', !!ipcMain);
}).catch(console.error);