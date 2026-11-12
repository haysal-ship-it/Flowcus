const { app, BrowserWindow, shell, ipcMain, screen, Tray, Menu, nativeImage, session, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  ALLOWED_WIDGET_IDS,
  ALLOWED_SETTINGS_KEYS,
  isValidAppUrl,
  validateSenderFrame,
  validateWidgetId,
  validatePinPayload,
  validateHeightPayload,
  validateScalePayload,
  validateSettingPayload,
  validateTaskId,
  validateTaskPayload,
  validateSessionAction,
  validateStickkPage,
  validateStickkPagesPayload,
  shouldInterceptManagerClose,
  computeNextRestoreIntent,
} = require('./ipcSecurity.cjs');
const {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
  validateSchema,
  migrateLegacyState,
  atomicWriteFileSync,
  DurableStore,
} = require('./durableStore.cjs');
const { SessionService } = require('./sessionService.cjs');
const {
  getDefaultWidgetBounds,
  clampBoundsToDisplays,
} = require('./displayBounds.cjs');

// Set Application User Model ID for Windows Taskbar & Start Menu grouping
app.setAppUserModelId('com.uwidgets.desktop');

// Explicit quit flag (Audit 08: ensures Tray Quit and shutdown terminate all processes)
app.isQuitting = false;

// Enforce single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Window references
let mainWindow = null;
let tray = null;

const widgetWindows = {
  flowcus: null,
  playz: null,
  stickk: null,
};

// Persistent state file in userData
const stateFilePath = path.join(app.getPath('userData'), 'uwidgets_desktop_state.json');

const durableStore = new DurableStore(stateFilePath);

function loadState() {
  const loadResult = durableStore.load();
  if (loadResult.success) {
    return loadResult.state.desktop;
  }
  if (loadResult.code === 'UNSUPPORTED_NEWER_VERSION') {
    console.error(`[DurableStore] ${loadResult.message}`);
    // Do not overwrite disk; fall back to safe in-memory envelope
    return getDefaultState().desktop;
  }
  console.warn('[DurableStore] Primary state unrecoverable; using default envelope.');
  return getDefaultState().desktop;
}

let appState = loadState();

function broadcastSessionSnapshot(snapshot) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session:snapshot-update', snapshot);
  }
  if (widgetWindows.flowcus && !widgetWindows.flowcus.isDestroyed()) {
    widgetWindows.flowcus.webContents.send('session:snapshot-update', snapshot);
  }
}

const sessionService = new SessionService({
  durableStore,
  broadcastFn: broadcastSessionSnapshot,
  powerMonitor,
});

function saveState() {
  try {
    const envelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      desktop: { ...appState },
      tasks: sessionService ? sessionService.state.tasks : (durableStore.state?.tasks || []),
      taskHistory: sessionService ? sessionService.state.taskHistory : (durableStore.state?.taskHistory || []),
      activeSession: sessionService ? sessionService.state.activeSession : (durableStore.state?.activeSession || null),
      dayFocusMinutes: sessionService ? sessionService.state.dayFocusMinutes : (durableStore.state?.dayFocusMinutes || {}),
      completionLedger: sessionService ? sessionService.state.completionLedger : (durableStore.state?.completionLedger || {}),
      stickkPages: durableStore.state?.stickkPages || [],
      stickkTrash: durableStore.state?.stickkTrash || [],
      migrationMarkers: durableStore.state?.migrationMarkers || {},
    };
    durableStore.saveSync(envelope);
  } catch (e) {
    console.error('Failed to save desktop state atomically:', e);
  }
}

function broadcastStateChange() {
  const payload = {
    open: {
      flowcus: Boolean(widgetWindows.flowcus && !widgetWindows.flowcus.isDestroyed()),
      playz: Boolean(widgetWindows.playz && !widgetWindows.playz.isDestroyed()),
      stickk: Boolean(widgetWindows.stickk && !widgetWindows.stickk.isDestroyed()),
    },
    pinned: { ...appState.pinned },
    restoreOnStartup: { ...appState.restoreOnStartup },
  };

  // Audit 14: Broadcast state changes to manager AND all floating widgets
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('widget:state-changed', payload);
  }
  for (const [id, win] of Object.entries(widgetWindows)) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('widget:state-changed', payload);
    }
  }
  updateTrayMenu();
}

