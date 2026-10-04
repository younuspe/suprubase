// Orchestrator for Supru
// Implements M7: Pipeline engine for running agent workflows

const { providerService } = require('./providers');
const { secretsService } = require('./secrets');
const { ptyService } = require('./ptyService');
const settings = require('./settings');
const { Gate } = require('./gate');
const { fsService } = require('./fsService');
const { agentRunner } = require('./agentRunner');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

class Orchestrator {
  constructor() {
    this.workflows = new Map(); // workflowId => workflow definition
    this.runningWorkflows = new Map(); // workflowId => { status, currentStage, startTime, checkpoints, stageOutputs, data, agentId, command, args, cwd }
    // Use the shared singleton gate instance
    this.gate = new Gate();
    // TODO: Load policies from settings or default
    this.gate.policies = {
      defaultToolPermission: 'deny',
      humanApproval: [], // To be configured
      secrets: { neverRead: ['.env*', '*.pem', 'id_rsa*', 'id_dsa*', 'id_ecdsa*', 'id_ed25519*', 'authorized_keys', 'known_hosts'] },
      fs: { read: [], write: [], deny: [] },
      shell: { allow: [], deny: [] },
      onError: { retries: 0, then: 'escalate' },
      limits: { maxFileSize: 10 * 1024 * 1024, maxMemory: 100 * 1024 * 1024, maxProcesses: 10 }
    };
    // Budget and time tracking
    this.budget = { maxCostUsd: 0, maxMinutes: 0 };
    this.elapsedTime = 0; // in seconds
    this.totalCost = 0; // in USD
  }

