/**
 * W02 Automated Regression Tests: Desktop Lifecycle & Trusted IPC
 * Audits covered: Audit 08 (P0), Audit 09 (P1), Audit 26 (P0), Audit 27 (P1)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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
  shouldInterceptManagerClose,
  computeNextRestoreIntent,
} = require('../electron/ipcSecurity.cjs');

describe('W02: Tray Quit & Lifecycle Bypass (Audit 08)', () => {
  test('Manager window close handler MUST NOT intercept when app.isQuitting is true', () => {
    // Scenario 1: User clicks "Quit Uwidgets" in Tray or app.quit() is triggered
    const interceptOnQuit = shouldInterceptManagerClose({
      isQuitting: true,
      hasActiveWidgets: true,
      closeToTray: true,
    });
    assert.strictEqual(
      interceptOnQuit,
      false,
      'When app.isQuitting is true, manager close must NEVER be intercepted (allows clean process termination)'
    );

    const interceptOnQuitNoWidgets = shouldInterceptManagerClose({
      isQuitting: true,
      hasActiveWidgets: false,
      closeToTray: false,
    });
    assert.strictEqual(interceptOnQuitNoWidgets, false);
  });

  test('Manager window close handler intercepts and hides to tray during normal execution', () => {
    // Scenario 2: User clicks [X] on manager dashboard while widgets are running
    const interceptWithWidgets = shouldInterceptManagerClose({
      isQuitting: false,
      hasActiveWidgets: true,
      closeToTray: true,
    });
    assert.strictEqual(
      interceptWithWidgets,
      true,
      'Should intercept close and keep widgets alive in tray during normal run'
    );

    // Scenario 3: User clicks [X] with closeToTray enabled
    const interceptCloseToTray = shouldInterceptManagerClose({
      isQuitting: false,
      hasActiveWidgets: false,
      closeToTray: true,
    });
    assert.strictEqual(interceptCloseToTray, true);

    // Scenario 4: User clicks [X] without widgets and without closeToTray
    const allowClose = shouldInterceptManagerClose({
      isQuitting: false,
      hasActiveWidgets: false,
      closeToTray: false,
    });
    assert.strictEqual(allowClose, false);
  });
});

describe('W02: Window Restoration Intent Separation (Audit 09)', () => {
  test('Window teardown during app quit preserves user restoration intent', () => {
    const initialIntent = { flowcus: true, playz: true, stickk: false };

    // When the application quits, win.on('closed') fires for all open windows
    const intentAfterFlowcusClose = computeNextRestoreIntent({
      currentRestoreMap: initialIntent,
      action: 'window_closed',
      widgetId: 'flowcus',
      isQuitting: true,
    });

    const intentAfterPlayzClose = computeNextRestoreIntent({
      currentRestoreMap: intentAfterFlowcusClose,
      action: 'window_closed',
      widgetId: 'playz',
      isQuitting: true,
    });

    assert.deepStrictEqual(
      intentAfterPlayzClose,
      { flowcus: true, playz: true, stickk: false },
      'Restoration intent must be preserved intact during app quit'
    );
  });

  test('Explicit widget close or remove updates restore intent', () => {
    const initialIntent = { flowcus: true, playz: true, stickk: false };

    // Explicit close of flowcus
    const afterExplicitClose = computeNextRestoreIntent({
      currentRestoreMap: initialIntent,
      action: 'explicit_close',
      widgetId: 'flowcus',
    });
    assert.strictEqual(afterExplicitClose.flowcus, false);
    assert.strictEqual(afterExplicitClose.playz, true);

    // Explicit remove_all
    const afterRemoveAll = computeNextRestoreIntent({
      currentRestoreMap: afterExplicitClose,
      action: 'remove_all',
    });
    assert.deepStrictEqual(afterRemoveAll, { flowcus: false, playz: false, stickk: false });

    // Explicit open
    const afterOpenStickk = computeNextRestoreIntent({
      currentRestoreMap: afterRemoveAll,
      action: 'open',
      widgetId: 'stickk',
    });
    assert.strictEqual(afterOpenStickk.stickk, true);
  });

  test('Normal window close outside quit clears restoration intent', () => {
    const initialIntent = { flowcus: true, playz: false, stickk: false };

    const afterNormalClose = computeNextRestoreIntent({
      currentRestoreMap: initialIntent,
      action: 'window_closed',
      widgetId: 'flowcus',
      isQuitting: false,
    });
    assert.strictEqual(afterNormalClose.flowcus, false);
  });
});

describe('W02: Trusted IPC & Sender Validation (Audit 26)', () => {
  test('validateWidgetId restricts to approved whitelist only', () => {
    assert.strictEqual(validateWidgetId('flowcus'), true);
    assert.strictEqual(validateWidgetId('playz'), true);
    assert.strictEqual(validateWidgetId('stickk'), true);

    assert.strictEqual(validateWidgetId('evil_widget'), false);
    assert.strictEqual(validateWidgetId(''), false);
    assert.strictEqual(validateWidgetId(null as any), false);
    assert.strictEqual(validateWidgetId({} as any), false);
    assert.strictEqual(validateWidgetId('../main'), false);
  });

  test('validateSenderFrame rejects iframes and injected subframes', () => {
    // Main frame: parent is null
    assert.strictEqual(validateSenderFrame({ parent: null }), true);

    // Subframe / iframe: parent exists
    assert.strictEqual(validateSenderFrame({ parent: {} }), false);
  });

  test('isValidAppUrl verifies local app origins and rejects untrusted external URLs', () => {
    // Development local URL
    assert.strictEqual(isValidAppUrl('http://localhost:3000?window=flowcus', false, true), true);
    assert.strictEqual(isValidAppUrl('http://127.0.0.1:3000?window=main', false, true), true);

    // Production file:// URL pointing to dist/index.html
    assert.strictEqual(
      isValidAppUrl('file:///C:/Users/Sal/Downloads/Flowcus-main/dist/index.html?window=playz', true, false),
      true
    );

    // Untrusted external origins
    assert.strictEqual(isValidAppUrl('https://malicious-site.com/phish', true, false), false);
    assert.strictEqual(isValidAppUrl('http://attacker.com:3000', false, true), false);
    assert.strictEqual(isValidAppUrl('javascript:alert(1)', true, false), false);
  });

  test('validateSettingPayload strictly validates keys and typed values', () => {
    // Valid boolean settings
    assert.strictEqual(validateSettingPayload('startWithWindows', true).valid, true);
    assert.strictEqual(validateSettingPayload('startMinimized', false).valid, true);
    assert.strictEqual(validateSettingPayload('closeToTray', true).valid, true);

    // Invalid types for boolean settings
    assert.strictEqual(validateSettingPayload('startWithWindows', 'true' as any).valid, false);
    assert.strictEqual(validateSettingPayload('startMinimized', 1 as any).valid, false);
    assert.strictEqual(validateSettingPayload('closeToTray', null as any).valid, false);

    // Valid numeric scaleFactor (0.5 to 2.0)
    assert.strictEqual(validateSettingPayload('scaleFactor', 1.0).valid, true);
    assert.strictEqual(validateSettingPayload('scaleFactor', 0.5).valid, true);
    assert.strictEqual(validateSettingPayload('scaleFactor', 2.0).valid, true);

    // Out of range or non-finite scaleFactor
    assert.strictEqual(validateSettingPayload('scaleFactor', 0.2).valid, false);
    assert.strictEqual(validateSettingPayload('scaleFactor', 3.5).valid, false);
    assert.strictEqual(validateSettingPayload('scaleFactor', NaN).valid, false);
    assert.strictEqual(validateSettingPayload('scaleFactor', Infinity).valid, false);
    assert.strictEqual(validateSettingPayload('scaleFactor', '1.0' as any).valid, false);

    // Valid accent color
    assert.strictEqual(validateSettingPayload('accentColor', '#D05300').valid, true);
    assert.strictEqual(validateSettingPayload('accentColor', '#00C853').valid, true);

    // Invalid accent color
    assert.strictEqual(validateSettingPayload('accentColor', 'red').valid, false);
    assert.strictEqual(validateSettingPayload('accentColor', '#FFF').valid, false);
    assert.strictEqual(validateSettingPayload('accentColor', 'rgba(0,0,0,1)').valid, false);

    // Disallowed / prototype pollution keys
    assert.strictEqual(validateSettingPayload('__proto__', {} as any).valid, false);
    assert.strictEqual(validateSettingPayload('constructor', {} as any).valid, false);
    assert.strictEqual(validateSettingPayload('unapprovedSetting', true).valid, false);
  });

  test('validateHeightPayload enforces finite numbers within widget dimensions [100, 1200]', () => {
    assert.strictEqual(validateHeightPayload(500), true);
    assert.strictEqual(validateHeightPayload(100), true);
    assert.strictEqual(validateHeightPayload(1200), true);

    assert.strictEqual(validateHeightPayload(50), false);
    assert.strictEqual(validateHeightPayload(2500), false);
    assert.strictEqual(validateHeightPayload(NaN), false);
    assert.strictEqual(validateHeightPayload(Infinity), false);
    assert.strictEqual(validateHeightPayload('500' as any), false);
  });

  test('validatePinPayload requires strict boolean', () => {
    assert.strictEqual(validatePinPayload(true), true);
    assert.strictEqual(validatePinPayload(false), true);
    assert.strictEqual(validatePinPayload(1 as any), false);
    assert.strictEqual(validatePinPayload('true' as any), false);
    assert.strictEqual(validatePinPayload(null as any), false);
  });

  test('validateTaskId and validateTaskPayload enforce safe constraints (Audit 26)', () => {
    const { validateTaskId, validateTaskPayload, validateSessionAction } = require('../electron/ipcSecurity.cjs');

    assert.strictEqual(validateTaskId('task-123'), true);
    assert.strictEqual(validateTaskId(''), false);
    assert.strictEqual(validateTaskId(null as any), false);
    assert.strictEqual(validateTaskId('a'.repeat(200)), false);

    assert.strictEqual(validateTaskPayload('Valid Task', '30m').valid, true);
    assert.strictEqual(validateTaskPayload('', '30m').valid, false);
    assert.strictEqual(validateTaskPayload('Valid Task', 'invalid-duration-string-that-is-too-long-123456789').valid, false);

    assert.strictEqual(validateSessionAction('start'), true);
    assert.strictEqual(validateSessionAction('pause'), true);
    assert.strictEqual(validateSessionAction('resume'), true);
    assert.strictEqual(validateSessionAction('reset'), true);
    assert.strictEqual(validateSessionAction('complete'), true);
    assert.strictEqual(validateSessionAction('unknown-action'), false);
  });
});
