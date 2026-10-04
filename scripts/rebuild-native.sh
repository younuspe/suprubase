#!/bin/bash
# Rebuild native modules for current Electron version

set -e

echo "Rebuilding native modules..."
npx electron-rebuild -f -w node-pty

echo "Done!"
