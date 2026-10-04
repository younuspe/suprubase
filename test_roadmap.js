// Mock the dependencies
const mockFsService = {
  projectRoot: null
};

const mockSettings = {
  loadSettings: () => {}
};

// Temporarily replace the dependencies
const fsService = mockFsService;
const settings = mockSettings;
const path = require('path');
const fs = require('fs/promises');

// Now define the class as in the file
class RoadmapService {
  constructor() {
    this.roadmap = null; // { milestones: [] }
    this.projectRoot = null;
  }

  /**
   * Set the project root for the roadmap service
   * @param {string} rootPath - The project root path
   */
  setProjectRoot(rootPath) {
    this.projectRoot = rootPath;
    this.roadmap = null; // Reset cached roadmap
  }

  /**
   * Load and parse the ROADMAP.md file from the project root
   * @returns {Promise<Object>} The parsed roadmap object
   */
  async loadRoadmap() {
    if (!this.projectRoot) {
      throw new Error('No project root set');
    }
    const roadmapPath = path.join(this.projectRoot, 'ROADMAP.md');
    try {
      const data = await fs.readFile(roadmapPath, 'utf8');
      return this.parseRoadmap(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { milestones: [] }; // No roadmap is valid
      }
      throw err;
    }
  }

  /**
   * Parse the ROADMAP.md content
   * @param {string} content - The markdown content
   * @returns {Object} Parsed roadmap with milestones
   */
  parseRoadmap(content) {
    const milestones = [];
    const lines = content.split('\n');
    let currentMilestone = null;
    let currentCheckboxes = [];

    for (const line of lines) {
      // Match milestone heading: ## M2 - Name
      const headingMatch = line.match(/^##\s+(M\d+)\s+-\s+(.+)$/);
      if (headingMatch) {
        // Save previous milestone
        if (currentMilestone) {
          milestones.push({
            id: headingMatch[1],
            name: headingMatch[2],
            checkboxes: currentCheckboxes
          });
        }
        // Start new milestone
        currentMilestone = { id: headingMatch[1], name: headingMatch[2] };
        currentCheckboxes = [];
        continue;
      }

      // Match checkbox: - [ ] or - [x]
      const checkboxMatch = line.match(/^\s*-\s*\[([ x])\]\s+(.+)$/);
      if (checkboxMatch && currentMilestone) {
        const checked = checkboxMatch[1] === 'x';
        currentCheckboxes.push({
          text: checkboxMatch[2],
          checked
        });
      }
    }

    // Don't forget the last milestone
    if (currentMilestone) {
      milestones.push({
        id: currentMilestone.id,
        name: currentMilestone.name,
        checkboxes: currentCheckboxes
      });
    }

    return { milestones };
  }
}

// Now test what happens when we export and instantiate
console.log('Testing RoadmapService class:');
console.log('Type of RoadmapService:', typeof RoadmapService);
console.log('Is RoadmapService a function?', typeof RoadmapService === 'function');
console.log('Is RoadmapService a class?', RoadmapService instanceof Function);

// Test instantiation
try {
  const instance = new RoadmapService();
  console.log('Successfully instantiated RoadmapService');
  console.log('Instance type:', typeof instance);
} catch (e) {
  console.log('Failed to instantiate RoadmapService:', e.message);
}

// Test export
const exportObj = { RoadmapService };
console.log('\\nTesting export:');
console.log('Export object:', exportObj);
console.log('Type of export.RoadmapService:', typeof exportObj.RoadmapService);
console.log('Is export.RoadmapService a function?', typeof exportObj.RoadmapService === 'function');

// Test destructuring
const { RoadmapService: DestructuredRoadmapService } = exportObj;
console.log('\\nTesting destructuring:');
console.log('Type of DestructuredRoadmapService:', typeof DestructuredRoadmapService);
console.log('Is DestructuredRoadmapService a function?', typeof DestructuredRoadmapService === 'function');

try {
  const instance = new DestructuredRoadmapService();
  console.log('Successfully instantiated via destructuring');
} catch (e) {
  console.log('Failed to instantiate via destructuring:', e.message);
}