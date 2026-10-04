// Test agentRunner with actual stream-json output
const { AgentRunner } = require('./src/main/agentRunner.js');

async function test() {
  const agentId = 'stream-test';
  // Use the node executable from process.argv[0]
  const nodeExe = process.argv[0];
  // This node script will output a JSON line every 0.1 seconds for 0.5 seconds (5 lines)
  const agentCode = `
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(JSON.stringify({type: 'test', count: i}) + '\\n');
      i++;
      if (i >= 5) {
        clearInterval(interval);
        process.exit(0);
      }
    }, 100);
  `;
  const args = ['-e', agentCode];
  console.log('Spawning agent with command:', nodeExe, args);
  const id = await AgentRunner.runAgent(agentId, nodeExe, args, process.cwd());
  console.log(`Agent ${id} started`);

  // Wait for 1 second to let it finish
  await new Promise(resolve => setTimeout(resolve, 1000));

  const output = AgentRunner.getOutput(agentId);
  console.log('Stdout:', JSON.stringify(output.stdout));
  console.log('Stderr:', JSON.stringify(output.stderr));

  // Check that we got the JSON lines
  const lines = output.stdout.trim().split('\n').filter(line => line.length > 0);
  console.log('Lines:', lines);
  if (lines.length === 5) {
    // Check each line is valid JSON and has the expected structure
    let ok = true;
    for (let j = 0; j < 5; j++) {
      let obj;
      try {
        obj = JSON.parse(lines[j]);
      } catch (e) {
        ok = false;
        break;
      }
      if (obj.type !== 'test' || obj.count !== j) {
        ok = false;
        break;
      }
    }
    if (ok) {
      console.log('✓ Stream test passed: all 5 JSON lines received and valid');
    } else {
      console.log('✗ Stream test failed: lines do not match expected JSON');
    }
  } else {
    console.log('✗ Stream test failed: expected 5 lines, got', lines.length);
  }

  // Stop agent (should already be exited)
  await AgentRunner.stopAgent(agentId);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});