function broadcastSettingsChange(customSettings) {
  const payload = customSettings || {
    startWithWindows: Boolean(appState.startWithWindows),
    startMinimized: Boolean(appState.startMinimized),
    scaleFactor: appState.scaleFactor || 1.0,
    soundEffects: appState.soundEffects !== false,
    alwaysOnTopDefault: Boolean(appState.alwaysOnTopDefault),
    closeToTray: appState.closeToTray !== false,
    accentColor: appState.accentColor || '#D05300',
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', payload);
  }
  for (const [id, win] of Object.entries(widgetWindows)) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings:changed', payload);
    }
  }
}

/**
 * Audit 13 & AC 8: Reposition active floating widgets if display metrics change
 * or if a secondary monitor is unplugged/removed.
 */
function repositionWidgetsSafely() {
  const allDisplays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  let hasChanged = false;
  ALLOWED_WIDGET_IDS.forEach(widgetId => {
    const win = widgetWindows[widgetId];
    if (win && !win.isDestroyed()) {
      const currentBounds = win.getBounds();
      const clamped = clampBoundsToDisplays(currentBounds, allDisplays, primaryDisplay);
      if (clamped.wasRepositioned) {
        win.setBounds({
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
        }, true);
        if (!appState.positions) appState.positions = {};
        appState.positions[widgetId] = { x: clamped.x, y: clamped.y };
        hasChanged = true;
      }
    }
  });

  if (hasChanged) {
    saveState();
    broadcastStateChange();
  }
}

function getAppUrl(route) {
  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
  if (isDev) {
    const baseDev = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    return `${baseDev}?window=${route}`;
  }
  return `file://${path.join(__dirname, '../dist/index.html')}?window=${route}`;
}

/**
 * Audit 26: Determine role of BrowserWindow sending IPC call
 */
function getWindowRole(win) {
  if (!win || win.isDestroyed()) return null;
  if (win === mainWindow) return { role: 'manager' };
  for (const [id, w] of Object.entries(widgetWindows)) {
    if (w === win) return { role: 'widget', widgetId: id };
  }
  return null;
}

/**
 * Audit 26: Validate IPC sender, top-level frame, origin, and window role
 */
function validateIpcSender(event, options = {}) {
  if (!event || !event.sender) {
    return { valid: false, reason: 'Missing sender' };
  }
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) {
    return { valid: false, reason: 'Sender window destroyed or not found' };
  }

  if (!validateSenderFrame(event.senderFrame)) {
    return { valid: false, reason: 'Subframe sender rejected' };
  }

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
  const currentUrl = event.sender.getURL();
  if (!isValidAppUrl(currentUrl, app.isPackaged, isDev)) {
    return { valid: false, reason: 'Untrusted sender URL origin' };
  }

  const windowInfo = getWindowRole(senderWindow);
  if (!windowInfo) {
    return { valid: false, reason: 'Unregistered window' };
  }

  if (options.allowedRoles && !options.allowedRoles.includes(windowInfo.role)) {
    return { valid: false, reason: `Role ${windowInfo.role} not permitted` };
  }

  if (options.targetWidgetId && windowInfo.role === 'widget' && windowInfo.widgetId !== options.targetWidgetId) {
    return { valid: false, reason: 'Widget window cannot control another widget' };
  }

  return { valid: true, senderWindow, role: windowInfo.role, widgetId: windowInfo.widgetId };
}

/**
 * Audit 27: Consistent navigation, popup, and webview protections across every window
 */
function setupWindowSecurity(win) {
  if (!win || win.isDestroyed()) return;

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isValidAppUrl(navigationUrl, app.isPackaged, isDev)) {
      event.preventDefault();
      try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(navigationUrl).catch(() => {});
        }
      } catch {}
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url).catch(() => {});
      }
    } catch {}
    return { action: 'deny' };
  });

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/**
 * Audit 27: Session Content Security Policy
 */
function setupAppSecurity() {
  if (!session.defaultSession) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' data:; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 ws://localhost:3000 ws://127.0.0.1:3000;"
        ],
      },
    });
  });
}

