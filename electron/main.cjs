const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Set Application User Model ID for Windows Taskbar & Start Menu grouping
app.setAppUserModelId('com.flowcus.desktop');

// Enforce single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function createWindow() {
  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    title: 'Flowcus',
    backgroundColor: '#0E0E0E',
    darkTheme: true,
    show: false, // Prevents visual flash; reveals when ready-to-show
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  // Reveal window cleanly once DOM and assets are rendered
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Strict Navigation Security: Block unrequested top-frame navigations
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost:3000') && !navigationUrl.startsWith('http://127.0.0.1:3000')) {
      event.preventDefault();
      shell.openExternal(navigationUrl).catch(() => {});
    }
  });

  // Block child window creation; route external links to system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Load entry point: development server or packaged production build
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error('Failed to load dev URL, falling back to local file:', err);
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
      console.error('Failed to load packaged index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// When a second instance is launched, focus the existing main window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Initialize when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed on Windows and Linux
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
