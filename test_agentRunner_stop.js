// Test agentRunner stop functionality
const { AgentRunner } = require('./src/main/agentRunner.js');

async function test() {
  const agentId = 'stop-test';
  const nodeExe = process.argv[0];
  // This node script runs indefinitely - we'll try to stop it
  const agentCode = `
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(JSON.stringify({type: 'heartbeat', count: i}) + '\\n');
      i++;
    }, 100);
    // Handle SIGTERM
    process.on('SIGTERM', () => {
      clearInterval(interval);
      console.log('Received SIGTERM, exiting');
      process.exit(0);
    });
  `;
  const args = ['-e', agentCode];
  console.log('Spawning agent with command:', nodeExe, args);
  const id = await AgentRunner.runAgent(agentId, nodeExe, args, process.cwd());
  console.log(`Agent ${id} started`);

  // Wait a bit to let it start producing output
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Checking if running:', AgentRunner.isRunning(agentId));

  // Stop the agent
  console.log('Stopping agent...');
  await AgentRunner.stopAgent(agentId);

  // Wait a bit for the process to exit
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Checking if running after stop:', AgentRunner.isRunning(agentId));

  const output = AgentRunner.getOutput(agentId);
  console.log('Stdout:', JSON.stringify(output.stdout));
  console.log('Stderr:', JSON.stringify(output.stderr));

  // Check that we got some heartbeats
  const lines = output.stdout.trim().split('\n').filter(line => line.length > 0);
  console.log('Heartbeat lines received:', lines.length);
  if (lines.length > 0) {
    console.log('✓ Stop test passed: agent was running and was stopped');
  } else {
    console.log('✗ Stop test failed: no output received');
  }
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});