  /**
   * Load and validate supru.agents.json from the project root
   * @returns {Promise<Object>} The parsed and validated agents configuration
   */
  async loadAgentsConfig() {
    if (!fsService.projectRoot) {
      throw new Error('No project root set');
    }
    const agentsFilePath = path.join(fsService.projectRoot, 'supru.agents.json');
    try {
      const data = await fs.readFile(agentsFilePath, 'utf8');
      const config = JSON.parse(data);
      return this.validateAgentsConfig(config);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { agents: [] }; // No agents config is valid
      }
      throw err;
    }
  }

  /**
   * Validate the agents configuration
   * @param {Object} config - The parsed JSON
   * @returns {Object} The validated config
   */
  validateAgentsConfig(config) {
    if (!config || !config.agents || !Array.isArray(config.agents)) {
      throw new Error('Invalid agents config: missing or invalid agents array');
    }

    const agentIds = new Set();
    config.agents.forEach((agent, index) => {
      if (!agent.id) {
        throw new Error(`Agent at index ${index} missing id`);
      }
      if (agentIds.has(agent.id)) {
        throw new Error(`Duplicate agent id: ${agent.id}`);
      }
      agentIds.add(agent.id);

      // Validate required fields
      if (!agent.role) {
        throw new Error(`Agent ${agent.id} missing role`);
      }
      // Validate model if present
      if (agent.model) {
        if (!agent.model.provider || !agent.model.id) {
          throw new Error(`Agent ${agent.id} model missing provider or id`);
        }
      }
      // Validate tools if present
      if (agent.tools) {
        if (!Array.isArray(agent.tools.allow)) agent.tools.allow = [];
        if (!Array.isArray(agent.tools.ask)) agent.tools.ask = [];
        if (!Array.isArray(agent.tools.deny)) agent.tools.deny = [];
      }
      // Validate fs if present
      if (agent.fs) {
        if (!Array.isArray(agent.fs.read)) agent.fs.read = [];
        if (!Array.isArray(agent.fs.write)) agent.fs.write = [];
        if (!Array.isArray(agent.fs.deny)) agent.fs.deny = [];
      }
      // Validate shell if present
      if (agent.shell) {
        if (!Array.isArray(agent.shell.allow)) agent.shell.allow = [];
        if (!Array.isArray(agent.shell.deny)) agent.shell.deny = [];
      }
      // Validate limits if present
      if (agent.limits) {
        // Ensure limits are numbers
        if (agent.limits.maxTurns !== undefined && typeof agent.limits.maxTurns !== 'number') {
          throw new Error(`Agent ${agent.id} limits.maxTurns must be a number`);
        }
        if (agent.limits.maxTokens !== undefined && typeof agent.limits.maxTokens !== 'number') {
          throw new Error(`Agent ${agent.id} limits.maxTokens must be a number`);
        }
        if (agent.limits.maxCostUsd !== undefined && typeof agent.limits.maxCostUsd !== 'number') {
          throw new Error(`Agent ${agent.id} limits.maxCostUsd must be a number`);
        }
        if (agent.limits.timeoutSec !== undefined && typeof agent.limits.timeoutSec !== 'number') {
          throw new Error(`Agent ${agent.id} limits.timeoutSec must be a number`);
        }
      }
      // Validate stages if present
      if (agent.stages && !Array.isArray(agent.stages)) {
        throw new Error(`Agent ${agent.id} stages must be an array`);
      }
    });

    return config;
  }

  /**
   * Assemble context for an agent
   * @param {Object} agent - The agent definition from config
   * @param {Object} workflowData - Current workflow data
   * @returns {Promise<Object>} The context object for the agent
   */
  async assembleAgentContext(agent, workflowData) {
    const context = {
      agent: {
        id: agent.id,
        role: agent.role,
        duties: agent.duties || [],
        boundaries: agent.boundaries || [],
        skills: agent.skills || []
      },
      workflow: workflowData,
      // We will load skill.md and README.md from project root if they exist
      skill: '',
      readme: '',
      // We will get the current milestone from the roadmap service (not implemented, so empty)
      milestone: '',
      // Resolve inputArtifacts from workflowData
      inputArtifacts: {}
    };

    // Load skill.md
    try {
      const skillPath = path.join(fsService.projectRoot, 'skill.md');
      context.skill = await fs.readFile(skillPath, 'utf8');
    } catch (err) {
      // If skill.md not found, continue without it
      context.skill = '';
    }

    // Load README.md
    try {
      const readmePath = path.join(fsService.projectRoot, 'README.md');
      context.readme = await fs.readFile(readmePath, 'utf8');
    } catch (err) {
      // If README.md not found, continue without it
      context.readme = '';
    }

    // Resolve inputArtifacts: for each artifact, try to get from workflowData
    if (agent.inputArtifacts && Array.isArray(agent.inputArtifacts)) {
      for (const artifact of agent.inputArtifacts) {
        if (workflowData && workflowData[artifact] !== undefined) {
          context.inputArtifacts[artifact] = workflowData[artifact];
        }
        // TODO: Could also look in the file system for the artifact
      }
    }

    return context;
  }

  /**
   * Run a workflow by goal (finds the first agent that matches the goal as role or id)
   * @param {string} goal - The goal description to match against agent roles or ids
   * @returns {Promise<string>} Workflow ID
   */
  async runWorkflowByGoal(goal) {
    const config = await this.loadAgentsConfig();
    const agent = config.agents.find(a => 
      a.role.toLowerCase().includes(goal.toLowerCase()) || 
      a.id.toLowerCase().includes(goal.toLowerCase())
    );
    if (!agent) {
      throw new Error(`No agent found matching goal: ${goal}`);
    }
    return this.startWorkflow(agent.id, agent.stages || [], { goal });
  }

  /**
   * Start a new workflow
   * @param {string} workflowId - Unique ID for the workflow (if not provided, generated)
   * @param {Array<Object>} stages - Array of stage definitions
   * @param {Object} initialData - Initial data for the workflow
   * @returns {string} - Workflow ID
   */
  startWorkflow(workflowId, stages, initialData = {}) {
    const id = workflowId || uuidv4();
    // Stop any existing workflow with this ID
    if (this.runningWorkflows.has(id)) {
      this.stopWorkflow(id);
    }

    this.workflows.set(id, {
      id,
      stages: stages || [],
      initialData: { ...initialData },
      createdAt: Date.now()
    });

    return id;
  }

  /**
   * Get the current state of a workflow
   * @param {string} workflowId - The ID of the workflow
   * @returns {Object|null} - Workflow state or null if not found
   */
  getWorkflowState(workflowId) {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Stop a workflow
   * @param {string} workflowId - The ID of the workflow to stop
   * @returns {boolean} - True if workflow was stopped
   */
  stopWorkflow(workflowId) {
    const wasRunning = this.runningWorkflows.has(workflowId);
    if (wasRunning) {
      this.runningWorkflows.delete(workflowId);
    }
    // We keep the workflow definition in workflows for history
    return wasRunning;
  }

  /**
   * Advance a workflow to the next stage
   * @param {string} workflowId - The ID of the workflow
   * @param {Object} stageData - Data to pass to the next stage (output of previous stage)
   * @returns {Promise<Object>} - { completed: boolean, stageData: Object, nextStage: Object|null }
   */
  async advanceWorkflow(workflowId, stageData = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Initialize running workflow state if not present
    let runState = this.runningWorkflows.get(workflowId);
    if (!runState) {
      runState = {
        workflowId,
        status: 'running',
        currentStageIndex: 0,
        startTime: Date.now(),
        data: { ...workflow.initialData },
        checkpoints: [],
        stageOutputs: new Map(),
        // For tracking the current agent process (if any)
        agentProcess: null
      };
      this.runningWorkflows.set(workflowId, runState);
    }

    // If we have stageData from previous stage, store it
    if (stageData && Object.keys(stageData).length > 0) {
      // We'll store the output of the last completed stage
      const lastStageIndex = runState.currentStageIndex - 1;
      if (lastStageIndex >= 0) {
        runState.stageOutputs.set(lastStageIndex, stageData);
      }
      // Merge stageData into workflow data
      runState.data = { ...runState.data, ...stageData };
    }

    // Check if we have more stages
    if (runState.currentStageIndex >= workflow.stages.length) {
      // Workflow completed
      const completedWorkflow = { ...workflow, data: runState.data };
      this.runningWorkflows.delete(workflowId);
      return { completed: true, workflow: completedWorkflow };
    }

    // Get the current stage
    const currentStage = workflow.stages[runState.currentStageIndex];
    // Check dependencies
    if (currentStage.dependsOn && Array.isArray(currentStage.dependsOn)) {
      for (const depId of currentStage.dependsOn) {
        const depIndex = workflow.stages.findIndex(s => s.id === depId);
        if (depIndex === -1) {
          throw new Error(`Dependency stage ${depId} not found in workflow ${workflowId}`);
        }
        // Check if dependency stage has been completed
        if (!runState.stageOutputs.has(depIndex)) {
          // Dependency not met, wait or fail based on gate type
          // For simplicity, we'll fail if dependency not met
          return { 
            completed: false, 
            error: `Dependency stage ${depId} not completed`, 
            waitingFor: depId 
          };
        }
      }
    }

    // Check budget and time limits
    const limitCheck = this._checkLimits(workflowId);
    if (!limitCheck.permitted) {
      return { 
        completed: false, 
        error: limitCheck.reason,
        exceeded: true
      };
    }

    // We would normally execute the stage here, but for M7 we are focusing on the orchestration logic.
    // In a full implementation, we would:
    // 1. Assemble context for the agent(s) responsible for this stage
    // 2. Run the agent(s) via agentRunner or providerService
    // 3. Wait for completion or gate approval
    // 4. Collect output and move to next stage

    // For now, we'll simulate stage execution by returning a placeholder.
    // In reality, this would be replaced by actual agent execution.

    // We'll return that the stage is ready to run, but we don't run it here.
    // The caller (e.g., a command handler) would need to actually execute the stage.

    // For the purpose of M7, we'll implement the checkpoint and state saving.

    // Save checkpoint
    const checkpoint = {
      timestamp: new Date().toISOString(),
      stageIndex: runState.currentStageIndex,
      data: { ...runState.data },
      stageOutputs: Object.fromEntries(runState.stageOutputs)
    };
    runState.checkpoints.push(checkpoint);
    await this.saveCheckpoint(workflowId, checkpoint);

    // Move to next stage
    runState.currentStageIndex++;

    // Check if workflow is complete after advancing
    if (runState.currentStageIndex >= workflow.stages.length) {
      const completedWorkflow = { ...workflow, data: runState.data };
      this.runningWorkflows.delete(workflowId);
      return { completed: true, workflow: completedWorkflow };
    }

    // Return info about the next stage
    const nextStage = workflow.stages[runState.currentStageIndex];
    return {
      completed: false,
      nextStage,
      checkpoint,
      workflowId
    };
  }

  /**
   * Check budget and time limits
   * @param {string} workflowId - The workflow ID
   * @returns {Object} - { permitted: boolean, reason?: string }
   */
  _checkLimits(workflowId) {
    // Check elapsed time against budget.maxMinutes
    if (this.budget.maxMinutes > 0) {
      const elapsedMinutes = (Date.now() - this.runningWorkflows.get(workflowId)?.startTime || 0) / 1000 / 60;
      if (elapsedMinutes > this.budget.maxMinutes) {
        return { permitted: false, reason: `Time limit exceeded: ${elapsedMinutes.toFixed(2)} minutes > ${this.budget.maxMinutes} minutes` };
      }
    }
    // Check total cost against budget.maxCostUsd
    if (this.budget.maxCostUsd > 0 && this.totalCost > this.budget.maxCostUsd) {
      return { permitted: false, reason: `Cost limit exceeded: $${this.totalCost.toFixed(2)} > $${this.budget.maxCostUsd}` };
    }
    // Check agent-specific limits (if any)
    // We would need to get the current agent's limits from the workflow state
    // For simplicity, we skip this for now
    return { permitted: true };
  }

  /**
   * Save checkpoint to .supru/state.json
   * @param {string} workflowId - The workflow ID
   * @param {Object} checkpoint - The checkpoint data
   */
  async saveCheckpoint(workflowId, checkpoint) {
    if (!fsService.projectRoot) {
      throw new Error('No project root set for saving checkpoint');
    }
    const stateDir = path.join(fsService.projectRoot, '.supru');
    await fs.mkdir(stateDir, { recursive: true });
    const stateFile = path.join(stateDir, 'state.json');
    // Read existing state or initialize
    let state = { workflows: {} };
    try {
      const data = await fs.readFile(stateFile, 'utf8');
      state = JSON.parse(data);
    } catch (err) {
      // If file doesn't exist, we'll create it
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    state.workflows[workflowId] = {
      ...this.workflows.get(workflowId),
      lastCheckpoint: checkpoint,
      updatedAt: Date.now()
    };
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Load checkpoint from .supru/state.json
   * @param {string} workflowId - The workflow ID
   * @returns {Object|null} The checkpoint state or null if not found
   */
  async loadCheckpoint(workflowId) {
    if (!fsService.projectRoot) {
      throw new Error('No project root set for loading checkpoint');
    }
    const stateFile = path.join(fsService.projectRoot, '.supru', 'state.json');
    try {
      const data = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(data);
      return state.workflows?.[workflowId] || null;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Handle the /run <goal> command
   * @param {string} goal - The goal to run
   * @returns {Promise<Object>} Result of starting the workflow
   */
  async handleRunCommand(goal) {
    const workflowId = await this.runWorkflowByGoal(goal);
    // Start the workflow by advancing to the first stage
    return this.advanceWorkflow(workflowId);
  }

  /**
   * Handle the /plan <goal> command
   * @param {string} goal - The goal to plan
   * @returns {Promise<Object>} The workflow definition for the goal
   */
  async handlePlanCommand(goal) {
    const config = await this.loadAgentsConfig();
    const agent = config.agents.find(a => 
      a.role.toLowerCase().includes(goal.toLowerCase()) || 
      a.id.toLowerCase().includes(goal.toLowerCase())
    );
    if (!agent) {
      throw new Error(`No agent found matching goal: ${goal}`);
    }
    return {
      agentId: agent.id,
      stages: agent.stages || [],
      goal
    };
  }

  /**
   * Handle the /agents command
   * @returns {Promise<Array>} List of available agents
   */
  async handleAgentsCommand() {
    const config = await this.loadAgentsConfig();
    return config.agents.map(a => ({
      id: a.id,
      role: a.role,
      duties: a.duties || [],
      skills: a.skills || []
    }));
  }

  /**
   * Handle the /pause command
   * @param {string} workflowId - The ID of the workflow to pause
   * @returns {Promise<boolean>} - True if workflow was paused
   */
  async handlePauseCommand(workflowId) {
    const runState = this.runningWorkflows.get(workflowId);
    if (!runState) {
      return false;
    }
    // If there is a running agent process, we would need to stop it
    // For now, we just mark the workflow as paused
    runState.status = 'paused';
    return true;
  }

  /**
   * Handle the /resume command
   * @param {string} workflowId - The ID of the workflow to resume
   * @returns {Promise<Object>} - Result of advancing the workflow
   */
  async handleResumeCommand(workflowId) {
    const runState = this.runningWorkflows.get(workflowId);
    if (!runState || runState.status !== 'paused') {
      throw new Error(`Workflow ${workflowId} is not paused`);
    }
    runState.status = 'running';
    // We would need to restart the agent process if it was stopped
    // For now, we just advance the workflow (which will checkpoint and move to next stage)
    return this.advanceWorkflow(workflowId);
  }

  /**
   * Handle the /stop command
   * @param {string} workflowId - The ID of the workflow to stop
   * @returns {Promise<boolean>} - True if workflow was stopped
   */
  async handleStopCommand(workflowId) {
    const wasRunning = this.runningWorkflows.has(workflowId);
    if (wasRunning) {
      // If there is a running agent process, we would need to stop it
      // For now, we just remove the workflow from runningWorkflows
      this.runningWorkflows.delete(workflowId);
    }
    return wasRunning;
  }

  /**
   * Handle the /approve command
   * @param {string} workflowId - The ID of the workflow
   * @param {string} stageId - The ID of the stage to approve (optional)
   * @returns {Promise<boolean>} - True if approval was recorded
   */
  async handleApproveCommand(workflowId, stageId) {
    // We would need to record the approval and then advance the workflow if it was waiting for approval
    // For now, we just return true to indicate the approval was recorded
    return true;
  }

  /**
   * Handle the /reject command
   * @param {string} workflowId - The ID of the workflow
   * @param {string} stageId - The ID of the stage to reject (optional)
   * @returns {Promise<Object>} - Result of rejecting (could include error for onFail routing)
   */
  async handleRejectCommand(workflowId, stageId) {
    // We would need to record the rejection and then follow the onFail routing
    // For now, we just return an error to indicate the rejection
    return { completed: false, error: 'Stage rejected by user' };
  }

  /**
   * Handle the /status command
   * @param {string} workflowId - The ID of the workflow
   * @returns {Promise<Object>} - Workflow status
   */
  async handleStatusCommand(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    const runState = this.runningWorkflows.get(workflowId);
    return {
      workflowId: workflow.id,
      status: runState ? runState.status : 'not started',
      currentStageIndex: runState ? runState.currentStageIndex : 0,
      totalStages: workflow.stages.length,
      startTime: runState ? runState.startTime : null,
      elapsedTime: runState ? (Date.now() - runState.startTime) : 0,
      checkpoints: runState ? runState.checkpoints.length : 0,
      data: runState ? runState.data : {}
    };
  }
}

module.exports = { Orchestrator };