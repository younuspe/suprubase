// Settings service for Supru
// Handles window bounds, pill geometry, last project, and other persistent settings

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
