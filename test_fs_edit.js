// Mock electron app
const mockApp = {
  getPath: (type) => {
    if (type === 'userData') return '/tmp/test_userData';
    if (type === 'appData') return '/tmp/test_appData';
    return '/tmp';
  }
};

// Ensure test directory exists
const fs = require('fs');
if (!fs.existsSync('/tmp/test_userData')) {
  fs.mkdirSync('/tmp/test_userData', { recursive: true });
}

// Mock require for electron - must be done BEFORE any require() of our services
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'electron') {
    return { 
      app: mockApp,
      safeStorage: {
        encryptString: (str) => Buffer.from(str),
        decryptString: (buf) => buf.toString('utf8')
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const { fsService } = require('./src/main/fsService.js');
const path = require('path');

async function test() {
  await fsService.setProjectRoot('/Users/ahyan/Suprubase');
  
  const testFile = 'supru_test_file.txt';
  const fullPath = path.join('/Users/ahyan/Suprubase', testFile);
  
  // Clean up any existing file
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  
  await fsService.write(testFile, 'Hello World');
  const content = await fsService.read(testFile);
  console.log('After write:', JSON.stringify(content));
  
  const result = await fsService.edit(testFile, 'World', 'Supru');
  console.log('Edit result:', result);
  
  const editedContent = await fsService.read(testFile);
  console.log('After edit:', JSON.stringify(editedContent));
  
  // Cleanup
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

test().catch(console.error);