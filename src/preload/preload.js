// Preload scripts for Supru
// Expose a minimal API to the renderer via contextBridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the Electron IPC renderer module without exposing the entire object
contextBridge.exposeInMainWorld(
  'supru',
  {
    // Pill geometry persistence
    getPillGeometry: () => ipcRenderer.invoke('supru:get-pill-geometry'),
    setPillGeometry: (geometry) => ipcRenderer.invoke('supru:set-pill-geometry'),

    // File attachments
    attachFiles: () => ipcRenderer.invoke('supru:attach-files'),

    // File system operations
    fs: {
      list: (relativePath) => ipcRenderer.invoke('fs:list', relativePath),
      read: (relativePath, options) => ipcRenderer.invoke('fs:read', relativePath, options),
      write: (relativePath, content) => ipcRenderer.invoke('fs:write', relativePath, content),
      edit: (relativePath, oldString, newString) => ipcRenderer.invoke('fs:edit', relativePath, oldString, newString),
      move: (fromRelativePath, toRelativePath) => ipcRenderer.invoke('fs:move', fromRelativePath, toRelativePath),
      delete: (relativePath) => ipcRenderer.invoke('fs:delete', relativePath),
      search: (query, glob) => ipcRenderer.invoke('fs:search', query, glob),
      openProjectRoot: () => ipcRenderer.invoke('fs:openProjectRoot'),
      getLastProjectRoot: () => ipcRenderer.invoke('fs:getLastProjectRoot'),
      setProjectRoot: (rootPath) => ipcRenderer.invoke('fs:setProjectRoot', rootPath),
      mkdir: (relativePath) => ipcRenderer.invoke('fs:mkdir', relativePath),
      copy: (fromRelativePath, toRelativePath) => ipcRenderer.invoke('fs:copy', fromRelativePath, toRelativePath)
    },

    // Provider operations
    providers: {
      list: () => ipcRenderer.invoke('providers:list'),
      add: (providerData) => ipcRenderer.invoke('providers:add', providerData),
      remove: (id) => ipcRenderer.invoke('providers:remove', id),
      update: (id, updates) => ipcRenderer.invoke('providers:update', id, updates),
      get: (id) => ipcRenderer.invoke('providers:get', id),
      test: (id) => ipcRenderer.invoke('providers:test', id),
      fetchModels: (id) => ipcRenderer.invoke('providers:fetchModels', id),
      chatCompletion: (providerId, messages, options, model) => ipcRenderer.invoke('providers:chatCompletion', providerId, messages, options, model),
      onChatChunk: (callback) => {
        const handler = (event, streamId, chunk) => callback(streamId, chunk);
        ipcRenderer.on('chat:chunk', handler);
        return () => ipcRenderer.off('chat:chunk', handler);
      },
      onChatEnd: (callback) => {
        const handler = (event, streamId) => callback(streamId);
        ipcRenderer.on('chat:end', handler);
        return () => ipcRenderer.off('chat:end', handler);
      },
      onChatError: (callback) => {
        const handler = (event, streamId, error) => callback(streamId, error);
        ipcRenderer.on('chat:error', handler);
        return () => ipcRenderer.off('chat:error', handler);
      },
    },

    // Secret operations
    secrets: {
      set: (name, value) => ipcRenderer.invoke('secrets:set', name, value),
      remove: (name) => ipcRenderer.invoke('secrets:remove', name),
      list: () => ipcRenderer.invoke('secrets:list'),
      has: (name) => ipcRenderer.invoke('secrets:has', name),
    },

    // Pty operations
    pty: {
      create: (cwd, args) => ipcRenderer.invoke('pty:create', cwd, args),
      write: (termId, data) => ipcRenderer.send('pty:write', termId, data),
      resize: (termId, size) => ipcRenderer.send('pty:resize', termId, size),
      kill: (termId) => ipcRenderer.send('pty:kill', termId),
      onData: (callback) => {
        ipcRenderer.on('pty:data', (event, termId, data) => {
          callback(termId, data);
        });
      },
      onExit: (callback) => {
        ipcRenderer.on('pty:exit', (event, termId, exitCode) => {
          callback(termId, exitCode);
        });
      }
    },

    // For file system change events (internal use)
    fsChange: {
      on: (callback) => {
        ipcRenderer.on('fs-change', (event, change) => {
          callback(change);
        });
      }
    },

    // Placeholder for future API methods
    ping: () => 'pong',

    // Agent runner operations
    agentRunner: {
      run: (agentId, command, args, cwd) => ipcRenderer.invoke('agent:run', agentId, command, args, cwd),
      stop: (agentId) => ipcRenderer.invoke('agent:stop', agentId),
      getOutput: (agentId) => ipcRenderer.invoke('agent:getOutput', agentId),
      isRunning: (agentId) => ipcRenderer.invoke('agent:isRunning', agentId),
      onData: (callback) => {
        ipcRenderer.on('agent:data', (event, agentId, type, data) => {
          callback(agentId, type, data);
        });
      },
      onExit: (callback) => {
        ipcRenderer.on('agent:exit', (event, agentId, code, signal) => {
          callback(agentId, code, signal);
        });
      }
    }
  }
);