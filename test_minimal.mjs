import * as electron from 'electron/main';
console.log('electron:', electron);
console.log('keys:', Object.keys(electron));
console.log('app:', electron.app);
console.log('BrowserWindow:', electron.BrowserWindow);
console.log('ipcMain:', electron.ipcMain);

// Try to create a window
const { app, BrowserWindow } = electron;

app.on('ready', () => {
  console.log('App ready!');
  const win = new BrowserWindow({ width: 800, height: 600 });
  console.log('Window created:', !!win);
  win.loadFile('src/renderer/index.html');
});
