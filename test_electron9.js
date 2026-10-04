const path = require('path');
const electronPath = require('electron');
console.log('electronPath:', electronPath);

// Check if there's an electron.asar
const fs = require('fs');
const resourcesPath = path.join(electronPath, '..', 'Resources');
console.log('resourcesPath:', resourcesPath);
console.log('Contents:', fs.readdirSync(resourcesPath));

// Check for app.asar
const appAsarPath = path.join(resourcesPath, 'app.asar');
console.log('app.asar exists:', fs.existsSync(appAsarPath));

// Check for electron.asar
const electronAsarPath = path.join(resourcesPath, 'electron.asar');
console.log('electron.asar exists:', fs.existsSync(electronAsarPath));
