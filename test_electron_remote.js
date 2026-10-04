const electron = require('electron');
console.log('electron:', electron);
console.log('typeof:', typeof electron);

// Check if electron has remote property
if (electron && electron.remote) {
  console.log('electron.remote:', electron.remote);
}

// Check all properties
console.log('Object.keys(electron):', Object.keys(electron));
