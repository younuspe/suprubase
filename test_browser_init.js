try {
  const browserInit = require('electron/js2c/browser_init');
  console.log('browser_init:', browserInit);
} catch (e) {
  console.log('browser_init error:', e.message);
}

try {
  const nodeInit = require('electron/js2c/node_init');
  console.log('node_init:', nodeInit);
} catch (e) {
  console.log('node_init error:', e.message);
}

try {
  const isolatedBundle = require('electron/js2c/isolated_bundle');
  console.log('isolated_bundle:', isolatedBundle);
} catch (e) {
  console.log('isolated_bundle error:', e.message);
}
