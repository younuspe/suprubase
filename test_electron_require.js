console.log('process.electronRequire:', process.electronRequire);
console.log('module.createRequire:', module.createRequire);

// Try to create a require function for the electron dist
const electronPath = require('electron');
const distPath = electronPath.replace(/\/Electron$/, '');
console.log('distPath:', distPath);

try {
  const req = module.createRequire(distPath + '/Electron.app/Contents/Resources/');
  console.log('req:', req);
} catch (e) {
  console.log('createRequire error:', e.message);
}
