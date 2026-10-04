// Exact copy of default app's main.js pattern
import * as electron from 'electron/main';
console.log('electron:', electron);
console.log('keys:', Object.keys(electron));
console.log('app:', electron.app);
console.log('BrowserWindow:', electron.BrowserWindow);

const { app, BrowserWindow } = electron;

app.on('ready', () => {
  console.log('App ready!');
  const win = new BrowserWindow({ width: 800, height: 600 });
  console.log('Window created!');
  win.loadFile('src/renderer/index.html');
});
