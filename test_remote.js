// Try to access remote
try {
  const remote = require('@electron/remote');
  console.log('@electron/remote:', remote);
} catch (e) {
  console.log('@electron/remote error:', e.message);
}

try {
  const remoteMain = require('@electron/remote/main');
  console.log('@electron/remote/main:', remoteMain);
} catch (e) {
  console.log('@electron/remote/main error:', e.message);
}
