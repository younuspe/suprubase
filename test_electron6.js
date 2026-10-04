async function test() {
  const electron = await import('electron/main');
  console.log('electron:', electron);
  console.log('app:', electron.app);
  console.log('BrowserWindow:', electron.BrowserWindow);
  console.log('ipcMain:', electron.ipcMain);
}
test().catch(console.error);