// ============================================================================
// TIER 1: MAIN APPLICATION WINDOW (Screenshots 1, 2, 3)
// ============================================================================
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 960,
    minHeight: 620,
    title: 'Uwidgets',
    backgroundColor: '#0E0E0E',
    darkTheme: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  setupWindowSecurity(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const url = getAppUrl('main');
  if (url.startsWith('http')) {
    mainWindow.loadURL(url).catch(err => {
      console.error('Failed to load main URL:', err);
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { window: 'main' } });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { window: 'main' } });
  }

  // Audit 08: Intercept close to hide in tray only during normal execution, NOT during app quit
  mainWindow.on('close', (e) => {
    const hasActiveWidgets = Object.values(widgetWindows).some(w => w && !w.isDestroyed());
    const shouldIntercept = shouldInterceptManagerClose({
      isQuitting: Boolean(app.isQuitting),
      hasActiveWidgets,
      closeToTray: appState.closeToTray !== false,
    });

    if (shouldIntercept) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ============================================================================
// TIER 2: FLOATING DESKTOP WIDGET WINDOWS (Screenshot 5)
// ============================================================================
function createFloatingWidgetWindow(widgetId) {
  if (!validateWidgetId(widgetId)) return null;

  if (widgetWindows[widgetId] && !widgetWindows[widgetId].isDestroyed()) {
    widgetWindows[widgetId].show();
    widgetWindows[widgetId].focus();
    broadcastStateChange();
    return widgetWindows[widgetId];
  }

  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
  const allDisplays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const defaultBounds = getDefaultWidgetBounds(widgetId, primaryDisplay.workArea);

  const savedPos = appState.positions?.[widgetId];
  const targetBounds = {
    x: savedPos?.x !== undefined ? savedPos.x : defaultBounds.x,
    y: savedPos?.y !== undefined ? savedPos.y : defaultBounds.y,
    width: defaultBounds.width,
    height: defaultBounds.height,
  };

  // Audit 13: Clamp bounds across connected displays and negative coordinate spaces
  const clamped = clampBoundsToDisplays(targetBounds, allDisplays, primaryDisplay);
  if (clamped.wasRepositioned) {
    if (!appState.positions) appState.positions = {};
    appState.positions[widgetId] = { x: clamped.x, y: clamped.y };
    saveState();
  }

  // Audit 11: Consistent global pin default and explicit per-widget overrides
  const isPinned = appState.pinned?.[widgetId] !== undefined
    ? Boolean(appState.pinned[widgetId])
    : (appState.alwaysOnTopDefault !== undefined ? Boolean(appState.alwaysOnTopDefault) : true);

  const win = new BrowserWindow({
    width: clamped.width,
    height: clamped.height,
    x: clamped.x,
    y: clamped.y,
    minWidth: 280,
    minHeight: 320,
    title: `Uwidgets - ${widgetId}`,
    backgroundColor: '#00000000',
    transparent: true,
    frame: false,
    hasShadow: true,
    resizable: true,
    darkTheme: true,
    show: false,
    alwaysOnTop: isPinned,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  widgetWindows[widgetId] = win;

  // Audit 09: Record active restoration intent on explicit widget creation
  appState.restoreOnStartup = computeNextRestoreIntent({
    currentRestoreMap: appState.restoreOnStartup,
    action: 'open',
    widgetId,
  });
  appState.open = { ...appState.restoreOnStartup };
  saveState();

  setupWindowSecurity(win);

  win.once('ready-to-show', () => {
    // Audit 12: Apply saved scale factor before showing newly created window
    if (appState.scaleFactor) {
      win.webContents.setZoomFactor(appState.scaleFactor);
    }
    win.show();
    broadcastStateChange();
  });

  win.webContents.on('did-finish-load', () => {
    if (appState.scaleFactor) {
      win.webContents.setZoomFactor(appState.scaleFactor);
    }
  });

  // Track position changes when user moves widget across desktop
  win.on('moved', () => {
    if (!win.isDestroyed()) {
      const bounds = win.getBounds();
      if (!appState.positions) appState.positions = {};
      appState.positions[widgetId] = { x: bounds.x, y: bounds.y };
      saveState();
    }
  });

  win.on('closed', () => {
    widgetWindows[widgetId] = null;

    // Audit 09: Preserve restoreOnStartup when closing due to app.isQuitting
    appState.restoreOnStartup = computeNextRestoreIntent({
      currentRestoreMap: appState.restoreOnStartup,
      action: 'window_closed',
      widgetId,
      isQuitting: Boolean(app.isQuitting),
    });
    appState.open = { ...appState.restoreOnStartup };
    saveState();
    broadcastStateChange();

    // If main window is closed/hidden and no widgets are left, quit
    if (!app.isQuitting) {
      const anyWidgetActive = Object.values(widgetWindows).some(w => w && !w.isDestroyed());
      const isMainActive = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
      if (!anyWidgetActive && !isMainActive && process.platform !== 'darwin' && !process.argv.includes('--perf-leak-test')) {
        app.quit();
      }
    }
  });

  const url = getAppUrl(widgetId);
  if (url.startsWith('http')) {
    win.loadURL(url).catch(err => {
      console.error(`Failed to load dev widget URL for ${widgetId}:`, err);
      win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { window: widgetId } });
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { window: widgetId } });
  }

  return win;
}

function closeFloatingWidgetWindow(widgetId, isExplicitRemoval = false) {
  if (!validateWidgetId(widgetId)) return;

  if (isExplicitRemoval) {
    // Audit 09: Explicit user removal updates restoration intent
    appState.restoreOnStartup = computeNextRestoreIntent({
      currentRestoreMap: appState.restoreOnStartup,
      action: 'explicit_close',
      widgetId,
    });
    appState.open = { ...appState.restoreOnStartup };
    saveState();
  }

  if (widgetWindows[widgetId] && !widgetWindows[widgetId].isDestroyed()) {
    widgetWindows[widgetId].close();
  }
}

// ============================================================================
// SYSTEM TRAY INTEGRATION
// ============================================================================
function createTray() {
  if (tray) return;

  // 16x16 fallback monochrome icon if icon file is absent
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkoBAwUqifYdQAYjTBqAHU1kCMhhEw/f/P/2eio2FkA0bDCBg1gCgNAABUbgmP5p+tHAAAAABJRU5ErkJggg==',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('Uwidgets — Desktop Widgets');
  tray.on('double-click', () => {
    createMainWindow();
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const isFlowcusOpen = Boolean(widgetWindows.flowcus && !widgetWindows.flowcus.isDestroyed());
  const isPlayzOpen = Boolean(widgetWindows.playz && !widgetWindows.playz.isDestroyed());
  const isStickkOpen = Boolean(widgetWindows.stickk && !widgetWindows.stickk.isDestroyed());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Uwidgets Dashboard',
      click: () => createMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Flowcus (Tasks & Focus)',
      type: 'checkbox',
      checked: isFlowcusOpen,
      click: () => (isFlowcusOpen ? closeFloatingWidgetWindow('flowcus', true) : createFloatingWidgetWindow('flowcus')),
    },
    {
      label: 'Playz (Tic-Tac-Toe)',
      type: 'checkbox',
      checked: isPlayzOpen,
      click: () => (isPlayzOpen ? closeFloatingWidgetWindow('playz', true) : createFloatingWidgetWindow('playz')),
    },
    {
      label: 'Stickk (Sticky Sketchpad)',
      type: 'checkbox',
      checked: isStickkOpen,
      click: () => (isStickkOpen ? closeFloatingWidgetWindow('stickk', true) : createFloatingWidgetWindow('stickk')),
    },
    { type: 'separator' },
    {
      label: 'Remove All Desktop Widgets',
      click: () => {
        appState.restoreOnStartup = computeNextRestoreIntent({
          currentRestoreMap: appState.restoreOnStartup,
          action: 'remove_all',
        });
        appState.open = { ...appState.restoreOnStartup };
        saveState();
        ALLOWED_WIDGET_IDS.forEach(id => closeFloatingWidgetWindow(id, false));
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Uwidgets',
      click: () => {
        // Audit 08: Clean Tray Quit bypassing all close event cancellations
        app.isQuitting = true;
        for (const [id, w] of Object.entries(widgetWindows)) {
          if (w && !w.isDestroyed()) {
            w.destroy();
            widgetWindows[id] = null;
          }
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
          mainWindow = null;
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ============================================================================
// IPC COMMUNICATION HANDLERS (Audit 26: Sender & Schema Validation)
// ============================================================================
ipcMain.handle('widget:open', (event, widgetId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid || !validateWidgetId(widgetId)) return false;

  createFloatingWidgetWindow(widgetId);
  return true;
});

ipcMain.handle('widget:close', (event, widgetId) => {
  if (!validateWidgetId(widgetId)) return false;
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'], targetWidgetId: widgetId });
  if (!check.valid) return false;

  closeFloatingWidgetWindow(widgetId, true);
  return true;
});

ipcMain.handle('widget:toggle-pin', (event, { widgetId, isPinned } = {}) => {
  if (!validateWidgetId(widgetId) || !validatePinPayload(isPinned)) return false;
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'], targetWidgetId: widgetId });
  if (!check.valid) return false;

  if (!appState.pinned) appState.pinned = {};
  appState.pinned[widgetId] = isPinned;
  saveState();

  if (widgetWindows[widgetId] && !widgetWindows[widgetId].isDestroyed()) {
    widgetWindows[widgetId].setAlwaysOnTop(isPinned, 'screen-saver');
  }
  broadcastStateChange();
  return isPinned;
});

ipcMain.handle('widget:get-pin-state', (event, widgetId) => {
  if (!validateWidgetId(widgetId)) return false;
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return false;

  return appState.pinned?.[widgetId] ?? false;
});

ipcMain.handle('widget:get-states', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) {
    return { open: {}, pinned: {} };
  }

  return {
    open: {
      flowcus: Boolean(widgetWindows.flowcus && !widgetWindows.flowcus.isDestroyed()),
      playz: Boolean(widgetWindows.playz && !widgetWindows.playz.isDestroyed()),
      stickk: Boolean(widgetWindows.stickk && !widgetWindows.stickk.isDestroyed()),
    },
    pinned: { ...appState.pinned },
    restoreOnStartup: { ...appState.restoreOnStartup },
  };
});

ipcMain.handle('widget:remove-all', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  appState.restoreOnStartup = computeNextRestoreIntent({
    currentRestoreMap: appState.restoreOnStartup,
    action: 'remove_all',
  });
  appState.open = { ...appState.restoreOnStartup };
  saveState();

  ALLOWED_WIDGET_IDS.forEach(id => closeFloatingWidgetWindow(id, false));
  return true;
});

ipcMain.handle('widget:set-height', (event, { widgetId, height } = {}) => {
  if (!validateWidgetId(widgetId) || !validateHeightPayload(height)) return false;
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'], targetWidgetId: widgetId });
  if (!check.valid) return false;

  const win = widgetWindows[widgetId];
  if (win && !win.isDestroyed()) {
    const bounds = win.getBounds();
    const targetHeight = Math.round(height);
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width || 312, height: targetHeight }, true);
  }
  return true;
});

ipcMain.handle('widget:set-scale', (event, scaleFactor) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid || !validateScalePayload(scaleFactor)) return false;

  appState.scaleFactor = scaleFactor;
  saveState();
  Object.values(widgetWindows).forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.setZoomFactor(scaleFactor);
    }
  });
  broadcastSettingsChange();
  return scaleFactor;
});

