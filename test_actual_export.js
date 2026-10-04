// Mock the electron dependencies that cause issues
const mockApp = {
  getPath: () => '/tmp/test'
};

// Create a mock electron module
const mockElectron = {
  app: mockApp,
  safeStorage: {
    encryptString: (str) => {
      // Simple mock: return a buffer
      const { Buffer } = require('buffer');
      return Buffer.from(str);
    },
    decryptString: (buffer) => {
      // Simple mock: return string
      return buffer.toString();
    }
  }
};

// Store the original require
const originalRequire = require;

// Create a require function that mocks the problematic dependencies
const mockRequire = (moduleName) => {
  if (moduleName === 'electron') {
    return mockElectron;
  } else if (moduleName === './src/main/fsService') {
    return { fsService: { projectRoot: null } };
  } else if (moduleName === './src/main/settings') {
    return { loadSettings: () => {} };
  } else if (moduleName === './src/main/secrets') {
    return { secretsService: {} }; // We won't actually use it in this test
  } else if (moduleName === './src/main/gate') {
    return { Gate: class Gate {} }; // Return a dummy Gate class
  } else if (moduleName === './src/main/orchestrator') {
    return { Orchestrator: class Orchestrator {} }; // Return a dummy Orchestrator class
  } else {
    // Use the original require for everything else
    return originalRequire(moduleName);
  }
};

// Temporarily override require
require = mockRequire;

try {
  // Now require the actual file using our mock
  const rs = require('./src/main/roadmapService.js');

  console.log('Exported object:', rs);
  console.log('Type of exported object:', typeof rs);
  if (rs && typeof rs === 'object') {
    console.log('Keys in exported object:', Object.keys(rs));
    if (rs.RoadmapService !== undefined) {
      console.log('Type of rs.RoadmapService:', typeof rs.RoadmapService);
      console.log('Is rs.RoadmapService a function?', typeof rs.RoadmapService === 'function');
      console.log('Is rs.RoadmapService a class?', rs.RoadmapService instanceof Function);

      // Try to instantiate it
      try {
        const instance = new rs.RoadmapService();
        console.log('Successfully instantiated RoadmapService');
        console.log('Instance type:', typeof instance);
      } catch (e) {
        console.log('Failed to instantiate RoadmapService:', e.message);
      }
    }
  }
} finally {
  // Restore original require
  require = originalRequire;
}