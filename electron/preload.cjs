const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, minimal desktop integration APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
});
