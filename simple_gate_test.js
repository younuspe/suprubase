// Simple test for gate functionality
const path = require('path');
const { Gate } = require('./src/main/gate.js');

async function runSimpleTests() {
  console.log('Starting simple Gate tests...\n');

  // Test 1: Basic gate instantiation and default permissions
  try {
    const gate = new Gate();
    const result = await gate.execute('fs:read', ['/some/path']);
    if (result.permitted === false && result.permission === 'deny') {
      console.log('✓ Gate: default deny works');
    } else {
      throw new Error('Expected default deny, got: ' + JSON.stringify(result));
    }
  } catch (e) {
    console.log('✗ Gate: default deny test FAILED:', e.message);
    return false;
  }

  // Test 2: Setting project root
  try {
    const gate = new Gate();
    gate.setProjectRoot('/tmp/test_project');
    if (gate.projectRoot === '/tmp/test_project') {
      console.log('✓ Gate: setProjectRoot works');
    } else {
      throw new Error('Project root not set correctly');
    }
  } catch (e) {
    console.log('✗ Gate: setProjectRoot test FAILED:', e.message);
    return false;
  }

  // Test 3: Glob to regex conversion
  try {
    const gate = new Gate();
    const regex = gate._globToRegex('*.js');
    if (regex.test('test.js') && !regex.test('test.txt')) {
      console.log('✓ Gate: glob to regex conversion works');
    } else {
      throw new Error('Glob to regex conversion failed');
    }
  } catch (e) {
    console.log('✗ Gate: glob to regex test FAILED:', e.message);
    return false;
  }

  console.log('\n✓ All simple Gate unit tests completed!');
  return true;
}

// Run the tests
runSimpleTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.log('✗ Test harness error:', err);
  process.exit(1);
});