ipcMain.handle('settings:get', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return {};

  return {
    startWithWindows: Boolean(appState.startWithWindows),
    startMinimized: Boolean(appState.startMinimized),
    scaleFactor: appState.scaleFactor || 1.0,
    soundEffects: appState.soundEffects !== false,
    alwaysOnTopDefault: Boolean(appState.alwaysOnTopDefault),
    closeToTray: appState.closeToTray !== false,
    accentColor: appState.accentColor || '#D05300',
  };
});

ipcMain.handle('settings:set', (event, { key, value } = {}) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  const valCheck = validateSettingPayload(key, value);
  if (!valCheck.valid) return false;

  appState[key] = value;
  saveState();

  if (key === 'startWithWindows') {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(value),
        path: app.getPath('exe'),
      });
    } catch (e) {
      console.error('Failed to update login item settings:', e);
    }
  }

  if (key === 'scaleFactor') {
    Object.values(widgetWindows).forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.setZoomFactor(value);
      }
    });
  }

  if (key === 'alwaysOnTopDefault') {
    ALLOWED_WIDGET_IDS.forEach(widgetId => {
      if (appState.pinned?.[widgetId] === undefined) {
        const win = widgetWindows[widgetId];
        if (win && !win.isDestroyed()) {
          win.setAlwaysOnTop(Boolean(value), 'screen-saver');
        }
      }
    });
    broadcastStateChange();
  }

  broadcastSettingsChange();
  return true;
});

