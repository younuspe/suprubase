const path = require('path');
const { Gate } = require('./src/main/gate.js');

async function runGateTests() {
  console.log('Starting Gate unit tests...\n');

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

  // Test 4: Path allowance checking
  try {
    const gate = new Gate();
    gate.policies.fs = {
      read: ['**/*.js', '**/*.ts'],
      write: ['**/*.js'],
      deny: ['**/node_modules/**', '**/.env*']
    };
    gate._compilePatterns();

    // Test reading allowed files
    if (gate._isPathAllowedForReading('/src/test.js') &&
        gate._isPathAllowedForReading('/src/test.ts') &&
        !gate._isPathAllowedForReading('/src/test.txt')) {
      console.log('✓ Gate: read path allowance works');
    } else {
      throw new Error('Read path allowance failed');
    }

    // Test writing allowed files
    if (gate._isPathAllowedForWriting('/src/test.js') &&
        !gate._isPathAllowedForWriting('/src/test.ts') &&
        !gate._isPathAllowedForWriting('/src/test.txt')) {
      console.log('✓ Gate: write path allowance works');
    } else {
      throw new Error('Write path allowance failed');
    }

    // Test denied paths
    if (!gate._isPathAllowedForReading('/node_modules/test.js') &&
        !gate._isPathAllowedForReading('/.env')) {
      console.log('✓ Gate: denied path detection works');
    } else {
      throw new Error('Denied path detection failed');
    }
  } catch (e) {
    console.log('✗ Gate: path allowance test FAILED:', e.message);
    return false;
  }

  // Test 5: Secret file detection
  try {
    const gate = new Gate();
    // Secrets are already initialized in constructor
    if (gate._isSecretFile('/.env') &&
        gate._isSecretFile('/.env.test') &&
        gate._isSecretFile('/config/.pem') &&
        gate._isSecretFile('/ssh/id_rsa') &&
        !gate._isSecretFile('/src/test.js') &&
        !gate._isSecretFile('/README.md')) {
      console.log('✓ Gate: secret file detection works');
    } else {
      throw new Error('Secret file detection failed');
    }
  } catch (e) {
    console.log('✗ Gate: secret file detection test FAILED:', e.message);
    return false;
  }

  // Test 6: Shell command allowance
  try {
    const gate = new Gate();
    gate.policies.shell = {
      allow: ['npm test', 'npm run build'],
      deny: ['rm -rf*', 'curl*', 'sudo*']
    };
    gate._compilePatterns();

    if (gate._shellAllowed('npm test') === 'allow' &&
        gate._shellAllowed('npm run build') === 'allow' &&
        gate._shellAllowed('rm -rf /') === 'deny' &&
        gate._shellAllowed('curl http://example.com') === 'deny' &&
        gate._shellAllowed('sudo su') === 'deny' &&
        gate._shellAllowed('echo hello') === 'deny') { // default deny
      console.log('✓ Gate: shell command allowance works');
    } else {
      throw new Error('Shell command allowance failed');
    }
  } catch (e) {
    console.log('✗ Gate: shell command test FAILED:', e.message);
    return false;
  }

  // Test 7: Human approval
  try {
    const gate = new Gate();
    // Set up policies so paths are allowed, but human approval is required
    gate.policies.fs = {
      read: ['**/*.txt'],
      write: ['**/*.txt'],
      deny: []
    };
    gate.policies.shell = {
      allow: ['rm -rf /tmp/test'],
      deny: []
    };
    gate.policies.humanApproval = ['fs:delete', 'shell:run'];
    gate._compilePatterns();

    const result1 = await gate.execute('fs:delete', ['/tmp/test.txt']);
    const result2 = await gate.execute('shell:run', ['rm -rf /tmp/test']);
    const result3 = await gate.execute('fs:read', ['/tmp/test.txt']);

    // human approval means permitted=true but permission='ask'
    if (result1.permitted === true && result1.permission === 'ask' && result1.reason === 'Requires human approval' &&
        result2.permitted === true && result2.permission === 'ask' && result2.reason === 'Requires human approval' &&
        result3.permitted === true && result3.permission === 'allow') {
      console.log('✓ Gate: human approval works');
    } else {
      console.log('Result1:', JSON.stringify(result1));
      console.log('Result2:', JSON.stringify(result2));
      console.log('Result3:', JSON.stringify(result3));
      throw new Error('Human approval failed');
    }
  } catch (e) {
    console.log('✗ Gate: human approval test FAILED:', e.message);
    return false;
  }

  // Test 8: Resource limits (file size)
  try {
    const gate = new Gate();
    gate.policies.fs = {
      write: ['**/*.txt'],
      read: ['**/*.txt'],
      deny: []
    };
    gate._compilePatterns();
    gate.policies.limits = { maxFileSize: 10 }; // 10 bytes

    const result = await gate.execute('fs:write', ['/tmp/test.txt', 'This is a test content that is longer than 10 bytes']);
    if (!result.permitted && result.permission === 'deny' && result.reason && result.reason.includes('File size exceeds limit')) {
      console.log('✓ Gate: resource limits (file size) works');
    } else {
      throw new Error('Resource limits test failed');
    }
  } catch (e) {
    console.log('✗ Gate: resource limits test FAILED:', e.message);
    return false;
  }

  // Test 9: Full integrate test with tool execution
    try {
      const gate = new Gate();
      gate.setProjectRoot('/tmp/test_project');
      gate.policies.fs = {
        read: ['**/*.js'],
        write: ['**/*.js'],
        deny: ['**/node_modules/**', '**/.env*']
      };
      gate.policies.humanApproval = ['fs:delete'];
      gate._compilePatterns();

      // Test allowed read
      let result = await gate.execute('fs:read', ['/tmp/test.js']);
      console.log('Read result:', JSON.stringify(result));
      if (result.permitted) {
        console.log('✓ Gate: integrated read test works');
      } else {
        throw new Error('Integrated read test failed: ' + JSON.stringify(result));
      }

      // Test allowed write
      result = await gate.execute('fs:write', ['/tmp/test.js', 'console.log("test");']);
      console.log('Write result:', JSON.stringify(result));
      if (result.permitted) {
        console.log('✓ Gate: integrated write test works');
      } else {
        throw new Error('Integrated write test failed');
      }

      // Test denied read (wrong extension)
      result = await gate.execute('fs:read', ['/tmp/test.txt']);
      console.log('Denied read result:', JSON.stringify(result));
      if (!result.permitted && result.permission === 'deny') {
        console.log('✓ Gate: integrated deny test works');
      } else {
        throw new Error('Integrated deny test failed');
      }

      // Test human approval
      result = await gate.execute('fs:delete', ['/tmp/test.js']);
      console.log('Delete result:', JSON.stringify(result));
      if (result.permission === 'ask') {
        console.log('✓ Gate: integrated human approval test works');
      } else {
        throw new Error('Integrated human approval test failed');
      }
    } catch (e) {
      console.log('✗ Gate: integrated test FAILED:', e.message);
      return false;
    }

  console.log('\n✓ All Gate unit tests completed!');
  return true;
}

// Run the tests
runGateTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.log('✗ Test harness error:', err);
  process.exit(1);
});