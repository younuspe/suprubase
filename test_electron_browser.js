try {
  const browser = require('electron/browser');
  console.log('electron/browser:', browser);
} catch (e) {
  console.log('electron/browser error:', e.message);
}

try {
  const renderer = require('electron/renderer');
  console.log('electron/renderer:', renderer);
} catch (e) {
  console.log('electron/renderer error:', e.message);
}