ipcMain.handle('widget:reset-positions', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  if (!appState.positions) appState.positions = {};

  ALLOWED_WIDGET_IDS.forEach(widgetId => {
    const defaultBounds = getDefaultWidgetBounds(widgetId, workArea);
    appState.positions[widgetId] = { x: defaultBounds.x, y: defaultBounds.y };

    const win = widgetWindows[widgetId];
    if (win && !win.isDestroyed()) {
      win.setBounds({
        x: defaultBounds.x,
        y: defaultBounds.y,
        width: defaultBounds.width,
        height: defaultBounds.height,
      }, true);
    }
  });

  saveState();
  broadcastStateChange();
  return true;
});

ipcMain.handle('main:open', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return false;

  createMainWindow();
  return true;
});

ipcMain.handle('main:minimize', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  return true;
});

ipcMain.handle('main:maximize', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  return true;
});

ipcMain.handle('main:close', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager'] });
  if (!check.valid) return false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  return true;
});

// Authoritative Session & Tasks Management Handlers (Audit 02, 04, 05, 07, 26)
ipcMain.handle('session:get-snapshot', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return null;
  return sessionService.getSnapshot();
});

ipcMain.handle('session:start', (event, taskId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  if (taskId && !validateTaskId(taskId)) return { success: false, error: 'INVALID_TASK_ID' };
  return sessionService.startSession(taskId);
});

