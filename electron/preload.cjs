const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop integration APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // Widget management
  openWidget: (widgetId) => ipcRenderer.invoke('widget:open', widgetId),
  closeWidget: (widgetId) => ipcRenderer.invoke('widget:close', widgetId),
  togglePin: (widgetId, isPinned) => ipcRenderer.invoke('widget:toggle-pin', { widgetId, isPinned }),
  getWidgetPinState: (widgetId) => ipcRenderer.invoke('widget:get-pin-state', widgetId),
  getWidgetStates: () => ipcRenderer.invoke('widget:get-states'),
  removeAllWidgets: () => ipcRenderer.invoke('widget:remove-all'),
  setScale: (scaleFactor) => ipcRenderer.invoke('widget:set-scale', scaleFactor),
  setWidgetHeight: (widgetId, height) => ipcRenderer.invoke('widget:set-height', { widgetId, height }),

  // Settings & Window Management (W05)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  resetWidgetPositions: () => ipcRenderer.invoke('widget:reset-positions'),

  // Main window management
  openMainWindow: () => ipcRenderer.invoke('main:open'),
  minimizeMainWindow: () => ipcRenderer.invoke('main:minimize'),
  maximizeMainWindow: () => ipcRenderer.invoke('main:maximize'),
  closeMainWindow: () => ipcRenderer.invoke('main:close'),

  // Authoritative Session & Tasks Management (W04)
  getSessionSnapshot: () => ipcRenderer.invoke('session:get-snapshot'),
  startFocusSession: (taskId) => ipcRenderer.invoke('session:start', taskId),
  pauseFocusSession: () => ipcRenderer.invoke('session:pause'),
  resumeFocusSession: () => ipcRenderer.invoke('session:resume'),
  resetFocusSession: () => ipcRenderer.invoke('session:reset'),
  completeFocusSession: (sessionId) => ipcRenderer.invoke('session:complete', sessionId),
  selectActiveTask: (taskId) => ipcRenderer.invoke('session:select-active', taskId),
  addTask: (title, durationEst) => ipcRenderer.invoke('tasks:add', { title, durationEst }),
  toggleTask: (taskId) => ipcRenderer.invoke('tasks:toggle-complete', taskId),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),
  editTask: (taskId, title, durationEst) => ipcRenderer.invoke('tasks:edit', { taskId, title, durationEst }),
  seedSampleTasks: () => ipcRenderer.invoke('tasks:seed-samples'),

  // Stickk Durable Notes & Drawings (W06)
  getStickkPages: () => ipcRenderer.invoke('stickk:get-pages'),
  saveStickkPages: (payload) => ipcRenderer.invoke('stickk:save-pages', payload),
  exportStickkNotes: () => ipcRenderer.invoke('stickk:export'),
  importStickkNotes: (importData) => ipcRenderer.invoke('stickk:import', importData),

  // Listeners
  onWidgetStateChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('widget:state-changed', handler);
    return () => ipcRenderer.removeListener('widget:state-changed', handler);
  },
  onSettingsChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  },
  onSessionSnapshot: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('session:snapshot-update', handler);
    return () => ipcRenderer.removeListener('session:snapshot-update', handler);
  },
  onStickkPagesUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stickk:pages-updated', handler);
    return () => ipcRenderer.removeListener('stickk:pages-updated', handler);
  },
});
