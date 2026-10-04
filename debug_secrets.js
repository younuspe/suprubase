// Debug secret file detection
const path = require('path');
const { Gate } = require('./src/main/gate.js');

async function debugSecretDetection() {
  console.log('Debugging secret file detection...\n');
  
  const gate = new Gate();
  
  // Let's see what the secretsRegexes look like
  console.log('Secrets regexes:', gate.secretsRegexes);
  console.log('Number of secrets regexes:', gate.secretsRegexes.length);
  
  // Test each pattern individually
  const testCases = [
    { file: '/.env', shouldMatch: true },
    { file: '/.env.test', shouldMatch: true },
    { file: '/config/.pem', shouldMatch: true },
    { file: '/ssh/id_rsa', shouldMatch: true },
    { file: '/src/test.js', shouldMatch: false },
    { file: '/README.md', shouldMatch: false }
  ];
  
  for (const testCase of testCases) {
    const result = gate._isSecretFile(testCase.file);
    console.log(`File: ${testCase.file}`);
    console.log(`  Expected: ${testCase.shouldMatch ? 'secret' : 'not secret'}`);
    console.log(`  Actual:   ${result ? 'secret' : 'not secret'}`);
    console.log(`  Correct:  ${result === testCase.shouldMatch ? 'YES' : 'NO'}\n`);
    
    if (result !== testCase.shouldMatch) {
      // Let's debug why
      console.log('  Debugging this failure:');
      for (let i = 0; i < gate.secretsRegexes.length; i++) {
        const regex = gate.secretsRegexes[i];
        const matches = regex.test(testCase.file);
        console.log(`    Pattern ${i} (${regex}): ${matches ? 'MATCHES' : 'no match'}`);
      }
      console.log();
    }
  }
}

debugSecretDetection().catch(console.error);