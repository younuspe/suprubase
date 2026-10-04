const { spawn } = require('child_process');
const electron = spawn('npx', ['electron', 'src/main/main.js'], { cwd: '/Users/ahyan/Suprubase', stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
electron.stdout.on('data', (data) => { stdout += data; });
electron.stderr.on('data', (data) => { stderr += data; });
setTimeout(() => {
  electron.kill();
  console.log('=== STDOUT ===');
  console.log(stdout);
  console.log('=== STDERR ===');
  console.log(stderr);
}, 10000);