// Test agentRunner with streaming output
const { AgentRunner } = require('./src/main/agentRunner.js');

async function test() {
  const agentId = 'stream-test';
  // Get the node executable path
  const nodeExe = process.argv[0];
  // This node script will output a JSON line every 0.2 seconds for 1 second
  const agentCode = `
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(JSON.stringify({type: 'test', count: i}) + '\\n');
      i++;
      if (i >= 5) {
        clearInterval(interval);
        process.exit(0);
      }
    }, 200);
  `;
  const args = ['-e', agentCode];
  console.log('Spawning agent...');
  const id = await AgentRunner.runAgent(agentId, nodeExe, args, process.cwd());
  console.log(`Agent ${id} started`);

  // Wait for 2 seconds to let it finish
  await new Promise(resolve => setTimeout(resolve, 2000));

  const output = AgentRunner.getOutput(agentId);
  console.log('Stdout:', output.stdout);
  console.log('Stderr:', output.stderr);
  console.log('Stdout buffer:', output.stdoutBuffer); // Not in getOutput, but we can access via runningProcesses? We'll just check stdout.

  // Check that we got the JSON lines
  const lines = output.stdout.trim().split('\\n');
  console.log('Lines:', lines);
  if (lines.length === 5 && lines[0].includes('{"type":"test","count":0}')) {
    console.log('✓ Stream test passed');
  } else {
    console.log('✗ Stream test failed: expected 5 lines');
  }

  // Stop agent (should already be exited)
  await AgentRunner.stopAgent(agentId);
}

test().catch(console.error);