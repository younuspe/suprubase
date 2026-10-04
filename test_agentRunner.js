const { AgentRunner } = require('./src/main/agentRunner.js');

(async () => {
  try {
    const agentId = 'test-agent';
    // Run a simple command that outputs JSON lines
    const args = ['-c', 'echo \\'{"type": "test", "content": "hello"}\\'; echo \\'{"type": "test", "content": "world"}\\''];
    await AgentRunner.runAgent(agentId, 'bash', args, process.cwd());
    // Wait a bit to get output
    setTimeout(() => {
      const output = AgentRunner.getOutput(agentId);
      console.log('Output:', output);
      AgentRunner.stopAgent(agentId);
    }, 1000);
  } catch (err) {
    console.error('Error:', err);
  }
})();