ipcMain.handle('session:pause', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  return sessionService.pauseSession();
});

ipcMain.handle('session:resume', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  return sessionService.resumeSession();
});

ipcMain.handle('session:reset', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  return sessionService.resetSession();
});

ipcMain.handle('session:complete', (event, sessionId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  return sessionService.completeSession(sessionId);
});

ipcMain.handle('session:select-active', (event, taskId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  if (!validateTaskId(taskId)) return { success: false, error: 'INVALID_TASK_ID' };
  return sessionService.selectActiveTask(taskId);
});

ipcMain.handle('tasks:add', (event, { title, durationEst } = {}) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  const val = validateTaskPayload(title, durationEst);
  if (!val.valid) return { success: false, error: val.reason };
  return sessionService.addTask(title, durationEst);
});

ipcMain.handle('tasks:toggle-complete', (event, taskId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  if (!validateTaskId(taskId)) return { success: false, error: 'INVALID_TASK_ID' };
  return sessionService.toggleTask(taskId);
});

ipcMain.handle('tasks:delete', (event, taskId) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  if (!validateTaskId(taskId)) return { success: false, error: 'INVALID_TASK_ID' };
  return sessionService.deleteTask(taskId);
});

ipcMain.handle('tasks:edit', (event, { taskId, title, durationEst } = {}) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  if (!validateTaskId(taskId)) return { success: false, error: 'INVALID_TASK_ID' };
  const val = validateTaskPayload(title, durationEst);
  if (!val.valid) return { success: false, error: val.reason };
  return sessionService.editTask(taskId, title, durationEst);
});

ipcMain.handle('tasks:seed-samples', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };
  return sessionService.seedSampleTasks();
});

// ============================================================================
// STICKK NOTES & DRAWINGS PERSISTENCE (W06)
// ============================================================================
ipcMain.handle('stickk:get-pages', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };

  return {
    success: true,
    pages: durableStore.state?.stickkPages || [],
    trash: durableStore.state?.stickkTrash || [],
  };
});

