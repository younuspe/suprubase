// Test PTY in the real Electron app context
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Create a minimal Electron app to test PTY
const mockApp = {
  getPath: (type) => {
    if (type === 'userData') return '/tmp/test_userData_real';
    if (type === 'appData') return '/tmp/test_appData_real';
    return '/tmp';
  },
  on: () => {},
  whenReady: () => Promise.resolve(),
  quit: () => {}
};

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'electron') {
    return { 
      app: mockApp,
      BrowserWindow: class {
        constructor() {
          this.webContents = {
            send: () => {},
            on: () => {}
          };
        }
        loadFile() {}
        loadURL() {}
        on() {}
        once() {}
        isDestroyed() { return false; }
      },
      ipcMain: require('events').EventEmitter.prototype,
      safeStorage: {
        encryptString: (str) => Buffer.from(str),
        decryptString: (buf) => buf.toString('utf8')
      },
      dialog: {
        showOpenDialog: () => Promise.resolve({ filePaths: [] })
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const fs = require('fs');
if (!fs.existsSync('/tmp/test_userData_real')) {
  fs.mkdirSync('/tmp/test_userData_real', { recursive: true });
}

// Now require ptyService
const ptyService = require('./src/main/ptyService.js');

async function testPTY() {
  console.log('=== Testing PTY in Electron Context ===\n');
  
  try {
    console.log('Test 1: Create PTY session...');
    const sessionId = await ptyService.createTerminal('/Users/ahyan/Suprubase', []);
    console.log('PTY session created:', sessionId);
    
    console.log('\nTest 2: Write to PTY...');
    ptyService.writeToTerminal(sessionId, 'pwd\n');
    
    await new Promise(r => setTimeout(r, 500));
    
    console.log('\nTest 3: Write git status...');
    ptyService.writeToTerminal(sessionId, 'git status\n');
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('\nTest 4: Kill PTY...');
    ptyService.killTerminal(sessionId);
    console.log('PTY killed');
    
    console.log('\n✓ PTY tests completed');
  } catch (err) {
    console.error('PTY test error:', err.message);
    console.error(err.stack);
  }
}

testPTY();