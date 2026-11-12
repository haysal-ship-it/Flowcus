/**
 * Multi-Monitor Display Bounds & Clamping Manager (W05)
 * Pure functions for validating, clamping, and repositioning windows
 * across multiple displays, negative coordinate spaces, and disconnected monitors.
 */

let BASE_WIDGET_DIMS;
try {
  BASE_WIDGET_DIMS = require('../src/utils/widgetDimensions.json');
} catch {
  BASE_WIDGET_DIMS = {
    flowcus: { width: 312, height: 505 },
    playz: { width: 312, height: 475 },
    stickk: { width: 312, height: 510 },
  };
}

/**
 * Returns default dimensions for a widget.
 */
function getWidgetDimensions(widgetId) {
  return BASE_WIDGET_DIMS[widgetId] || { width: 312, height: 480 };
}

/**
 * Returns default visible desktop bounds on the primary display.
 */
function getDefaultWidgetBounds(widgetId, workArea) {
  const dims = getWidgetDimensions(widgetId);
  let defaultX = workArea.x + workArea.width - dims.width - 24;
  let defaultY = workArea.y + 24;

  if (widgetId === 'playz') defaultY += 24;
  if (widgetId === 'stickk') defaultY += 48;

  return {
    x: defaultX,
    y: defaultY,
    width: dims.width,
    height: dims.height,
  };
}

/**
 * Clamps window bounds to visible connected display work areas.
 * Supports negative coordinates (monitors placed to left/above primary).
 * If a monitor was removed or coordinates are off-screen, repositions to primary display.
 */
function clampBoundsToDisplays(requestedBounds, displays, primaryDisplay) {
  if (!displays || !Array.isArray(displays) || displays.length === 0) {
    return {
      x: requestedBounds.x,
      y: requestedBounds.y,
      width: requestedBounds.width,
      height: requestedBounds.height,
      wasRepositioned: false,
    };
  }

  const primary = primaryDisplay || displays[0];
  const req = {
    x: typeof requestedBounds.x === 'number' ? requestedBounds.x : primary.workArea.x + 24,
    y: typeof requestedBounds.y === 'number' ? requestedBounds.y : primary.workArea.y + 24,
    width: typeof requestedBounds.width === 'number' ? requestedBounds.width : 312,
    height: typeof requestedBounds.height === 'number' ? requestedBounds.height : 480,
  };

  // Find the display that has the greatest intersection with the requested bounds
  let bestDisplay = null;
  let maxOverlapArea = 0;

  for (const d of displays) {
    const wa = d.workArea;
    const interX1 = Math.max(req.x, wa.x);
    const interX2 = Math.min(req.x + req.width, wa.x + wa.width);
    const interY1 = Math.max(req.y, wa.y);
    const interY2 = Math.min(req.y + req.height, wa.y + wa.height);

    const overlapW = Math.max(0, interX2 - interX1);
    const overlapH = Math.max(0, interY2 - interY1);
    const area = overlapW * overlapH;

    if (area > maxOverlapArea) {
      maxOverlapArea = area;
      bestDisplay = d;
    }
  }

  if (bestDisplay && maxOverlapArea > 0) {
    // Window intersects bestDisplay; clamp within its workArea
    const wa = bestDisplay.workArea;

    // Ensure title bar (top 40px) is accessible and window has >= 80px visible horizontally
    const minX = wa.x;
    const maxX = wa.x + wa.width - Math.min(80, req.width);
    const clampedX = Math.max(minX, Math.min(req.x, maxX));

    const minY = wa.y;
    const maxY = wa.y + wa.height - Math.min(40, req.height);
    const clampedY = Math.max(minY, Math.min(req.y, maxY));

    const wasRepositioned = clampedX !== req.x || clampedY !== req.y;

    return {
      x: clampedX,
      y: clampedY,
      width: req.width,
      height: req.height,
      wasRepositioned,
      displayId: bestDisplay.id,
    };
  }

  // Off-screen or display disconnected: safely reposition into primary display work area
  const safePrimaryWA = primary.workArea;
  const safeX = safePrimaryWA.x + safePrimaryWA.width - req.width - 24;
  const safeY = safePrimaryWA.y + 24;

  return {
    x: safeX,
    y: safeY,
    width: req.width,
    height: req.height,
    wasRepositioned: true,
    displayId: primary.id,
  };
}

module.exports = {
  BASE_WIDGET_DIMS,
  getWidgetDimensions,
  getDefaultWidgetBounds,
  clampBoundsToDisplays,
};
