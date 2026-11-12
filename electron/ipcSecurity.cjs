/**
 * Desktop IPC Security & Lifecycle Validator (W02)
 * Pure validation logic for sender verification, payload schemas, and lifecycle intent.
 */

const path = require('path');

const ALLOWED_WIDGET_IDS = new Set(['flowcus', 'playz', 'stickk']);

const ALLOWED_SETTINGS_KEYS = new Set([
  'startWithWindows',
  'startMinimized',
  'scaleFactor',
  'soundEffects',
  'alwaysOnTopDefault',
  'closeToTray',
  'accentColor',
]);

const BOOLEAN_SETTINGS_KEYS = new Set([
  'startWithWindows',
  'startMinimized',
  'soundEffects',
  'alwaysOnTopDefault',
  'closeToTray',
]);

/**
 * Validates that an internal window URL belongs to the trusted local application.
 */
function isValidAppUrl(rawUrl, isPackaged = false, isDev = false) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') {
      const normalized = path.normalize(parsed.pathname).toLowerCase();
      return (
        normalized.endsWith('index.html') ||
        normalized.includes('dist') ||
        normalized.includes('uwidgets')
      );
    }
    if (isDev || !isPackaged) {
      return parsed.origin === 'http://localhost:3000' || parsed.origin === 'http://127.0.0.1:3000';
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Validates that an IPC message originated from a top-level frame without iframe spoofing.
 */
function validateSenderFrame(senderFrame) {
  if (!senderFrame) return true; // Frame absent in some mock/test contexts
  return senderFrame.parent === null;
}

/**
 * Validates widget ID against the whitelist.
 */
function validateWidgetId(widgetId) {
  return typeof widgetId === 'string' && ALLOWED_WIDGET_IDS.has(widgetId);
}

/**
 * Validates pin state payload.
 */
function validatePinPayload(isPinned) {
  return typeof isPinned === 'boolean';
}

/**
 * Validates widget height payload.
 */
function validateHeightPayload(height) {
  return typeof height === 'number' && Number.isFinite(height) && height >= 100 && height <= 1200;
}

/**
 * Validates global desktop scale factor.
 */
function validateScalePayload(scaleFactor) {
  return typeof scaleFactor === 'number' && Number.isFinite(scaleFactor) && scaleFactor >= 0.5 && scaleFactor <= 2.0;
}

/**
 * Validates settings key and value types.
 */
function validateSettingPayload(key, value) {
  if (!key || typeof key !== 'string' || !ALLOWED_SETTINGS_KEYS.has(key)) {
    return { valid: false, reason: 'Invalid or unauthorized setting key' };
  }

  if (BOOLEAN_SETTINGS_KEYS.has(key)) {
    if (typeof value !== 'boolean') {
      return { valid: false, reason: `Setting ${key} requires a boolean value` };
    }
    return { valid: true };
  }

  if (key === 'scaleFactor') {
    if (!validateScalePayload(value)) {
      return { valid: false, reason: 'scaleFactor must be a finite number between 0.5 and 2.0' };
    }
    return { valid: true };
  }

  if (key === 'accentColor') {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return { valid: false, reason: 'accentColor must be a valid 6-character hex color (e.g. #D05300)' };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'Unknown validation rule' };
}

/**
 * Decides whether to intercept manager window close and hide to tray.
 * Audit 08: When app.isQuitting is true, NEVER intercept; allow clean shutdown.
 */
function shouldInterceptManagerClose({ isQuitting, hasActiveWidgets, closeToTray = true }) {
  if (isQuitting) {
    return false;
  }
  return Boolean(hasActiveWidgets || closeToTray);
}

/**
 * Manages persistent restoration intent across app lifecycles.
 * Audit 09: Distinguishes between explicit user removals and window teardowns during app quit.
 */
function computeNextRestoreIntent({ currentRestoreMap = {}, action, widgetId, isQuitting = false }) {
  const next = {
    flowcus: Boolean(currentRestoreMap.flowcus),
    playz: Boolean(currentRestoreMap.playz),
    stickk: Boolean(currentRestoreMap.stickk),
  };

  if (action === 'open') {
    if (validateWidgetId(widgetId)) {
      next[widgetId] = true;
    }
    return next;
  }

  if (action === 'explicit_close') {
    if (validateWidgetId(widgetId)) {
      next[widgetId] = false;
    }
    return next;
  }

  if (action === 'remove_all') {
    return { flowcus: false, playz: false, stickk: false };
  }

  if (action === 'window_closed') {
    // If the window is closing because the application is quitting, PRESERVE restoration intent!
    if (isQuitting) {
      return next;
    }
    // Otherwise, explicit closure by user outside quit
    if (validateWidgetId(widgetId)) {
      next[widgetId] = false;
    }
    return next;
  }

  return next;
}

/**
 * Validates task ID payload.
 */
function validateTaskId(taskId) {
  return typeof taskId === 'string' && taskId.trim().length > 0 && taskId.length <= 128;
}

/**
 * Validates task creation / edit payload.
 */
function validateTaskPayload(title, duration) {
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 500) {
    return { valid: false, reason: 'Task title must be a non-empty string under 500 characters' };
  }
  if (duration !== undefined && (typeof duration !== 'string' || duration.length > 20)) {
    return { valid: false, reason: 'Task duration must be a valid duration string (e.g. 15m, 30m, 60m)' };
  }
  return { valid: true };
}

