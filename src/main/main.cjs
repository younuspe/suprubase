// Supru main process - CommonJS module
// Electron APIs are provided via global.electronMainExports (set by entry.mjs)

const electron = global.electronMainExports || require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;

const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the window object to prevent garbage collection.
let mainWindow;

// Path to settings file in userData
const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'settings.json');
};

// Import services (these will be initialized in app.on('ready'))
let providerService;
let secretsService;
let ptyService;
let settings;
let gate;
let orchestrator;
let roadmapService;
let fsService;
let agentRunner;

// Helper to wrap IPC handlers with gate permission checks
function wrapHandler(toolName, originalHandler) {
  return async (event, ...args) => {
    // Determine agentId: for agent:* tools, first arg is agentId; otherwise null
    let agentId = null;
    if (toolName.startsWith('agent:') && args.length > 0) {
      agentId = args[0];
    }
    const permission = await gate.execute(toolName, args, agentId);
    if (!permission.permitted) {
      throw new Error(permission.reason || 'Permission denied');
    }
    return await originalHandler(event, ...args);
  };
}

// Register all IPC handlers after services are initialized
function registerIpcHandlers() {
  // IPC handlers for pill functionality
  ipcMain.handle('supru:get-pill-geometry', wrapHandler('supru:get-pill-geometry', async (event) => {
    return settings.pillGeometry || null;
  }));

  ipcMain.handle('supru:set-pill-geometry', wrapHandler('supru:set-pill-geometry', async (event, geometry) => {
    settings.pillGeometry = geometry;
    settings.saveSettings();
    return true;
  }));

  ipcMain.handle('supru:attach-files', wrapHandler('supru:attach-files', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections']
    });
    return result.filePaths || [];
  }));

  // IPC handlers for file system service
  ipcMain.handle('fs:list', wrapHandler('fs:list', async (event, dirPath) => {
    return await fsService.list(dirPath);
  }));

  ipcMain.handle('fs:read', wrapHandler('fs:read', async (event, filePath, range) => {
    return await fsService.read(filePath, range);
  }));

  ipcMain.handle('fs:write', wrapHandler('fs:write', async (event, filePath, content) => {
    return await fsService.write(filePath, content);
  }));

  ipcMain.handle('fs:edit', wrapHandler('fs:edit', async (event, filePath, oldContent, newContent) => {
    return await fsService.edit(filePath, oldContent, newContent);
  }));

  ipcMain.handle('fs:move', wrapHandler('fs:move', async (event, fromPath, toPath) => {
    return await fsService.move(fromPath, toPath);
  }));

  ipcMain.handle('fs:delete', wrapHandler('fs:delete', async (event, filePath) => {
    return await fsService.delete(filePath);
  }));

  ipcMain.handle('fs:copy', wrapHandler('fs:copy', async (event, fromRelativePath, toRelativePath) => {
    return await fsService.copy(fromRelativePath, toRelativePath);
  }));

  ipcMain.handle('fs:mkdir', wrapHandler('fs:mkdir', async (event, relativePath) => {
    return await fsService.mkdir(relativePath);
  }));

  ipcMain.handle('fs:search', wrapHandler('fs:search', async (event, query, glob) => {
    return await fsService.search(query, glob);
  }));

  ipcMain.handle('fs:openProjectRoot', wrapHandler('fs:openProjectRoot', async (event) => {
    const projectRoot = await fsService.openProjectRoot();
    if (projectRoot) {
      // Start watching for external changes
      fsService.startWatcher(projectRoot);
      gate.setProjectRoot(projectRoot);
    }
    return projectRoot;
  }));

  ipcMain.handle('fs:getLastProjectRoot', wrapHandler('fs:getLastProjectRoot', async () => {
    return await fsService.getLastProjectRoot();
  }));

  ipcMain.handle('fs:setProjectRoot', wrapHandler('fs:setProjectRoot', async (event, rootPath) => {
    const success = await fsService.setProjectRoot(rootPath);
    if (success) {
      gate.setProjectRoot(rootPath);
    }
    return success;
  }));

  // IPC handlers for providers
  ipcMain.handle('providers:list', wrapHandler('providers:list', async () => {
    return providerService.listProviders();
  }));

  ipcMain.handle('providers:add', wrapHandler('providers:add', async (event, providerData) => {
    return await providerService.addProvider(providerData);
  }));

  ipcMain.handle('providers:remove', wrapHandler('providers:remove', async (event, id) => {
    await providerService.removeProvider(id);
    return true;
  }));

  ipcMain.handle('providers:update', wrapHandler('providers:update', async (event, id, updates) => {
    await providerService.updateProvider(id, updates);
    return true;
  }));

  ipcMain.handle('providers:get', wrapHandler('providers:get', async (event, id) => {
    return providerService.getProvider(id);
  }));

  ipcMain.handle('providers:test', wrapHandler('providers:test', async (event, id) => {
    return await providerService.testProvider(id);
  }));

  ipcMain.handle('providers:fetchModels', wrapHandler('providers:fetchModels', async (event, id) => {
    const provider = providerService.getProvider(id);
    if (!provider) {
      throw new Error('Provider not found');
    }
    return await providerService.fetchModels(provider);
  }));

  ipcMain.handle('providers:chatCompletion', wrapHandler('providers:chatCompletion', async (event, providerId, messages, options, model) => {
    const streamId = Math.random().toString(36).substr(2, 9);

    (async () => {
      try {
        const stream = providerService.chatCompletion(providerId, messages, { ...options, model });
        for await (const chunk of stream) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat:chunk', streamId, chunk);
          }
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:end', streamId);
        }
      } catch (err) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:error', streamId, err.message);
        }
      }
    })();

    return streamId;
  }));

  // IPC handlers for secrets
  ipcMain.handle('secrets:set', wrapHandler('secrets:set', async (event, name, value) => {
    await secretsService.set(name, value);
    return true;
  }));

  ipcMain.handle('secrets:get', wrapHandler('secrets:get', async (event, name) => {
    return await secretsService.get(name);
  }));

  ipcMain.handle('secrets:remove', wrapHandler('secrets:remove', async (event, name) => {
    await secretsService.remove(name);
    return true;
  }));

  ipcMain.handle('secrets:list', wrapHandler('secrets:list', async () => {
    return secretsService.list();
  }));

  ipcMain.handle('secrets:has', wrapHandler('secrets:has', async (event, name) => {
    return secretsService.has(name);
  }));

  // IPC handlers for pty service
  ipcMain.handle('pty:create', wrapHandler('pty:create', async (event, cwd, args) => {
    return await ptyService.createTerminal(cwd, args);
  }));

  ipcMain.on('pty:write', (event, termId, data) => {
    ptyService.writeToTerminal(termId, data);
  });

  ipcMain.on('pty:resize', (event, termId, size) => {
    ptyService.resizeTerminal(termId, size);
  });

  ipcMain.on('pty:kill', (event, termId) => {
    ptyService.killTerminal(termId);
  });

  // IPC handlers for orchestrator (M7)
  ipcMain.handle('orchestrator:run', wrapHandler('orchestrator:run', async (event, goal) => {
    return await orchestrator.handleRunCommand(goal);
  }));

  ipcMain.handle('orchestrator:plan', wrapHandler('orchestrator:plan', async (event, goal) => {
    return await orchestrator.handlePlanCommand(goal);
  }));

  ipcMain.handle('orchestrator:agents', wrapHandler('orchestrator:agents', async () => {
    return await orchestrator.handleAgentsCommand();
  }));

  ipcMain.handle('orchestrator:pause', wrapHandler('orchestrator:pause', async (event, workflowId) => {
    return await orchestrator.handlePauseCommand(workflowId);
  }));

  ipcMain.handle('orchestrator:resume', wrapHandler('orchestrator:resume', async (event, workflowId) => {
    return await orchestrator.handleResumeCommand(workflowId);
  }));

  ipcMain.handle('orchestrator:stop', wrapHandler('orchestrator:stop', async (event, workflowId) => {
    return await orchestrator.handleStopCommand(workflowId);
  }));

  ipcMain.handle('orchestrator:approve', wrapHandler('orchestrator:approve', async (event, workflowId, stageId) => {
    return await orchestrator.handleApproveCommand(workflowId, stageId);
  }));

  ipcMain.handle('orchestrator:reject', wrapHandler('orchestrator:reject', async (event, workflowId, stageId) => {
    return await orchestrator.handleRejectCommand(workflowId, stageId);
  }));

  ipcMain.handle('orchestrator:status', wrapHandler('orchestrator:status', async (event, workflowId) => {
    return await orchestrator.handleStatusCommand(workflowId);
  }));

  // IPC handlers for roadmap (M8)
  ipcMain.handle('roadmap:list', wrapHandler('roadmap:list', async () => {
    return await roadmapService.listMilestones();
  }));

  ipcMain.handle('roadmap:get', wrapHandler('roadmap:get', async (event, milestoneId) => {
    return await roadmapService.getMilestone(milestoneId);
  }));

  ipcMain.handle('roadmap:run', wrapHandler('roadmap:run', async (event, milestoneId) => {
    return await roadmapService.runMilestone(milestoneId);
  }));

  ipcMain.handle('roadmap:tick', wrapHandler('roadmap:tick', async (event, milestoneId) => {
    return await roadmapService.tickMilestone(milestoneId);
  }));

  ipcMain.handle('roadmap:draft', wrapHandler('roadmap:draft', async (event, goal) => {
    return await roadmapService.draftRoadmapForGoal(goal);
  }));

  // IPC handlers for agent runner
  ipcMain.handle('agent:stop', wrapHandler('agent:stop', async (event, agentId) => {
    await agentRunner.stopAgent(agentId);
    return true;
  }));

  ipcMain.handle('agent:getOutput', wrapHandler('agent:getOutput', async (event, agentId) => {
    return agentRunner.getOutput(agentId);
  }));

  ipcMain.handle('agent:isRunning', wrapHandler('agent:isRunning', async (event, agentId) => {
    return agentRunner.isRunning(agentId);
  }));

  ipcMain.handle('agent:run', wrapHandler('agent:run', async (event, agentId, command, args, cwd) => {
    return await agentRunner.runAgent(agentId, command, args, cwd);
  }));

  ipcMain.on('agent:data', (event, agentId, type, data) => {
    // Forward agent data to renderer
    if (mainWindow) {
      mainWindow.webContents.send('agent:data', agentId, type, data);
    }
  });

  ipcMain.on('agent:exit', (event, agentId, code, signal) => {
    // Forward agent exit to renderer
    if (mainWindow) {
      mainWindow.webContents.send('agent:exit', agentId, code, signal);
    }
  });
}

