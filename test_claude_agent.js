// Test agentRunner with actual claude CLI
const { AgentRunner } = require('./src/main/agentRunner.js');

async function test() {
  // Ensure process.env is available
  const processEnv = process.env;
  const agentId = 'claude-test';
  // Use claude with a simple prompt
  const command = 'claude';
  const args = ['-p', 'print hello world', '--output-format', 'stream-json', '--verbose'];
  const cwd = process.cwd();
  console.log('Spawning claude agent with command:', command, args);
  const id = await AgentRunner.runAgent(agentId, command, args, cwd);
  console.log(`Agent ${id} started`);

  // Wait for claude to complete
  await new Promise(resolve => setTimeout(resolve, 10000));

  const output = AgentRunner.getOutput(agentId);
  console.log('Stdout length:', output.stdout.length);
  console.log('Stderr length:', output.stderr.length);
  console.log('Is running:', AgentRunner.isRunning(agentId));

  // Check that we got JSON output
  const lines = output.stdout.trim().split('\n').filter(line => line.length > 0);
  console.log('Lines received:', lines.length);
  if (lines.length > 0) {
    console.log('First line:', lines[0].substring(0, 200));
    // Try parsing first line
    try {
      const parsed = JSON.parse(lines[0]);
      console.log('✓ First line parsed successfully, type:', parsed.type);
    } catch (e) {
      console.log('✗ First line not valid JSON:', e.message);
    }
    console.log('✓ Claude CLI test passed: stream-json output received');
  } else {
    console.log('✗ Claude CLI test failed: no output received');
  }
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});