export type ViewMode = 'tasks' | 'focus' | 'settings';
export type WindowWidthMode = 'mini340' | 'window480' | 'expanded';

export type WidgetId = 'main' | 'flowcus' | 'playz' | 'stickk' | 'blockz' | 'quotz' | 'ayah' | 'statz' | 'rowz' | 'hub';
export type ManagerTab = 'home' | 'widgets' | 'favorites' | 'customize' | 'settings';

export interface WidgetMeta {
  id: 'flowcus' | 'playz' | 'stickk' | 'blockz' | 'quotz' | 'ayah' | 'statz' | 'rowz';
  name: string;
  tagline: string;
  category: 'Productivity' | 'Games' | 'Utility' | 'Mindfulness' | 'System';
  badgeColor: string;
  rating?: string;
  downloads?: string;
  description: string;
  features: string[];
  defaultWidth: number;
  defaultHeight: number;
  previewUrl?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  durationEst: string;
  category?: string;
  inProgress?: boolean;
  targetDate: string; // YYYY-MM-DD local date
  createdAt: string;  // ISO timestamp
  completedAt?: string;
}

export interface DailyStats {
  completedTasks: number;
  totalTasks: number;
  focusMinutes: number;
  streakDays: number;
}

/* Stickk Sticky Note Types */
export type StickkTheme = 'theme-yellow' | 'theme-orange' | 'theme-mint' | 'theme-lavender' | 'theme-dark';
export type StickkFont = 'font-caveat' | 'font-comic' | 'font-gloria' | 'font-pacifico' | 'font-marker';

export interface StickkStrokePoint {
  x: number; // Normalized [0, 1] horizontal position
  y: number; // Normalized [0, 1] vertical position
}

export interface StickkStroke {
  id: string;
  tool: 'draw' | 'eraser';
  color: string;
  size: number;
  points: StickkStrokePoint[];
}

export interface StickkPage {
  id: string;
  title: string;
  theme: StickkTheme;
  font: StickkFont;
  text: string;
  strokes?: StickkStroke[]; // Vector strokes (Audit 21)
  doodleDataUrl?: string; // Raster cache for backward compatibility
  updatedAt: string;
  deletedAt?: string; // Soft deletion for undo/trash retention (Audit 23)
}

export interface StickkExportData {
  version: 1;
  exportedAt: string;
  pages: StickkPage[];
  trash?: StickkPage[];
}

/* Playz Tic-Tac-Toe Types */
export type PlayzMode = 'Easy' | 'Hard' | '2P';
export type PlayzCell = 'X' | 'O' | null;

export interface PlayzSeriesState {
  scoreX: number;
  scoreO: number;
  currentRound: number;
  maxRounds: number;
  mode: PlayzMode;
}

/* Statz System Memory Types */
export interface ProcessMemoryUsage {
  name: string;
  pid: number;
  memoryBytes: number;
  memoryFormatted: string;
  percentOfTotal: number;
}

export interface SystemMemoryStats {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  cachedBytes?: number;
  usedPercent: number;
  totalFormatted: string;
  usedFormatted: string;
  freeFormatted: string;
  topProcesses: ProcessMemoryUsage[];
  totalProcesses?: number;
}

/* Authoritative Electron IPC & Bridge Contracts (W09 - Audit 30) */
export interface AppSettings {
  startWithWindows: boolean;
  startMinimized: boolean;
  closeToTray: boolean;
  alwaysOnTopDefault: boolean;
  soundEnabled: boolean;
  scaleFactor: number;
  accentColor: string;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface StoredTimerData {
  status: TimerStatus;
  initialDurationSeconds: number;
  remainingSeconds: number;
  targetEndTimeMs: number | null;
  currentSession: number;
  totalSessions: number;
  activeTaskId: string | null;
  lastUpdatedMs: number;
}

export interface SessionSnapshot {
  session: StoredTimerData | null;
  tasks: TaskItem[];
  focusedMinutesToday: number;
  activeTaskId: string | null;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  version: string;

  // Widget management
  openWidget: (widgetId: string) => Promise<{ success: boolean; error?: string }>;
  closeWidget: (widgetId: string) => Promise<{ success: boolean }>;
  togglePin: (widgetId: string, isPinned: boolean) => Promise<{ success: boolean; pinned: boolean }>;
  getWidgetPinState: (widgetId: string) => Promise<boolean>;
  getWidgetStates: () => Promise<Record<string, boolean>>;
  removeAllWidgets: () => Promise<{ success: boolean }>;
  setScale: (scaleFactor: number) => Promise<{ success: boolean; scaleFactor: number }>;
  setWidgetHeight: (widgetId: string, height: number) => Promise<{ success: boolean; height: number }>;

  // Settings & Window Management (W05)
  getSettings: () => Promise<AppSettings>;
  saveSetting: (key: string, value: unknown) => Promise<{ success: boolean; key: string; value: unknown }>;
  resetWidgetPositions: () => Promise<{ success: boolean }>;

  // Main window management
  openMainWindow: () => Promise<{ success: boolean }>;
  minimizeMainWindow: () => Promise<{ success: boolean }>;
  maximizeMainWindow: () => Promise<{ success: boolean }>;
  closeMainWindow: () => Promise<{ success: boolean }>;

  // Authoritative Session & Tasks Management (W04)
  getSessionSnapshot: () => Promise<SessionSnapshot>;
  startFocusSession: (taskId?: string) => Promise<unknown>;
  pauseFocusSession: () => Promise<unknown>;
  resumeFocusSession: () => Promise<unknown>;
  resetFocusSession: () => Promise<unknown>;
  completeFocusSession: (sessionId: string) => Promise<unknown>;
  selectActiveTask: (taskId: string) => Promise<unknown>;
  addTask: (title: string, durationEst: string) => Promise<unknown>;
  toggleTask: (taskId: string) => Promise<unknown>;
  deleteTask: (taskId: string) => Promise<unknown>;
  editTask: (taskId: string, title: string, durationEst: string) => Promise<unknown>;
  seedSampleTasks: () => Promise<unknown>;

  // Stickk Durable Notes & Drawings (W06)
  getStickkPages: () => Promise<{ success?: boolean; pages: StickkPage[]; trash?: StickkPage[] }>;
  saveStickkPages: (payload: { pages: StickkPage[]; trash?: StickkPage[] }) => Promise<{ success: boolean; error?: string }>;
  exportStickkNotes: () => Promise<{ success: boolean; data?: unknown }>;
  importStickkNotes: (importData: unknown) => Promise<{ success: boolean; pages?: StickkPage[]; error?: string }>;

  // Statz System RAM & Process Monitor
  getMemoryStats?: () => Promise<SystemMemoryStats>;
  openTaskManager?: () => Promise<{ success: boolean }>;

  // Listeners
  onWidgetStateChange: (callback: (data: { open: Record<string, boolean>; pinned: Record<string, boolean>; restoreOnStartup: Record<string, boolean> }) => void) => () => void;
  onSettingsChange: (callback: (settings: Partial<AppSettings>) => void) => () => void;
  onSessionSnapshot: (callback: (snapshot: SessionSnapshot) => void) => () => void;
  onStickkPagesUpdate: (callback: (pages: StickkPage[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