// Create the browser window.
const createWindow = () => {
  // Load previous settings
  settings.loadSettings();

  let winOptions = {
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true, // required for security
      nodeIntegration: false, // recommended for security
      sandbox: true, // sandbox the renderer
    },
  };

  // If we have saved window bounds, use them
  if (settings.windowBounds) {
    winOptions.x = settings.windowBounds.x;
    winOptions.y = settings.windowBounds.y;
    winOptions.width = settings.windowBounds.width;
    winOptions.height = settings.windowBounds.height;
  }

  mainWindow = new BrowserWindow(winOptions);

  // Set mainWindow reference in agentRunner for IPC forwarding
  agentRunner.setMainWindow(mainWindow);

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // If we didn't have saved bounds, save the current bounds once the window is ready to show
  if (!settings.windowBounds) {
    mainWindow.once('ready-to-show', () => {
      const bounds = mainWindow.getBounds();
      settings.windowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      settings.saveSettings();
    });
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object.
    mainWindow = null;
  });

  // Save window bounds on resize or move
  mainWindow.on('resize', () => {
    if (!mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      settings.windowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      settings.saveSettings();
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      settings.windowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      settings.saveSettings();
    }
  });

  // Handle window maximize/unmaximize
  mainWindow.on('maximize', () => {
    settings.windowBounds = null; // We don't save maximized state, but we can if needed
    settings.saveSettings();
  });

  mainWindow.on('unmaximize', () => {
    if (!mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      settings.windowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      settings.saveSettings();
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Initialize services AFTER app is ready (so app.getPath works)
  const { providerService: ProviderService } = require('./providers');
  const { secretsService: SecretsService } = require('./secrets');
  const { ptyService: PtyService } = require('./ptyService');
  const settingsModule = require('./settings');
  const { Gate } = require('./gate');
  const { Orchestrator } = require('./orchestrator');
  const { RoadmapService } = require('./roadmapService');
  const { fsService: FSService } = require('./fsService');
  const { agentRunner: AgentRunner } = require('./agentRunner');

  providerService = new ProviderService();
  secretsService = new SecretsService();
  ptyService = new PtyService();
  ptyService.setupIpcHandlers();
  settings = settingsModule;
  gate = new Gate();
  orchestrator = new Orchestrator();
  roadmapService = new RoadmapService();
  fsService = new FSService();
  agentRunner = new AgentRunner();

  // Register IPC handlers after services are initialized
  registerIpcHandlers();

  // Create window
  createWindow();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.