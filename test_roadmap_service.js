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

const { RoadmapService } = require('./src/main/roadmapService.js');

async function test() {
  const roadmapService = new RoadmapService();
  roadmapService.setProjectRoot('/Users/ahyan/Suprubase');
  
  // Test loadRoadmap
  const roadmap = await roadmapService.loadRoadmap();
  console.log('Roadmap loaded:', JSON.stringify(roadmap, null, 2));
  
  // Test listMilestones
  const milestones = await roadmapService.listMilestones();
  console.log('Milestones:', JSON.stringify(milestones, null, 2));
  
  // Test getMilestone
  const m0 = await roadmapService.getMilestone('M0');
  console.log('M0:', JSON.stringify(m0, null, 2));
  
  // Test tickMilestone (will modify the file)
  // await roadmapService.tickMilestone('M1');
  
  console.log('✓ RoadmapService tests passed');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});