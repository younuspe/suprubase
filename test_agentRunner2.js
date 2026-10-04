// Test agentRunner JSON parsing
const { AgentRunner } = require('./src/main/agentRunner.js');

(async () => {
  const agentId = 'test-agent';
  // Use node to produce JSON lines
  const args = ['-e', `console.log('{"type":"test","content":"hello"}'); console.log('{"type":"test","content":"world"}');`];
  await AgentRunner.runAgent(agentId, 'node', args, process.cwd());
  // Wait a bit to get output
  setTimeout(() => {
    const output = AgentRunner.getOutput(agentId);
    console.log('Output buffers:', output);
    // Check that we have events emitted? We can't easily test IPC here, but at least the buffers should be there.
    AgentRunner.stopAgent(agentId);
    process.exit(0);
  }, 1000);
})();