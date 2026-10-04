// Test script for M2 and M3 verification
// This tests the main process modules directly

const { fsService } = require('./src/main/fsService');
const { providerService } = require('./src/main/providers');
const path = require('path');

async function testM2() {
  console.log('\n========== M2: WORKBENCH / FILESYSTEM TESTS ==========\n');

  // Test 1: Open a real project folder
  console.log('Test 1: Opening project folder...');
  const projectRoot = '/tmp/supru-test-project';
  const success = await fsService.setProjectRoot(projectRoot);
  console.log(`  Project root set: ${success}`);
  console.log(`  Project root: ${fsService.projectRoot}`);

  // Test 2: List files
  console.log('\nTest 2: Listing files...');
  try {
    const files = await fsService.list('');
    console.log('  Files:', JSON.stringify(files, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 3: Create a file
  console.log('\nTest 3: Creating a test file...');
  try {
    await fsService.write('src/test.txt', 'Hello World');
    console.log('  File created successfully');
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 4: Read the file
  console.log('\nTest 4: Reading the test file...');
  try {
    const content = await fsService.read('src/test.txt');
    console.log('  Content:', content);
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 5: Edit the file
  console.log('\nTest 5: Editing the test file...');
  try {
    const result = await fsService.edit('src/test.txt', 'Hello World', 'Hello Supru');
    console.log('  Edit result:', result);
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 6: Read again to verify edit
  console.log('\nTest 6: Reading the edited file...');
  try {
    const content = await fsService.read('src/test.txt');
    console.log('  Content:', content);
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 7: Create a new file via mkdir
  console.log('\nTest 7: Creating a directory...');
  try {
    await fsService.mkdir('src/newdir');
    console.log('  Directory created');
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 8: List again to see new structure
  console.log('\nTest 8: Listing files after changes...');
  try {
    const files = await fsService.list('');
    console.log('  Files:', JSON.stringify(files, null, 2));
    const srcFiles = await fsService.list('src');
    console.log('  src files:', JSON.stringify(srcFiles, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 9: Rename file (move)
  console.log('\nTest 9: Renaming file...');
  try {
    await fsService.move('src/test.txt', 'src/renamed.txt');
    console.log('  File renamed');
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 10: Duplicate file (copy)
  console.log('\nTest 10: Duplicating file...');
  try {
    await fsService.copy('src/renamed.txt', 'src/renamed-copy.txt');
    console.log('  File duplicated');
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 11: Delete file (should go to trash)
  console.log('\nTest 11: Deleting file...');
  try {
    await fsService.delete('src/renamed-copy.txt');
    console.log('  File deleted (should be in .supru/trash)');
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 12: Check trash
  console.log('\nTest 12: Checking trash directory...');
  try {
    const trashFiles = await fsService.list('.supru/trash');
    console.log('  Trash files:', JSON.stringify(trashFiles, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 13: Test path traversal rejection
  console.log('\nTest 13: Testing path traversal rejection...');
  try {
    await fsService.read('../outside.txt');
    console.log('  ERROR: Should have been rejected!');
  } catch (err) {
    console.log('  Correctly rejected:', err.message);
  }

  // Test 14: Test path outside project root
  console.log('\nTest 14: Testing path outside project root...');
  try {
    await fsService.read('/etc/passwd');
    console.log('  ERROR: Should have been rejected!');
  } catch (err) {
    console.log('  Correctly rejected:', err.message);
  }

  // Test 15: Search
  console.log('\nTest 15: Testing search...');
  try {
    const results = await fsService.search('Supru');
    console.log('  Search results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  console.log('\n========== M2 TESTS COMPLETE ==========\n');
}

async function testM3() {
  console.log('\n========== M3: CHAT WITH MODELS TESTS ==========\n');

  // Test 1: List providers
  console.log('Test 1: Listing providers...');
  try {
    const providers = providerService.listProviders();
    console.log('  Providers:', JSON.stringify(providers, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 2: Add a provider (Ollama)
  console.log('\nTest 2: Adding Ollama provider...');
  try {
    const id = await providerService.addProvider({
      type: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      keyRef: null,
      defaultModel: ''
    });
    console.log('  Provider added with ID:', id);
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 3: List providers again
  console.log('\nTest 3: Listing providers after adding...');
  try {
    const providers = providerService.listProviders();
    console.log('  Providers:', JSON.stringify(providers, null, 2));
  } catch (err) {
    console.error('  Error:', err.message);
  }

  // Test 4: Test provider (will fail if Ollama not running)
  console.log('\nTest 4: Testing provider...');
  try {
    const providers = providerService.listProviders();
    if (providers.length > 0) {
      const result = await providerService.testProvider(providers[0].id);
      console.log('  Test result:', JSON.stringify(result, null, 2));
    } else {
      console.log('  No providers to test');
    }
  } catch (err) {
    console.error('  Error:', err.message);
  }

  console.log('\n========== M3 TESTS COMPLETE ==========\n');
}

async function runAllTests() {
  try {
    await testM2();
    await testM3();
  } catch (err) {
    console.error('Test error:', err);
  }
  process.exit(0);
}

runAllTests();