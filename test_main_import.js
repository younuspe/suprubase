// Mock the electron dependencies that cause issues
const mockApp = {
  getPath: () => '/tmp/test'
};

// Create a mock electron module
const mockElectron = {
  app: mockApp,
  safeStorage: {
    encryptString: (str) => {
      const { Buffer } = require('buffer');
      return Buffer.from(str);
    },
    decryptString: (buffer) => {
      return buffer.toString();
    }
  }
};

// Mock other dependencies that might cause issues
const mockFsService = {
  projectRoot: null
};

const mockSettings = {
  loadSettings: () => {}
};

// Create a require function that mocks the problematic dependencies
const mockRequire = (moduleName) => {
  if (moduleName === 'electron') {
    return mockElectron;
  } else if (moduleName === './src/main/fsService') {
    return { fsService: mockFsService };
  } else if (moduleName === './src/main/settings') {
    return mockSettings;
  } else if (moduleName === './src/main/secrets') {
    return { secretsService: {} }; // We won't actually use it in this test
  } else if (moduleName === './src/main/gate') {
    return { Gate: class Gate {} }; // Return a dummy Gate class
  } else if (moduleName === './src/main/orchestrator') {
    return { Orchestrator: class Orchestrator {} }; // Return a dummy Orchestrator class
  } else {
    return require(moduleName);
  }
};

// Now test the exact import that main.js does
console.log('Testing the exact import from main.js:');
const { RoadmapService } = mockRequire('./src/main/roadmapService');

console.log('Type of RoadmapService:', typeof RoadmapService);
console.log('Is RoadmapService a function?', typeof RoadmapService === 'function');
console.log('Is RoadmapService a class?', RoadmapService instanceof Function);

// Try to instantiate it
try {
  const instance = new RoadmapService();
  console.log('Successfully instantiated RoadmapService');
  console.log('Instance type:', typeof instance);
} catch (e) {
  console.log('Failed to instantiate RoadmapService:', e.message);
  console.log('Error stack:', e.stack);
}