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
  
  await secretsService.set('test_secret', 'test_value');
  console.log('After set, secrets Map:', secretsService.secrets);
  console.log('File after set:', fs.readFileSync('/tmp/test_userData/secrets.json', 'utf8'));
  
  console.log('Calling delete directly...');
  const result = secretsService.secrets.delete('test_secret');
  console.log('Delete result:', result);
  console.log('After direct delete, secrets Map:', secretsService.secrets);
  
  console.log('Calling saveSecrets...');
  await secretsService.saveSecrets();
  console.log('After saveSecrets, secrets Map:', secretsService.secrets);
  console.log('File after saveSecrets:', fs.readFileSync('/tmp/test_userData/secrets.json', 'utf8'));
  
  console.log('Calling loadSecrets...');
  await secretsService.loadSecrets();
  console.log('After loadSecrets, secrets Map:', secretsService.secrets);
}

test().catch(console.error);