console.log('require.main:', require.main);
console.log('require.main.require:', require.main?.require);

if (require.main && require.main.require) {
  try {
    const electron = require.main.require('electron');
    console.log('require.main.require(electron):', electron);
  } catch (e) {
    console.log('require.main.require error:', e.message);
  }
}

try {
  const Module = require('module');
  const electron = Module._load('electron', require.main);
  console.log('Module._load(electron):', electron);
} catch (e) {
  console.log('Module._load error:', e.message);
}
