// Simple test for agentRunner: spawn a process that exits quickly and check output
const { AgentRunner } = require('./src/main/agentRunner.js');

async function testSimple() {
  const agentId = 'simple-test';
  // Use echo to output some text
  const args = ['-c', 'echo hello; echo world'];
  try {
    const id = await AgentRunner.runAgent(agentId, 'bash', args, process.cwd());
    console.log(`Started agent ${id}`);

    // Wait a bit for the process to finish (echo is instant)
    await new Promise(resolve => setTimeout(resolve, 500));

    const output = AgentRunner.getOutput(agentId);
    console.log('Output:', output);
    // Check that we got something in stdout
    if (output.stdout.includes('hello') && output.stdout.includes('world')) {
      console.log('✓ Simple test passed: output captured');
    } else {
      throw new Error('Expected output not found in stdout');
    }

    // Stop the agent (should already be exited)
    await AgentRunner.stopAgent(agentId);
    console.log('✓ Agent stopped');

    // Check that it's not running
    if (!AgentRunner.isRunning(agentId)) {
      console.log('✓ Agent is not running after stop');
    } else {
      throw new Error('Agent still running after stop');
    }
  } catch (err) {
    console.error('✗ Simple test failed:', err);
    return false;
  }
  return true;
}

// Run the test
testSimple().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('✗ Test harness error:', err);
  process.exit(1);
});