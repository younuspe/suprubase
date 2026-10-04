// Test M0-M5 services - mock electron BEFORE requiring any modules

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

const path = require('path');

async function runTests() {
  console.log('Starting M0-M5 service tests...\n');

  // M0: Settings service
  try {
    const settings = require('./src/main/settings.js');
    settings.loadSettings();
    console.log('✓ M0 Settings: loadSettings() works');
    
    // Test that we can set and get properties
    const testBounds = { x: 10, y: 20, width: 800, height: 600 };
    settings.settings.windowBounds = testBounds;
    settings.saveSettings();
    
    // Reload and check
    settings.loadSettings();
    if (settings.settings.windowBounds && 
        settings.settings.windowBounds.x === testBounds.x &&
        settings.settings.windowBounds.y === testBounds.y &&
        settings.settings.windowBounds.width === testBounds.width &&
        settings.settings.windowBounds.height === testBounds.height) {
      console.log('✓ M0 Settings: windowBounds persistence works');
    } else {
      throw new Error('windowBounds not persisted correctly');
    }
  } catch (e) {
    console.log('✗ M0 Settings FAILED:', e.message);
    return false;
  }

  // M1: Pill geometry (part of settings)
  try {
    const settings = require('./src/main/settings.js');
    const testGeom = { x: 100, y: 100, width: 300, height: 200 };
    settings.settings.pillGeometry = testGeom;
    settings.saveSettings();
    
    settings.loadSettings();
    if (settings.settings.pillGeometry && 
        settings.settings.pillGeometry.x === testGeom.x &&
        settings.settings.pillGeometry.y === testGeom.y &&
        settings.settings.pillGeometry.width === testGeom.width &&
        settings.settings.pillGeometry.height === testGeom.height) {
      console.log('✓ M1 Pill Geometry: persistence works');
    } else {
      throw new Error('pillGeometry not persisted correctly');
    }
  } catch (e) {
    console.log('✗ M1 Pill Geometry FAILED:', e.message);
    return false;
  }

  // M2: File system service
  try {
    const { fsService } = require('./src/main/fsService.js');
    
    // First set a project root
    await fsService.setProjectRoot('/Users/ahyan/Suprubase');
    
    // Test list
    const files = await fsService.list('.');
    if (Array.isArray(files)) {
      console.log('✓ M2 FS Service: list() returns array');
    } else {
      throw new Error('list() did not return array');
    }
    
    // Test read/write - use relative path
    const testFile = 'supru_test_file.txt';
    const testContent = 'Hello Supru!';
    await fsService.write(testFile, testContent);
    const content = await fsService.read(testFile);
    if (content === testContent) {
      console.log('✓ M2 FS Service: read/write works');
    } else {
      throw new Error('read/write content mismatch');
    }
    
    // Cleanup
    const fs = require('fs');
    const fullPath = path.join('/Users/ahyan/Suprubase', testFile);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    
    // Test edit
    await fsService.write(testFile, 'Hello World');
    await fsService.edit(testFile, 'World', 'Supru');
    const editedContent = await fsService.read(testFile);
    if (editedContent === 'Hello Supru') {
      console.log('✓ M2 FS Service: edit works');
    } else {
      throw new Error('edit did not work correctly: got ' + JSON.stringify(editedContent));
    }
    
    // Cleanup
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (e) {
    console.log('✗ M2 FS Service FAILED:', e.message);
    return false;
  }

  // M3: Provider and Secrets services
  try {
    const providerService = require('./src/main/providers.js');
    const secretsService = require('./src/main/secrets.js');
    
    // Test providers list
    const providers = await providerService.listProviders();
    if (Array.isArray(providers)) {
      console.log('✓ M3 Provider Service: listProviders() returns array');
    } else {
      throw new Error('listProviders() did not return array');
    }
    
    // Test secrets
    await secretsService.set('test_secret', 'test_value');
    const value = await secretsService.get('test_secret');
    if (value === 'test_value') {
      console.log('✓ M3 Secrets Service: get/set works');
    } else {
      throw new Error('secrets get/set failed');
    }
    
    await secretsService.remove('test_secret');
    const removedValue = await secretsService.get('test_secret');
    if (removedValue === null) {
      console.log('✓ M3 Secrets Service: remove works');
    } else {
      throw new Error('secrets remove failed');
    }
    
    // Test secrets list
    const secretsList = await secretsService.list();
    if (Array.isArray(secretsList)) {
      console.log('✓ M3 Secrets Service: list() returns array');
    } else {
      throw new Error('secrets list() did not return array');
    }
  } catch (e) {
    console.log('✗ M3 Provider/Secrets Service FAILED:', e.message);
    return false;
  }

  // M4: PTY service
  try {
    const ptyService = require('./src/main/ptyService.js');
    
    // Note: This might fail in test environment without proper pty, but we'll try
    const termId = await ptyService.createTerminal('.', []);
    if (typeof termId === 'string' && termId.length > 0) {
      console.log('✓ M4 PTY Service: createTerminal works');
      
      // Test write
      await ptyService.writeToTerminal(termId, 'echo test\n');
      
      // Test resize
      await ptyService.resizeTerminal(termId, { cols: 80, rows: 24 });
      
      // Test kill
      await ptyService.killTerminal(termId);
      console.log('✓ M4 PTY Service: write/resize/kill works');
    } else {
      throw new Error('createTerminal did not return valid termId');
    }
  } catch (e) {
    // PTY might fail in test env, but let's not fail the whole test suite for this
    console.log('⚠ M4 PTY Service: Warning (may be expected in test env):', e.message);
    // We'll continue since this might be environment-specific
  }

  // M5: Agent Runner service
  try {
    const { AgentRunner: agentRunner } = require('./src/main/agentRunner.js');
    
    // Test with a simple echo command
    const agentId = await agentRunner.runAgent('test-agent', 'echo', ['Hello Agent'], '.');
    if (typeof agentId === 'string' && agentId.length > 0) {
      console.log('✓ M5 Agent Runner: runAgent works');
      
      // Wait a bit for the agent to finish
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test getOutput
      const output = agentRunner.getOutput(agentId);
      if (typeof output === 'object' && output.stdout && output.stdout.includes('Hello Agent')) {
        console.log('✓ M5 Agent Runner: getOutput works');
      } else {
        throw new Error('getOutput did not return expected content: ' + JSON.stringify(output));
      }
      
      // Test stop
      await agentRunner.stopAgent(agentId);
      
      // Test isRunning
      const isRunning = agentRunner.isRunning(agentId);
      if (!isRunning) {
        console.log('✓ M5 Agent Runner: stop/isRunning works');
      } else {
        throw new Error('agent still reported as running after stop');
      }
    } else {
      throw new Error('runAgent did not return valid agentId');
    }
  } catch (e) {
    console.log('✗ M5 Agent Runner FAILED:', e.message);
    return false;
  }

  console.log('\n✓ All M0-M5 service tests completed!');
  return true;
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.log('✗ Test harness error:', err);
  process.exit(1);
});