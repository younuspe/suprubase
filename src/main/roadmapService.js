// Roadmap service for Supru
// Implements M8: Roadmap-driven projects

const { Orchestrator } = require('./orchestrator');
const { fsService } = require('./fsService');
const settings = require('./settings');
const path = require('path');
const fs = require('fs/promises');

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

  /**
   * Get the list of milestones with their completion status
   * @returns {Promise<Array>} Array of milestones with id, name, and completed (boolean)
   */
  async listMilestones() {
    const roadmap = await this.loadRoadmap();
    return roadmap.milestones.map(milestone => ({
      id: milestone.id,
      name: milestone.name,
      completed: milestone.checkboxes.every(cb => cb.checked)
    }));
  }

  /**
   * Get a specific milestone by ID
   * @param {string} milestoneId - The milestone ID (e.g., 'M2')
   * @returns {Promise<Object>} The milestone object or null if not found
   */
  async getMilestone(milestoneId) {
    const roadmap = await this.loadRoadmap();
    return roadmap.milestones.find(m => m.id === milestoneId) || null;
  }

  /**
   * Run a milestone through the pipeline
   * @param {string} milestoneId - The milestone ID to run
   * @returns {Promise<Object>} Result of running the milestone
   */
  async runMilestone(milestoneId) {
    // Use the orchestrator to run a workflow by goal (milestoneId)
    // This assumes that the milestone ID can be used as a goal to find an agent
    try {
      // Start the workflow by goal
      const orchestratorInstance = new Orchestrator();
      const workflowResult = await orchestratorInstance.runWorkflowByGoal(milestoneId);
      // If we get here, the workflow started successfully
      // We would normally wait for completion, but for now we return the start result
      return {
        started: true,
        workflowId: workflowResult.workflowId || null,
        message: `Started milestone ${milestoneId}`
      };
    } catch (err) {
      // If the orchestrator fails to find an agent, we might need to create a roadmap
      // For now, we just throw the error
      throw err;
    }
  }

  /**
   * Mark a milestone as completed by checking all its checkboxes
   * @param {string} milestoneId - The milestone ID to mark as completed
   * @returns {Promise<boolean>} True if successful
   */
  async tickMilestone(milestoneId) {
    if (!this.projectRoot) {
      throw new Error('No project root set');
    }
    const roadmapPath = path.join(this.projectRoot, 'ROADMAP.md');
    const data = await fs.readFile(roadmapPath, 'utf8');
    const updated = this.updateCheckboxes(data, milestoneId, true);
    await fs.writeFile(roadmapPath, updated);
    return true;
  }

  /**
   * Update the checkboxes for a given milestone in the markdown content
   * @param {string} content - The original markdown content
   * @param {string} milestoneId - The milestone ID to update
   * @param {boolean} checked - The new checked state
   * @returns {string} The updated markdown content
   */
  updateCheckboxes(content, milestoneId, checked) {
    const lines = content.split('\n');
    let inMilestone = false;
    const updatedLines = [];

    for (const line of lines) {
      // Check if we are entering the target milestone
      const headingMatch = line.match(/^##\s+(M\d+)\s+-\s+(.+)$/);
      if (headingMatch) {
        inMilestone = (headingMatch[1] === milestoneId);
        updatedLines.push(line);
        continue;
      }

      // If we are in the target milestone and this line is a checkbox, update it
      if (inMilestone) {
        const checkboxMatch = line.match(/^(\s*-\s*\[])([ x])(\]\s+.+)$/);
        if (checkboxMatch) {
          const newLine = checkboxMatch[1] + (checked ? 'x' : ' ') + checkboxMatch[3];
          updatedLines.push(newLine);
          continue;
        }
      }

      // If we hit another milestone heading, we leave the current milestone
      if (line.match(/^##\s+M\d+\s+-\s+/)) {
        inMilestone = false;
      }

      updatedLines.push(line);
    }

    return updatedLines.join('\n');
  }

  /**
   * Handle the case when there is no roadmap for a big goal
   * This would involve creating a planner agent to draft a roadmap and wait for approval
   * For now, we return a placeholder indicating this is not implemented
   */
  async draftRoadmapForGoal(goal) {
    // This is a placeholder for the planner functionality
    // In a full implementation, we would use the orchestrator to run a planner agent
    // that creates a ROADMAP.md based on the goal, then waits for approval
    return {
      drafted: false,
      message: 'Roadmap drafting not yet implemented'
    };
  }
}

module.exports = { RoadmapService };