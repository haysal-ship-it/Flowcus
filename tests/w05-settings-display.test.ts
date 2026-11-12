import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBoundsToDisplays,
  getDefaultWidgetBounds,
  getWidgetDimensions,
  BASE_WIDGET_DIMS,
} from '../electron/displayBounds.cjs';
import { validateSettingPayload } from '../electron/ipcSecurity.cjs';
import { flipAudio } from '../src/utils/flipAudio';
import { uwidgetsAudio } from '../src/utils/uwidgetsAudio';

describe('W05: Display Bounds & Multi-Monitor Clamping (Audit 13)', () => {
  const primaryDisplay = {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, // 40px taskbar at bottom
  };

  const leftDisplay = {
    id: 2,
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1040 },
  };

  const displays = [primaryDisplay, leftDisplay];

  it('preserves valid coordinates inside primary monitor work area', () => {
    const requested = { x: 500, y: 200, width: 312, height: 480 };
    const result = clampBoundsToDisplays(requested, displays, primaryDisplay);

    assert.equal(result.x, 500);
    assert.equal(result.y, 200);
    assert.equal(result.width, 312);
    assert.equal(result.height, 480);
    assert.equal(result.wasRepositioned, false);
    assert.equal(result.displayId, 1);
  });

  it('preserves valid negative coordinates on left secondary monitor', () => {
    const requested = { x: -1500, y: 200, width: 312, height: 480 };
    const result = clampBoundsToDisplays(requested, displays, primaryDisplay);

    assert.equal(result.x, -1500);
    assert.equal(result.y, 200);
    assert.equal(result.wasRepositioned, false);
    assert.equal(result.displayId, 2);
  });

  it('clamps coordinates when partially off-screen on right edge to preserve titlebar accessibility', () => {
    // Window pushed too far right: x = 1900 on 1920-wide display
    const requested = { x: 1900, y: 100, width: 312, height: 480 };
    const result = clampBoundsToDisplays(requested, displays, primaryDisplay);

    // Max X is workArea.x + workArea.width - min(80, width) = 1920 - 80 = 1840
    assert.equal(result.x, 1840);
    assert.equal(result.y, 100);
    assert.equal(result.wasRepositioned, true);
    assert.equal(result.displayId, 1);
  });

  it('clamps coordinates when pushed below taskbar to ensure top chrome is accessible', () => {
    // Window pushed too far down: y = 1030 on 1040-high work area
    const requested = { x: 100, y: 1030, width: 312, height: 480 };
    const result = clampBoundsToDisplays(requested, displays, primaryDisplay);

    // Max Y is workArea.y + workArea.height - min(40, height) = 1040 - 40 = 1000
    assert.equal(result.x, 100);
    assert.equal(result.y, 1000);
    assert.equal(result.wasRepositioned, true);
    assert.equal(result.displayId, 1);
  });

  it('repositions safely to primary display when monitor is disconnected or coordinates completely off-screen', () => {
    // Monitored on disconnected monitor at x: 4000 (only primary and left exist)
    const requested = { x: 4000, y: 300, width: 312, height: 480 };
    const result = clampBoundsToDisplays(requested, displays, primaryDisplay);

    assert.equal(result.wasRepositioned, true);
    assert.equal(result.displayId, 1);
    // Placed in safe top-right area of primary display
    assert.equal(result.x, primaryDisplay.workArea.width - 312 - 24);
    assert.equal(result.y, primaryDisplay.workArea.y + 24);
  });

  it('getDefaultWidgetBounds staggers widgets cleanly in top-right corner', () => {
    const wa = primaryDisplay.workArea;
    const flowcus = getDefaultWidgetBounds('flowcus', wa);
    const playz = getDefaultWidgetBounds('playz', wa);
    const stickk = getDefaultWidgetBounds('stickk', wa);

    assert.equal(flowcus.width, BASE_WIDGET_DIMS.flowcus.width);
    assert.equal(flowcus.height, BASE_WIDGET_DIMS.flowcus.height);
    assert.equal(flowcus.y, wa.y + 24);

    assert.equal(playz.y, wa.y + 48); // +24 stagger
    assert.equal(stickk.y, wa.y + 72); // +48 stagger
  });
});

