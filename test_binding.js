console.log('process.electronBinding:', process.electronBinding);
if (process.electronBinding) {
  console.log('keys:', Object.keys(process.electronBinding));
}

// Check if there's a module cache for electron
console.log('require.cache keys (electron):', Object.keys(require.cache).filter(k => k.includes('electron')));
