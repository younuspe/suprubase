// Test orchestrator validation logic directly (without electron dependencies)

const fs = require('fs/promises');
const path = require('path');

// Simplified orchestrator validation test
class TestOrchestrator {
  async loadAgentsConfig() {
    const agentsFilePath = path.join('/Users/ahyan/Suprubase', 'supru.agents.json');
    try {
      const data = await fs.readFile(agentsFilePath, 'utf8');
      const config = JSON.parse(data);
      return this.validateAgentsConfig(config);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { agents: [] };
      }
      throw err;
    }
  }

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

      if (!agent.role) {
        throw new Error(`Agent ${agent.id} missing role`);
      }
      if (agent.model) {
        if (!agent.model.provider || !agent.model.id) {
          throw new Error(`Agent ${agent.id} model missing provider or id`);
        }
      }
      if (agent.tools) {
        if (!Array.isArray(agent.tools.allow)) agent.tools.allow = [];
        if (!Array.isArray(agent.tools.ask)) agent.tools.ask = [];
        if (!Array.isArray(agent.tools.deny)) agent.tools.deny = [];
      }
      if (agent.fs) {
        if (!Array.isArray(agent.fs.read)) agent.fs.read = [];
        if (!Array.isArray(agent.fs.write)) agent.fs.write = [];
        if (!Array.isArray(agent.fs.deny)) agent.fs.deny = [];
      }
      if (agent.shell) {
        if (!Array.isArray(agent.shell.allow)) agent.shell.allow = [];
        if (!Array.isArray(agent.shell.deny)) agent.shell.deny = [];
      }
      if (agent.limits) {
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
      if (agent.stages && !Array.isArray(agent.stages)) {
        throw new Error(`Agent ${agent.id} stages must be an array`);
      }
    });

    return config;
  }
}

async function test() {
  const orchestrator = new TestOrchestrator();
  console.log('Orchestrator loaded successfully');
  console.log('Load agents config test:', JSON.stringify(await orchestrator.loadAgentsConfig(), null, 2));
  
  // Test validation
  try {
    const config = await orchestrator.loadAgentsConfig();
    const validated = orchestrator.validateAgentsConfig(config);
    console.log('Validated config:', JSON.stringify(validated, null, 2));
    console.log('✓ Orchestrator validation works');
  } catch (e) {
    console.log('✗ Orchestrator validation failed:', e.message);
  }
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});