describe('W05: Global Sound & Audio Controller Synchronization (Audit 15)', () => {
  it('flipAudio silences all sound when globally muted, regardless of local mute state', () => {
    // Given local sound is unmuted
    flipAudio.setMuted(false);
    assert.equal(flipAudio.getMuted(), false);

    // When global mute is enabled (soundEffects = false)
    flipAudio.setGlobalMuted(true);
    assert.equal(flipAudio.isEffectivelyMuted(), true);

    // When global mute is disabled (soundEffects = true)
    flipAudio.setGlobalMuted(false);
    assert.equal(flipAudio.isEffectivelyMuted(), false);

    // When local mute is toggled on
    flipAudio.setMuted(true);
    assert.equal(flipAudio.isEffectivelyMuted(), true);

    // Cleanup
    flipAudio.setMuted(false);
    flipAudio.setGlobalMuted(false);
  });

  it('uwidgetsAudio silences all sound when globally muted, preserving local preference', () => {
    // Given local sound is unmuted
    if (uwidgetsAudio.getMuted()) uwidgetsAudio.toggleMuted();
    assert.equal(uwidgetsAudio.getMuted(), false);

    // When global mute is enabled
    uwidgetsAudio.setGlobalMuted(true);
    assert.equal(uwidgetsAudio.isEffectivelyMuted(), true);

    // When global mute is disabled
    uwidgetsAudio.setGlobalMuted(false);
    assert.equal(uwidgetsAudio.isEffectivelyMuted(), false);

    // Cleanup
    uwidgetsAudio.setGlobalMuted(false);
  });
});

describe('W05: Authoritative Settings Validation (Audits 10, 11, 12, 16)', () => {
  it('validates startWithWindows boolean preference', () => {
    assert.deepEqual(validateSettingPayload('startWithWindows', true), { valid: true });
    assert.deepEqual(validateSettingPayload('startWithWindows', false), { valid: true });
    assert.equal(validateSettingPayload('startWithWindows', 'true').valid, false);
  });

  it('validates closeToTray and startMinimized as distinct boolean preferences (Audit 10)', () => {
    assert.deepEqual(validateSettingPayload('closeToTray', true), { valid: true });
    assert.deepEqual(validateSettingPayload('closeToTray', false), { valid: true });
    assert.equal(validateSettingPayload('closeToTray', 1).valid, false);

    assert.deepEqual(validateSettingPayload('startMinimized', true), { valid: true });
    assert.deepEqual(validateSettingPayload('startMinimized', false), { valid: true });
    assert.equal(validateSettingPayload('startMinimized', null).valid, false);
  });

  it('validates alwaysOnTopDefault boolean preference (Audit 11)', () => {
    assert.deepEqual(validateSettingPayload('alwaysOnTopDefault', true), { valid: true });
    assert.deepEqual(validateSettingPayload('alwaysOnTopDefault', false), { valid: true });
    assert.equal(validateSettingPayload('alwaysOnTopDefault', 'yes').valid, false);
  });

  it('validates scaleFactor numeric range [0.5, 2.0] (Audit 12)', () => {
    assert.deepEqual(validateSettingPayload('scaleFactor', 0.85), { valid: true });
    assert.deepEqual(validateSettingPayload('scaleFactor', 1.0), { valid: true });
    assert.deepEqual(validateSettingPayload('scaleFactor', 1.15), { valid: true });
    assert.equal(validateSettingPayload('scaleFactor', 0.2).valid, false);
    assert.equal(validateSettingPayload('scaleFactor', 3.5).valid, false);
    assert.equal(validateSettingPayload('scaleFactor', '1.0').valid, false);
  });

  it('validates accentColor hex format (Audit 16)', () => {
    assert.deepEqual(validateSettingPayload('accentColor', '#D05300'), { valid: true });
    assert.deepEqual(validateSettingPayload('accentColor', '#00C853'), { valid: true });
    assert.equal(validateSettingPayload('accentColor', 'red').valid, false);
    assert.equal(validateSettingPayload('accentColor', 123).valid, false);
  });

  it('rejects unknown setting keys (Audit 26)', () => {
    assert.equal(validateSettingPayload('maliciousKey', true).valid, false);
    assert.equal(validateSettingPayload('__proto__', {}).valid, false);
  });
});
