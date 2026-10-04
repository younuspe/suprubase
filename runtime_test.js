const { app, BrowserWindow } = require('./node_modules/electron')
const path = require('path')
const url = require('url')

let testWindow

function createWindow() {
  testWindow = new BrowserWindow({
    show: false, // we don't need to see it
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  testWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'src/renderer/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  testWindow.webContents.on('did-finish-load', () => {
    console.log('Test window loaded')
    runTests()
  })
}

async function runTests() {
  try {
    // We'll run tests in the renderer context and return results
    const result = await testWindow.webContents.executeJavaScript(`
      (async () => {
        // Test M0: settings (via supru API)
        try {
          // We can't directly test settings from renderer, but we can test that the supru API exists
          if (typeof window.supru === 'undefined') {
            throw new Error('supru API not exposed')
          }
          // Test M1: pill geometry
          const testGeom = {x: 100, y: 100, width: 800, height: 600}
          await window.supru.setPillGeometry(testGeom)
          const retrieved = await window.supru.getPillGeometry()
          if (!retrieved || retrieved.x !== testGeom.x || retrieved.y !== testGeom.y || retrieved.width !== testGeom.width || retrieved.height !== testGeom.height) {
            throw new Error('Pill geometry not set/get correctly')
          }
          // Test M2: fs operations
          // We'll test by reading a known file (package.json)
          const fileList = await window.supru.fs.list('.')
          if (!Array.isArray(fileList)) {
            throw new Error('fs.list did not return an array')
          }
          // Check if package.json is in the list
          const hasPackageJson = fileList.some(f => f === 'package.json')
          if (!hasPackageJson) {
            throw new Error('package.json not found in directory listing')
          }
          // Read package.json
          const content = await window.supru.fs.read('package.json', {})
          if (typeof content !== 'string' || !content.includes('\"name\":\"supru\"')) {
            throw new Error('fs.read did not return expected content')
          }
          // Test M3: providers and secrets
          const providers = await window.supru.providers.list()
          if (!Array.isArray(providers)) {
            throw new Error('providers.list did not return an array')
          }
          // Test secrets
          await window.supru.secrets.set('test_key', 'test_value')
          const val = await window.supru.secrets.get('test_key')
          if (val !== 'test_value') {
            throw new Error('secrets get/set failed')
          }
          await window.supru.secrets.remove('test_key')
          // Test M4: pty
          // We'll test creating a terminal and writing to it
          const termId = await window.supru.pty.create('.', [])
          if (typeof termId !== 'string') {
            throw new Error('pty.create did not return a termId')
          }
          await window.supru.pty.write(termId, 'echo hello\\n')
          await window.supru.pty.resize(termId, {cols: 80, rows: 24})
          await window.supru.pty.kill(termId)
          // Test M5: agentRunner
          // We'll test running a simple echo agent
          const agentId = await window.supru.agentRunner.run('test', 'echo', ['hello'], '.')
          if (typeof agentId !== 'string') {
            throw new Error('agentRunner.run did not return an agentId')
          }
          // Wait a bit for the agent to finish
          await new Promise(resolve => setTimeout(resolve, 500))
          const output = await window.supru.agentRunner.getOutput(agentId)
          if (!output || !output.includes('hello')) {
            throw new Error('agentRunner.getOutput did not contain expected output')
          }
          await window.supru.agentRunner.stop(agentId)
          const isRunning = await window.supru.agentRunner.isRunning(agentId)
          if (isRunning) {
            throw new Error('agentRunner.isRunning should be false after stop')
          }
          return { success: true, message: 'All M0-M5 tests passed' }
        } catch (e) {
          return { success: false, message: e.message }
        }
      })()
    `, true)

    console.log('Test result:', result)
    if (result.success) {
      console.log('All tests passed')
    } else {
      console.log('Test failed:', result.message)
      process.exit(1)
    }
  } catch (e) {
    console.error('Error running tests:', e)
    process.exit(1)
  } finally {
    if (testWindow) {
      testWindow.close()
    }
    app.quit()
  }
}

// We need to set up the app module for the electron environment
app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})