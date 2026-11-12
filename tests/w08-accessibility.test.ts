/**
 * Work Package W08: Accessibility & Visual Consistency Tests
 * Validates Audits 31, 32, 33, and 34.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
import widgetDimensions from '../src/utils/widgetDimensions.json';
import { WIDGETS_CATALOG } from '../src/utils/widgetsCatalog';
import { isReducedMotion } from '../src/utils/reducedMotion';

describe('W08: Accessibility & Visual Consistency (Audits 31-34)', () => {
  describe('Audit 33: Single Source of Widget Dimensions', () => {
    test('defines authoritative dimensions for all 3 widgets', () => {
      assert.deepStrictEqual(widgetDimensions.flowcus, { width: 312, height: 505 });
      assert.deepStrictEqual(widgetDimensions.playz, { width: 312, height: 475 });
      assert.deepStrictEqual(widgetDimensions.stickk, { width: 312, height: 510 });
    });

    test('ensures catalog defaultWidth and defaultHeight strictly match widgetDimensions.json', () => {
      const flowcus = WIDGETS_CATALOG.find(w => w.id === 'flowcus')!;
      const playz = WIDGETS_CATALOG.find(w => w.id === 'playz')!;
      const stickk = WIDGETS_CATALOG.find(w => w.id === 'stickk')!;

      assert.strictEqual(flowcus.defaultWidth, widgetDimensions.flowcus.width);
      assert.strictEqual(flowcus.defaultHeight, widgetDimensions.flowcus.height);

      assert.strictEqual(playz.defaultWidth, widgetDimensions.playz.width);
      assert.strictEqual(playz.defaultHeight, widgetDimensions.playz.height);

      assert.strictEqual(stickk.defaultWidth, widgetDimensions.stickk.width);
      assert.strictEqual(stickk.defaultHeight, widgetDimensions.stickk.height);
    });

    test('ensures electron/displayBounds.cjs imports or shares widgetDimensions.json', () => {
      const displayBounds = require('../electron/displayBounds.cjs');
      assert.deepStrictEqual(displayBounds.BASE_WIDGET_DIMS.flowcus, widgetDimensions.flowcus);
      assert.deepStrictEqual(displayBounds.BASE_WIDGET_DIMS.playz, widgetDimensions.playz);
      assert.deepStrictEqual(displayBounds.BASE_WIDGET_DIMS.stickk, widgetDimensions.stickk);
    });
  });

  describe('Audit 34: Locally Bundled Handwriting Fonts & Offline Support', () => {
    const requiredFonts = [
      'caveat.woff2',
      'comic-neue.woff2',
      'gloria-hallelujah.woff2',
      'pacifico.woff2',
      'permanent-marker.woff2',
    ];

    test('verifies all 5 handwriting woff2 files exist locally in public/fonts', () => {
      const fontsDir = path.resolve(process.cwd(), 'public/fonts');
      assert.strictEqual(fs.existsSync(fontsDir), true);

      for (const fontFile of requiredFonts) {
        const fontPath = path.join(fontsDir, fontFile);
        assert.strictEqual(fs.existsSync(fontPath), true, `Missing font file: ${fontFile}`);
        const stats = fs.statSync(fontPath);
        assert.ok(stats.size > 10000, `Font file too small: ${fontFile}`);
      }
    });

    test('verifies public/fonts/LICENSE.txt documents licenses for all 5 fonts', () => {
      const licensePath = path.resolve(process.cwd(), 'public/fonts/LICENSE.txt');
      assert.strictEqual(fs.existsSync(licensePath), true);
      const text = fs.readFileSync(licensePath, 'utf8');

      assert.ok(text.includes('Caveat'));
      assert.ok(text.includes('Comic Neue'));
      assert.ok(text.includes('Gloria Hallelujah'));
      assert.ok(text.includes('Pacifico'));
      assert.ok(text.includes('Permanent Marker'));
      assert.ok(text.includes('Open Font License'));
      assert.ok(text.includes('Apache License'));
    });

    test('verifies index.html does NOT contain remote Google Fonts requests', () => {
      const htmlPath = path.resolve(process.cwd(), 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');

      assert.ok(!html.includes('fonts.googleapis.com'), 'Found fonts.googleapis.com in index.html');
      assert.ok(!html.includes('fonts.gstatic.com'), 'Found fonts.gstatic.com in index.html');
    });

    test('verifies src/index.css defines local @font-face rules for all 5 fonts', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      assert.ok(css.includes("font-family: 'Caveat'"));
      assert.ok(css.includes("url('/fonts/caveat.woff2')"));
      assert.ok(css.includes("font-family: 'Comic Neue'"));
      assert.ok(css.includes("url('/fonts/comic-neue.woff2')"));
      assert.ok(css.includes("font-family: 'Gloria Hallelujah'"));
      assert.ok(css.includes("url('/fonts/gloria-hallelujah.woff2')"));
      assert.ok(css.includes("font-family: 'Pacifico'"));
      assert.ok(css.includes("url('/fonts/pacifico.woff2')"));
      assert.ok(css.includes("font-family: 'Permanent Marker'"));
      assert.ok(css.includes("url('/fonts/permanent-marker.woff2')"));
    });
  });

  describe('Audit 32: Reduced Motion Support in JS & CSS', () => {
    test('isReducedMotion() safely returns boolean in node environment without window', () => {
      const result = isReducedMotion();
      assert.strictEqual(typeof result, 'boolean');
      assert.strictEqual(result, false);
    });

    test('verifies src/index.css contains reduced motion rules for Playz, Stickk, and Modal', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
      assert.ok(css.includes('.anim-smooth-flip-next'));
      assert.ok(css.includes('.anim-paper-tear'));
      assert.ok(css.includes('.playz-brush-stroke'));
      assert.ok(css.includes('.manager-detail-modal'));
    });
  });

  describe('Audit 31: Dialog & Card Accessibility', () => {
    test('verifies WidgetDetailModal source has proper ARIA attributes and focus management', () => {
      const modalSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/manager/WidgetDetailModal.tsx'),
        'utf8'
      );

      assert.ok(modalSource.includes('role="dialog"'));
      assert.ok(modalSource.includes('aria-modal="true"'));
      assert.ok(modalSource.includes('aria-labelledby="modal-widget-title"'));
      assert.ok(modalSource.includes('aria-describedby="modal-widget-desc"'));
      assert.ok(modalSource.includes('previousActiveElementRef'));
      assert.ok(modalSource.includes("e.key === 'Escape'"));
      assert.ok(modalSource.includes("e.key === 'Tab'"));
    });

    test('verifies catalog cards have keyboard handlers and semantic button roles', () => {
      const catalogSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/manager/ManagerCatalog.tsx'),
        'utf8'
      );

      assert.ok(catalogSource.includes('role="button"'));
      assert.ok(catalogSource.includes('tabIndex={0}'));
      assert.ok(catalogSource.includes("e.key === 'Enter'"));
      assert.ok(catalogSource.includes('aria-label'));
    });

    test('verifies no corrupted mojibake characters remain in index.css', () => {
      const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
      assert.ok(!css.includes('FLOWCUS â€”'), 'Found corrupted characters in index.css');
      assert.ok(css.includes('FLOWCUS —'), 'Missing cleaned up title in index.css');
    });
  });
});
