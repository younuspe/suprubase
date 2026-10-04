const { app, BrowserWindow, ipcMain } = require('electron');
console.log('1. app:', app);
console.log('2. BrowserWindow:', BrowserWindow);
console.log('3. ipcMain:', ipcMain);

const { providerService } = require('./providers');
console.log('4. providerService loaded');

const { secretsService } = require('./secrets');
console.log('5. secretsService loaded');

const { ptyService } = require('./ptyService');
console.log('6. ptyService loaded');

const settings = require('./settings');
console.log('7. settings loaded:', typeof settings.loadSettings);

const { Gate } = require('./gate');
console.log('8. Gate loaded');

const { Orchestrator } = require('./orchestrator');
console.log('9. Orchestrator loaded');

const { RoadmapService } = require('./roadmapService');
console.log('10. RoadmapService loaded');

console.log('11. app after requires:', app);
