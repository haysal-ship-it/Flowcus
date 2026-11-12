/**
 * Native Verification Script for W08: Accessibility & Visual Consistency
 * Checks:
 * 1. Single source of widget dimensions agreement.
 * 2. Bundled fonts validity (WOFF2 signature verification).
 * 3. Offline font references (no remote font requests in index.html, local @font-face in CSS).
 * 4. Dialog accessibility (ARIA dialog, labelledby, describedby, focus trap, escape).
 * 5. Reduced motion checks in both JS and CSS.
 * 6. Clean characters: zero mojibake or placeholder emojis in modal/catalog.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== W08 NATIVE ACCESSIBILITY & VISUAL CONSISTENCY VERIFICATION ===\n');

let passedChecks = 0;
let totalChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`[PASS] ${title}`);
    passedChecks++;
  } catch (err) {
    console.error(`[FAIL] ${title}:`, err.message);
  }
}

// Check 1: Single Source of Widget Dimensions
check('1. Authoritative widget dimensions match in JSON, Catalog, and DisplayBounds', () => {
  const dims = require('../src/utils/widgetDimensions.json');
  const displayBounds = require('../electron/displayBounds.cjs');
  const catalogSrc = fs.readFileSync(path.resolve(__dirname, '../src/utils/widgetsCatalog.ts'), 'utf8');

  assert.deepStrictEqual(dims.flowcus, { width: 312, height: 505 });
  assert.deepStrictEqual(dims.playz, { width: 312, height: 475 });
  assert.deepStrictEqual(dims.stickk, { width: 312, height: 510 });

  assert.deepStrictEqual(displayBounds.BASE_WIDGET_DIMS, dims);
  assert.ok(catalogSrc.includes('widgetDimensions.flowcus.width'));
  assert.ok(catalogSrc.includes('widgetDimensions.playz.width'));
  assert.ok(catalogSrc.includes('widgetDimensions.stickk.width'));
});

// Check 2: Valid WOFF2 Font Headers in public/fonts
check('2. Bundled handwriting fonts exist with valid WOFF2 signatures (0x774F4632 / wOF2)', () => {
  const fontFiles = [
    'caveat.woff2',
    'comic-neue.woff2',
    'gloria-hallelujah.woff2',
    'pacifico.woff2',
    'permanent-marker.woff2',
  ];
  const fontsDir = path.resolve(__dirname, '../public/fonts');

  for (const file of fontFiles) {
    const fullPath = path.join(fontsDir, file);
    assert.ok(fs.existsSync(fullPath), `Font missing: ${file}`);
    const buf = fs.readFileSync(fullPath);
    assert.ok(buf.length > 10000, `Font file unexpectedly small: ${file}`);
    // Check WOFF2 magic bytes: 'wOF2' (0x77, 0x4F, 0x46, 0x32)
    const magic = buf.subarray(0, 4).toString('ascii');
    assert.strictEqual(magic, 'wOF2', `Invalid woff2 header for ${file}: ${magic}`);
  }
});

// Check 3: Font licenses documented
check('3. Font license notices documented in public/fonts/LICENSE.txt', () => {
  const licenseText = fs.readFileSync(path.resolve(__dirname, '../public/fonts/LICENSE.txt'), 'utf8');
  assert.ok(licenseText.includes('Caveat'));
  assert.ok(licenseText.includes('Comic Neue'));
  assert.ok(licenseText.includes('Gloria Hallelujah'));
  assert.ok(licenseText.includes('Pacifico'));
  assert.ok(licenseText.includes('Permanent Marker'));
  assert.ok(licenseText.includes('Open Font License'));
  assert.ok(licenseText.includes('Apache License'));
});

// Check 4: Zero Remote Font Requests in index.html & local @font-face in CSS
check('4. Offline startup readiness: no remote Google Fonts in index.html, local @font-face in CSS', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.ok(!html.includes('fonts.googleapis.com'));
  assert.ok(!html.includes('fonts.gstatic.com'));

  const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8');
  assert.ok(css.includes("url('/fonts/caveat.woff2')"));
  assert.ok(css.includes("url('/fonts/comic-neue.woff2')"));
  assert.ok(css.includes("url('/fonts/gloria-hallelujah.woff2')"));
  assert.ok(css.includes("url('/fonts/pacifico.woff2')"));
  assert.ok(css.includes("url('/fonts/permanent-marker.woff2')"));
});

// Check 5: Dialog Accessibility & Focus Trapping
check('5. Accessible dialog semantics: role="dialog", aria-modal="true", Tab focus trap, and Escape', () => {
  const modalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/manager/WidgetDetailModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('role="dialog"'));
  assert.ok(modalSrc.includes('aria-modal="true"'));
  assert.ok(modalSrc.includes('aria-labelledby="modal-widget-title"'));
  assert.ok(modalSrc.includes('aria-describedby="modal-widget-desc"'));
  assert.ok(modalSrc.includes('previousActiveElementRef'));
  assert.ok(modalSrc.includes("e.key === 'Escape'"));
  assert.ok(modalSrc.includes("e.key === 'Tab'"));
  assert.ok(modalSrc.includes('firstElement.focus()'));
  assert.ok(modalSrc.includes('lastElement.focus()'));
});

// Check 6: Reduced Motion in JS & CSS
check('6. Reduced motion support across JS (Playz, Stickk) and CSS media query overrides', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8');
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('.anim-smooth-flip-next'));
  assert.ok(css.includes('.anim-paper-tear'));
  assert.ok(css.includes('.playz-brush-stroke'));

  const playzSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/playz/PlayzWidget.tsx'), 'utf8');
  assert.ok(playzSrc.includes('isReducedMotion()'));

  const stickkSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/stickk/StickkWidget.tsx'), 'utf8');
  assert.ok(stickkSrc.includes('isReducedMotion()'));
});

// Check 7: Character Integrity & Social Proof Removal
check('7. Character integrity: zero mojibake and fake social proof replaced with authentic dimensions', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8');
  assert.ok(!css.includes('â€”'), 'Mojibake found in CSS');

  const catalogSrc = fs.readFileSync(path.resolve(__dirname, '../src/utils/widgetsCatalog.ts'), 'utf8');
  assert.ok(!catalogSrc.includes('12.4k users'), 'Fake users found in catalog');
  assert.ok(!catalogSrc.includes('4.9 ★'), 'Fake rating found in catalog');

  const modalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/manager/WidgetDetailModal.tsx'), 'utf8');
  assert.ok(!modalSrc.includes('⭐ <strong>'), 'Fake star rating found in modal');
});

console.log(`\nVerification complete: ${passedChecks}/${totalChecks} checks passed.`);
if (passedChecks === totalChecks) {
  console.log('ALL W08 NATIVE CHECKS PASSED SUCCESSFULLY.');
  process.exit(0);
} else {
  console.error('SOME CHECKS FAILED.');
  process.exit(1);
}
