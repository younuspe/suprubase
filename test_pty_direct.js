// Test PTY service directly with proper environment
const pty = require('node-pty');
const path = require('path');

console.log('Testing node-pty directly...');

try {
  const term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cwd: '/Users/ahyan/Suprubase',
    env: process.env
  });

  term.onData((data) => {
    console.log('PTY data:', data);
  });

  term.onExit((code) => {
    console.log('PTY exited with code:', code);
  });

  term.write('echo "Hello PTY"\n');
  
  setTimeout(() => {
    term.kill();
    console.log('PTY killed');
  }, 1000);
  
  console.log('PTY created successfully');
} catch (err) {
  console.error('PTY error:', err.message);
  console.error('Stack:', err.stack);
}