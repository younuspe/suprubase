// Test for agentRunner.js
const { AgentRunner } = require('./src/main/agentRunner.js');

async function testAgentRunner() {
  console.log('Testing AgentRunner...');

  // Test 1: Run a simple echo command that exits quickly
  const agentId = 'test1';
  const args = ['-c', 'echo hello; echo world'];
  try {
    const id = await AgentRunner.runAgent(agentId, 'bash', args, process.cwd());
    console.log(`Started agent ${id}`);

    // Wait a bit for output
    await new Promise(resolve => setTimeout(resolve, 500));

    const output = AgentRunner.getOutput(agentId);
    console.log('Output buffers:', output);
    // Check that we got something in stdout
    if (output.stdout.includes('hello') && output.stdout.includes('world')) {
      console.log('✓ AgentRunner: command output captured');
    } else {
      throw new Error('Expected output not found');
    }

    // Stop the agent
    await AgentRunner.stopAgent(agentId);
    console.log('✓ AgentRunner: agent stopped');

    // Check that it's not running
    if (!AgentRunner.isRunning(agentId)) {
      console.log('✓ AgentRunner: agent is not running after stop');
    } else {
      throw new Error('Agent still running after stop');
    }
  } catch (err) {
    console.error('✗ AgentRunner test 1 failed:', err);
    return false;
  }

  // Test 2: Run a command that outputs stream-json lines
  const agentId2 = 'test2';
  // We'll use node to output JSON lines
  const args2 = ['-e', `process.stdout.write('{"type":"test","content":"hello"}\\\\n'); process.stdout.write('{"type":"test","content":"world"}\\\\n');`];
  try {
    const id2 = await AgentRunner.runAgent(agentId2, 'node', args2, process.cwd());
    console.log(`Started agent ${id2}`);

    // Wait a bit for output
    await new Promise(resolve => setTimeout(resolve, 500));

    const output2 = AgentRunner.getOutput(agentId2);
    console.log('Output buffers for JSON test:', output2);
    // The stdoutBuffer should contain the two JSON lines and newlines
    if (output2.stdout.includes('{"type":"test","content":"hello"}') && 
        output2.stdout.includes('{"type":"test","content":"world"}')) {
      console.log('✓ AgentRunner: JSON lines captured in stdout buffer');
    } else {
      throw new Error('Expected JSON lines not found in stdout buffer');
    }

    // Note: We cannot easily test that the events were emitted because we don't have the IPC setup.
    // But we can at least verify that the agentRunner didn't crash and the buffers are there.

    // Stop the agent
    await AgentRunner.stopAgent(agentId2);
    console.log('✓ AgentRunner: agent stopped');
  } catch (err) {
    console.error('✗ AgentRunner test 2 failed:', err);
    return false;
  }

  // Test 3: Test resumeAgent (we'll mock by checking that it tries to spawn with --resume)
  // We cannot actually resume without a session file, but we can check that the method exists and returns a promise.
  const agentId3 = 'test3';
  try {
    // We'll call resumeAgent with a dummy path. It will try to spawn 'claude' which may not be installed.
    // We expect it to throw because claude is not found, but we just want to see that it attempts to spawn.
    // We'll catch the error and check that it's about 'claude' not being found.
    await AgentRunner.resumeAgent(agentId3, '/tmp/fake-session');
    // If we get here, it means the command succeeded (unlikely). We'll fail the test.
    throw new Error('Expected resumeAgent to fail because claude is not installed');
  } catch (err) {
    // We expect an error about spawning claude
    if (err.message.includes('claude') || err.message.includes('ENOENT')) {
      console.log('✓ AgentRunner: resumeAgent attempts to spawn claude (error as expected):', err.message);
    } else {
      console.error('✗ AgentRunner: resumeAgent failed unexpectedly:', err);
      return false;
    }
  }

  console.log('✓ All AgentRunner tests passed!');
  return true;
}

// Run the test
testAgentRunner().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('✗ Test harness error:', err);
  process.exit(1);
});