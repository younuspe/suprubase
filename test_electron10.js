// Try various require paths
const paths = [
  'electron',
  'electron/main',
  'electron/renderer',
  'electron/common',
  'electron/main-process',
  'electron/main.js',
  'electron/browser',
];

for (const p of paths) {
  try {
    const mod = require(p);
    console.log(`require('${p}'):`, typeof mod, mod);
  } catch (e) {
    console.log(`require('${p}'): ERROR - ${e.message}`);
  }
}