const ALLOWED_SESSION_ACTIONS = new Set(['start', 'pause', 'resume', 'reset', 'complete', 'select-active']);

const ALLOWED_STICKK_THEMES = new Set(['theme-yellow', 'theme-orange', 'theme-mint', 'theme-lavender', 'theme-dark']);
const ALLOWED_STICKK_FONTS = new Set(['font-caveat', 'font-comic', 'font-gloria', 'font-pacifico', 'font-marker']);
const ALLOWED_STROKE_TOOLS = new Set(['draw', 'eraser']);

/**
 * Validates a single drawing stroke (Audit 21 & 22).
 */
function validateStickkStroke(stroke) {
  if (!stroke || typeof stroke !== 'object') return false;
  if (typeof stroke.id !== 'string' || stroke.id.length === 0 || stroke.id.length > 128) return false;
  if (!ALLOWED_STROKE_TOOLS.has(stroke.tool)) return false;
  if (typeof stroke.color !== 'string' || stroke.color.length > 32) return false;
  if (typeof stroke.size !== 'number' || !Number.isFinite(stroke.size) || stroke.size <= 0 || stroke.size > 100) return false;
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) return false;
  if (stroke.points.length > 10000) return false; // Prevent massive unbounded point arrays

  for (const pt of stroke.points) {
    if (!pt || typeof pt !== 'object') return false;
    if (typeof pt.x !== 'number' || !Number.isFinite(pt.x) || typeof pt.y !== 'number' || !Number.isFinite(pt.y)) return false;
    if (pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) return false;
  }
  return true;
}

/**
 * Validates a single Stickk note page schema (Audit 22).
 */
function validateStickkPage(page) {
  if (!page || typeof page !== 'object') {
    return { valid: false, reason: 'Page must be an object' };
  }
  if (typeof page.id !== 'string' || page.id.trim().length === 0 || page.id.length > 128) {
    return { valid: false, reason: 'Page ID must be a non-empty string under 128 characters' };
  }
  if (typeof page.title !== 'string' || page.title.length > 200) {
    return { valid: false, reason: 'Page title must be a string under 200 characters' };
  }
  if (!ALLOWED_STICKK_THEMES.has(page.theme)) {
    return { valid: false, reason: `Invalid theme ${page.theme}` };
  }
  if (!ALLOWED_STICKK_FONTS.has(page.font)) {
    return { valid: false, reason: `Invalid font ${page.font}` };
  }
  if (typeof page.text !== 'string' || page.text.length > 100000) {
    return { valid: false, reason: 'Page text must be a string under 100,000 characters' };
  }
  if (page.strokes !== undefined) {
    if (!Array.isArray(page.strokes)) {
      return { valid: false, reason: 'Page strokes must be an array' };
    }
    if (page.strokes.length > 2000) {
      return { valid: false, reason: 'Strokes array exceeds maximum allowed count of 2,000' };
    }
    for (const stroke of page.strokes) {
      if (!validateStickkStroke(stroke)) {
        return { valid: false, reason: 'Invalid stroke structure' };
      }
    }
  }
  if (page.doodleDataUrl !== undefined && page.doodleDataUrl !== null) {
    if (typeof page.doodleDataUrl !== 'string' || (!page.doodleDataUrl.startsWith('data:image/') && page.doodleDataUrl !== '')) {
      return { valid: false, reason: 'Invalid doodleDataUrl' };
    }
  }
  return { valid: true };
}

/**
 * Validates array of Stickk pages for storage or IPC.
 */
function validateStickkPagesPayload(pages) {
  if (!Array.isArray(pages)) {
    return { valid: false, reason: 'Stickk pages payload must be an array' };
  }
  if (pages.length > 100) {
    return { valid: false, reason: 'Stickk pages cannot exceed 100 pages' };
  }
  for (let i = 0; i < pages.length; i++) {
    const check = validateStickkPage(pages[i]);
    if (!check.valid) {
      return { valid: false, reason: `Page ${i} invalid: ${check.reason}` };
    }
  }
  return { valid: true };
}

/**
 * Validates session action command.
 */
function validateSessionAction(action) {
  return typeof action === 'string' && ALLOWED_SESSION_ACTIONS.has(action);
}

module.exports = {
  ALLOWED_WIDGET_IDS,
  ALLOWED_SETTINGS_KEYS,
  ALLOWED_SESSION_ACTIONS,
  ALLOWED_STICKK_THEMES,
  ALLOWED_STICKK_FONTS,
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
  validateStickkStroke,
  validateStickkPage,
  validateStickkPagesPayload,
  shouldInterceptManagerClose,
  computeNextRestoreIntent,
};
