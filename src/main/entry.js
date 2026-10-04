// CommonJS entry point for Supru
// Electron APIs are provided by launcher.cjs via -r flag

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu, Tray, nativeImage, clipboard, crashReporter, desktopCapturer, globalShortcut, net, netLog, protocol, session, systemPreferences, webContents, webFrame, webFrameMain } = require('electron');

const path = require('path');

// Load the CommonJS main
require('./main.cjs');