ipcMain.handle('stickk:save-pages', (event, payload) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };

  const pages = Array.isArray(payload) ? payload : payload?.pages;
  const trash = Array.isArray(payload?.trash) ? payload.trash : (durableStore.state?.stickkTrash || []);

  const valCheck = validateStickkPagesPayload(pages);
  if (!valCheck.valid) {
    return { success: false, error: valCheck.reason };
  }

  if (payload?.trash !== undefined) {
    const trashVal = validateStickkPagesPayload(trash);
    if (!trashVal.valid) {
      return { success: false, error: `Invalid trash payload: ${trashVal.reason}` };
    }
  }

  if (!durableStore.state) durableStore.state = getDefaultState();
  durableStore.state.stickkPages = pages;
  durableStore.state.stickkTrash = trash;

  saveState();

  // Broadcast update to open windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stickk:pages-updated', { pages, trash });
  }
  if (widgetWindows.stickk && !widgetWindows.stickk.isDestroyed()) {
    widgetWindows.stickk.webContents.send('stickk:pages-updated', { pages, trash });
  }

  return { success: true };
});

ipcMain.handle('stickk:export', (event) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };

  return {
    success: true,
    exportData: {
      version: 1,
      exportedAt: new Date().toISOString(),
      pages: durableStore.state?.stickkPages || [],
      trash: durableStore.state?.stickkTrash || [],
    },
  };
});

ipcMain.handle('stickk:import', (event, importData) => {
  const check = validateIpcSender(event, { allowedRoles: ['manager', 'widget'] });
  if (!check.valid) return { success: false, error: 'UNAUTHORIZED_SENDER' };

  if (!importData || typeof importData !== 'object' || !Array.isArray(importData.pages)) {
    return { success: false, error: 'Invalid import format. Expected object with pages array.' };
  }

  const valCheck = validateStickkPagesPayload(importData.pages);
  if (!valCheck.valid) {
    return { success: false, error: `Malformed import: ${valCheck.reason}` };
  }

  const existingPages = durableStore.state?.stickkPages || [];
  const existingIds = new Set(existingPages.map(p => p.id));
  const mergedPages = [...existingPages];

  for (const p of importData.pages) {
    if (existingIds.has(p.id)) {
      const idx = mergedPages.findIndex(item => item.id === p.id);
      if (idx !== -1) mergedPages[idx] = p;
    } else {
      mergedPages.push(p);
    }
  }

  if (!durableStore.state) durableStore.state = getDefaultState();
  durableStore.state.stickkPages = mergedPages;
  if (Array.isArray(importData.trash)) {
    durableStore.state.stickkTrash = importData.trash;
  }

  saveState();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stickk:pages-updated', { pages: mergedPages, trash: durableStore.state.stickkTrash });
  }
  if (widgetWindows.stickk && !widgetWindows.stickk.isDestroyed()) {
    widgetWindows.stickk.webContents.send('stickk:pages-updated', { pages: mergedPages, trash: durableStore.state.stickkTrash });
  }

  return { success: true, count: importData.pages.length };
});

// Second instance focus
app.on('second-instance', () => {
  createMainWindow();
});

// App Lifecycle
app.whenReady().then(() => {
  setupAppSecurity();
  createTray();

  // Audit 09: Restore user intended desktop widgets from restoreOnStartup
  const toRestore = appState.restoreOnStartup || appState.open || {};
  ALLOWED_WIDGET_IDS.forEach(id => {
    if (toRestore[id]) {
      createFloatingWidgetWindow(id);
    }
  });

  // Open the main dashboard if not configured to start minimized
  if (!appState.startMinimized) {
    createMainWindow();
  }

  // Audit 13 & AC 8: Monitor screen metric changes and removals
  screen.on('display-removed', () => {
    repositionWidgetsSafely();
  });
  screen.on('display-metrics-changed', () => {
    repositionWidgetsSafely();
  });

  // Performance benchmark diagnostic mode (Audit 36: 10-Cycle Widget Open/Close Leak Investigation)
  if (process.argv.includes('--perf-leak-test')) {
    (async () => {
      const widgets = ['flowcus', 'playz', 'stickk'];
      for (let cycle = 1; cycle <= 10; cycle++) {
        for (const wid of widgets) {
          createFloatingWidgetWindow(wid);
          await new Promise(r => setTimeout(r, 180));
          closeFloatingWidgetWindow(wid, true);
          await new Promise(r => setTimeout(r, 100));
        }
      }
    })();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Audit 08: Unconditionally mark isQuitting before window teardown begins
app.on('before-quit', () => {
  app.isQuitting = true;
});
