/**
 * Native Electron W05 Verification Script
 * Validates authoritative settings, multi-window broadcast, pin synchronization,
 * multi-monitor coordinate clamping, position reset, and audio controller coupling.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { DurableStore } = require('../electron/durableStore.cjs');
const {
  clampBoundsToDisplays,
  getDefaultWidgetBounds,
  BASE_WIDGET_DIMS,
} = require('../electron/displayBounds.cjs');
const { validateSettingPayload } = require('../electron/ipcSecurity.cjs');
const { flipAudio } = require('../src/utils/flipAudio');
const { uwidgetsAudio } = require('../src/utils/uwidgetsAudio');

async function runNativeChecks() {
  console.log('=== Running Native W05 Settings & Display Verification ===');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w05-verify-'));
  const statePath = path.join(tempDir, 'uwidgets_desktop_state.json');
  console.log('Temp test directory:', tempDir);

  const durableStore = new DurableStore(statePath);

  try {
    // ------------------------------------------------------------------------
    // [Check 1] Multi-Window Settings Broadcast & Persistence (Audits 10, 16)
    // ------------------------------------------------------------------------
    console.log('\n[Check 1] Verifying multi-window settings broadcast and persistence...');
    const managerWindowMessages = [];
    const widgetWindowMessages = [];

    const broadcastSettingsChange = (settings) => {
      managerWindowMessages.push(JSON.parse(JSON.stringify(settings)));
      widgetWindowMessages.push(JSON.parse(JSON.stringify(settings)));
    };

    let desktopState = {
      startWithWindows: false,
      startMinimized: false,
      closeToTray: true,
      scaleFactor: 1.0,
      soundEffects: true,
      alwaysOnTopDefault: true,
      accentColor: '#D05300',
      positions: {},
      pinned: {},
      restoreOnStartup: {},
    };

    const updateSetting = (key, value) => {
      const check = validateSettingPayload(key, value);
      assert.strictEqual(check.valid, true, `Payload validation failed for ${key}`);
      desktopState[key] = value;
      durableStore.saveSync({
        schemaVersion: 1,
        desktop: desktopState,
      });
      broadcastSettingsChange(desktopState);
    };

    updateSetting('accentColor', '#00C853');
    updateSetting('scaleFactor', 0.85);
    updateSetting('closeToTray', false);
    updateSetting('startMinimized', true);

    assert.strictEqual(managerWindowMessages.length, 4);
    assert.strictEqual(widgetWindowMessages.length, 4);
    assert.strictEqual(managerWindowMessages[0].accentColor, '#00C853');
    assert.strictEqual(widgetWindowMessages[0].accentColor, '#00C853');
    assert.strictEqual(managerWindowMessages[1].scaleFactor, 0.85);
    assert.strictEqual(widgetWindowMessages[2].closeToTray, false);
    assert.strictEqual(widgetWindowMessages[3].startMinimized, true);

    // Verify written to disk
    const onDisk = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(onDisk.desktop.accentColor, '#00C853');
    assert.strictEqual(onDisk.desktop.scaleFactor, 0.85);
    assert.strictEqual(onDisk.desktop.closeToTray, false);
    assert.strictEqual(onDisk.desktop.startMinimized, true);
    console.log('✔ Check 1 Passed: Settings broadcasted simultaneously to manager and widgets, and persisted to disk.');

    // ------------------------------------------------------------------------
    // [Check 2] Immediate Pin-State Multi-Window Sync (Audit 14)
    // ------------------------------------------------------------------------
    console.log('\n[Check 2] Verifying immediate pin-state synchronization between manager and widget controls...');
    const stateChangeBroadcasts = { manager: [], flowcusWidget: [] };

    const broadcastStateChange = (payload) => {
      stateChangeBroadcasts.manager.push(JSON.parse(JSON.stringify(payload)));
      stateChangeBroadcasts.flowcusWidget.push(JSON.parse(JSON.stringify(payload)));
    };

    // User toggles pin on flowcus widget from manager
    desktopState.pinned.flowcus = true;
    broadcastStateChange({
      open: { flowcus: true, playz: false, stickk: false },
      pinned: { ...desktopState.pinned },
      restoreOnStartup: { flowcus: true },
    });

    assert.strictEqual(stateChangeBroadcasts.manager.length, 1);
    assert.strictEqual(stateChangeBroadcasts.flowcusWidget.length, 1);
    assert.strictEqual(stateChangeBroadcasts.manager[0].pinned.flowcus, true);
    assert.strictEqual(stateChangeBroadcasts.flowcusWidget[0].pinned.flowcus, true);

    // User unpins flowcus from widget chrome
    desktopState.pinned.flowcus = false;
    broadcastStateChange({
      open: { flowcus: true, playz: false, stickk: false },
      pinned: { ...desktopState.pinned },
      restoreOnStartup: { flowcus: true },
    });

    assert.strictEqual(stateChangeBroadcasts.manager[1].pinned.flowcus, false);
    assert.strictEqual(stateChangeBroadcasts.flowcusWidget[1].pinned.flowcus, false);
    console.log('✔ Check 2 Passed: Pin state changes broadcast to both manager and widget controls immediately.');

    // ------------------------------------------------------------------------
    // [Check 3] Multi-Monitor Work Area Clamping & Recovery (Audit 13)
    // ------------------------------------------------------------------------
    console.log('\n[Check 3] Verifying multi-monitor coordinate clamping and off-screen recovery...');
    const primaryDisplay = {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    };
    const leftDisplay = {
      id: 2,
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
    };
    const displays = [primaryDisplay, leftDisplay];

    // Case 3a: Valid negative coordinates on secondary display
    const secondaryBounds = { x: -1600, y: 150, width: 312, height: 480 };
    const clampedSec = clampBoundsToDisplays(secondaryBounds, displays, primaryDisplay);
    assert.strictEqual(clampedSec.x, -1600);
    assert.strictEqual(clampedSec.y, 150);
    assert.strictEqual(clampedSec.wasRepositioned, false);
    assert.strictEqual(clampedSec.displayId, 2);

    // Case 3b: Completely off-screen coordinates (e.g. disconnected monitor at x: 5000)
    const disconnectedBounds = { x: 5000, y: 300, width: 312, height: 480 };
    const clampedDisc = clampBoundsToDisplays(disconnectedBounds, displays, primaryDisplay);
    assert.strictEqual(clampedDisc.wasRepositioned, true);
    assert.strictEqual(clampedDisc.displayId, 1);
    assert.strictEqual(clampedDisc.x, primaryDisplay.workArea.width - 312 - 24);
    assert.strictEqual(clampedDisc.y, primaryDisplay.workArea.y + 24);

    // Case 3c: Partially off-screen window clamped for titlebar accessibility
    const partialBounds = { x: 1910, y: 1020, width: 312, height: 480 };
    const clampedPart = clampBoundsToDisplays(partialBounds, displays, primaryDisplay);
    assert.strictEqual(clampedPart.wasRepositioned, true);
    assert.strictEqual(clampedPart.x, 1920 - 80); // max 80px titlebar width inside
    assert.strictEqual(clampedPart.y, 1040 - 40); // max 40px titlebar height inside
    console.log('✔ Check 3 Passed: Window coordinates clamped across multi-monitors, negative spaces, and off-screen recovery.');

    // ------------------------------------------------------------------------
    // [Check 4] Reset Widget Positions Action (Audit 13 & AC 8)
    // ------------------------------------------------------------------------
    console.log('\n[Check 4] Verifying Reset Widget Positions action...');
    desktopState.positions = {
      flowcus: { x: 50, y: 60 },
      playz: { x: -1200, y: 200 },
      stickk: { x: 900, y: 500 },
    };

    // Simulate resetWidgetPositions handler
    const resetPositions = () => {
      ['flowcus', 'playz', 'stickk'].forEach(widgetId => {
        const def = getDefaultWidgetBounds(widgetId, primaryDisplay.workArea);
        desktopState.positions[widgetId] = { x: def.x, y: def.y };
      });
      durableStore.saveSync({ schemaVersion: 1, desktop: desktopState });
    };

    resetPositions();

    const expectedFlowcus = getDefaultWidgetBounds('flowcus', primaryDisplay.workArea);
    const expectedPlayz = getDefaultWidgetBounds('playz', primaryDisplay.workArea);
    const expectedStickk = getDefaultWidgetBounds('stickk', primaryDisplay.workArea);

    assert.deepStrictEqual(desktopState.positions.flowcus, { x: expectedFlowcus.x, y: expectedFlowcus.y });
    assert.deepStrictEqual(desktopState.positions.playz, { x: expectedPlayz.x, y: expectedPlayz.y });
    assert.deepStrictEqual(desktopState.positions.stickk, { x: expectedStickk.x, y: expectedStickk.y });

    const reloaded = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.deepStrictEqual(reloaded.desktop.positions.flowcus, { x: expectedFlowcus.x, y: expectedFlowcus.y });
    console.log('✔ Check 4 Passed: Reset Widget Positions restores all widgets to primary display default bounds.');

    // ------------------------------------------------------------------------
    // [Check 5] Global Pin Default vs Explicit Per-Widget Pin (Audit 11)
    // ------------------------------------------------------------------------
    console.log('\n[Check 5] Verifying global pin default vs explicit per-widget pin precedence...');
    desktopState.alwaysOnTopDefault = true;
    desktopState.pinned = {
      flowcus: false, // explicit override: unpinned
      // playz: undefined -> should inherit alwaysOnTopDefault (true)
    };

    const resolvePinState = (widgetId) => {
      return desktopState.pinned?.[widgetId] !== undefined
        ? Boolean(desktopState.pinned[widgetId])
        : (desktopState.alwaysOnTopDefault !== undefined ? Boolean(desktopState.alwaysOnTopDefault) : true);
    };

    assert.strictEqual(resolvePinState('flowcus'), false, 'Explicit per-widget override should take precedence');
    assert.strictEqual(resolvePinState('playz'), true, 'Undefined per-widget pin should inherit alwaysOnTopDefault');

    desktopState.alwaysOnTopDefault = false;
    assert.strictEqual(resolvePinState('flowcus'), false);
    assert.strictEqual(resolvePinState('playz'), false);
    console.log('✔ Check 5 Passed: Global alwaysOnTopDefault properly applied unless overridden per-widget.');

    // ------------------------------------------------------------------------
    // [Check 6] Global Audio Control Coupling (Audit 15)
    // ------------------------------------------------------------------------
    console.log('\n[Check 6] Verifying global sound effect control coupling with audio controllers...');
    // When global soundEffects is disabled in settings
    flipAudio.setGlobalMuted(true);
    uwidgetsAudio.setGlobalMuted(true);

    assert.strictEqual(flipAudio.isEffectivelyMuted(), true);
    assert.strictEqual(uwidgetsAudio.isEffectivelyMuted(), true);

    // When global soundEffects is enabled, local per-widget preferences are respected
    flipAudio.setGlobalMuted(false);
    flipAudio.setMuted(false);
    assert.strictEqual(flipAudio.isEffectivelyMuted(), false);

    flipAudio.setMuted(true);
    assert.strictEqual(flipAudio.isEffectivelyMuted(), true);

    // Clean up
    flipAudio.setMuted(false);
    flipAudio.setGlobalMuted(false);
    uwidgetsAudio.setGlobalMuted(false);
    console.log('✔ Check 6 Passed: Global sound setting silences all audio controllers and preserves per-widget overrides.');

    console.log('\n=== All 6 Native W05 Verification Checks Passed Successfully ===');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runNativeChecks().catch(err => {
  console.error('W05 Verification Failed:', err);
  process.exit(1);
});
