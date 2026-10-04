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
        encryptString: (str) => Buffer.from(str, 'utf8'),
        decryptString: (buf) => buf.toString('utf8')
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const secretsService = require('./src/main/secrets.js');

async function test() {
  console.log('Initial secrets Map:', secretsService.secrets);
  console.log('Initial secrets Map size:', secretsService.secrets.size);
  
  await secretsService.set('test_secret', 'test_value');
  console.log('After set, secrets Map:', secretsService.secrets);
  console.log('After set, secrets Map size:', secretsService.secrets.size);
  const value = await secretsService.get('test_secret');
  console.log('Get after set:', JSON.stringify(value));
  
  console.log('Before remove, has test_secret:', secretsService.secrets.has('test_secret'));
  console.log('Calling delete...');
  const deleteResult = secretsService.secrets.delete('test_secret');
  console.log('Delete result:', deleteResult);
  console.log('After delete, has test_secret:', secretsService.secrets.has('test_secret'));
  
  await secretsService.remove('test_secret');
  console.log('After remove, secrets Map:', secretsService.secrets);
  console.log('After remove, secrets Map size:', secretsService.secrets.size);
  console.log('After remove, has test_secret:', secretsService.secrets.has('test_secret'));
  const removedValue = await secretsService.get('test_secret');
  console.log('Get after remove:', JSON.stringify(removedValue));
  console.log('Type:', typeof removedValue);
}

test().catch(console.error);