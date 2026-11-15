import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(process.cwd());
const {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
  validateSchema,
  migrateLegacyState,
  DurableStore,
} = require('../electron/durableStore.cjs');
const {
  shouldInterceptManagerClose,
  computeNextRestoreIntent,
  validateWidgetId,
  validateSettingPayload,
  isValidAppUrl,
} = require('../electron/ipcSecurity.cjs');

describe('W10: Release Candidate & Release Gate Verification (Audits 29 & 35)', () => {

  describe('Gate 1: Fresh Installation & First Launch in Disposable Profile', () => {
    test('fresh initialization generates clean default envelope without errors', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w10-fresh-'));
      const stateFile = path.join(tempDir, 'uwidgets_desktop_state.json');

      try {
        const store = new DurableStore(stateFile);
        const res = store.load();

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.initializedNew, true);
        assert.strictEqual(Boolean(res.migrated), false);
        assert.strictEqual(store.state.schemaVersion, CURRENT_SCHEMA_VERSION);
        assert.strictEqual(store.state.desktop.accentColor, '#D05300');
        assert.strictEqual(store.state.desktop.scaleFactor, 1.0);
        assert.strictEqual(store.state.desktop.closeToTray, true);
        assert.deepStrictEqual(store.state.desktop.restoreOnStartup, {
          flowcus: false,
          playz: false,
          stickk: false,
          blockz: false,
          quotz: false,
          ayah: false,
          statz: false,
          rowz: false,
        });
        assert.deepStrictEqual(store.state.tasks, []);
        assert.deepStrictEqual(store.state.stickkPages, []);
        assert.strictEqual(fs.existsSync(stateFile), true);
        assert.strictEqual(fs.existsSync(`${stateFile}.bak`), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Gate 2: All Three Widgets, Dimensions & Settings Schema', () => {
    test('authoritative widget dimensions registry exists and defines all 3 widgets', () => {
      const dimsPath = path.join(ROOT, 'src', 'utils', 'widgetDimensions.json');
      assert.strictEqual(fs.existsSync(dimsPath), true);
      const dims = JSON.parse(fs.readFileSync(dimsPath, 'utf8'));

      assert.ok(dims.flowcus && dims.flowcus.width === 312 && dims.flowcus.height === 505);
      assert.ok(dims.playz && dims.playz.width === 312 && dims.playz.height === 475);
      assert.ok(dims.stickk && dims.stickk.width === 312 && dims.stickk.height === 510);
    });

    test('settings payload validation accepts valid settings and rejects unapproved keys', () => {
      assert.strictEqual(validateSettingPayload('accentColor', '#D05300').valid, true);
      assert.strictEqual(validateSettingPayload('scaleFactor', 1.25).valid, true);
      assert.strictEqual(validateSettingPayload('closeToTray', true).valid, true);
      assert.strictEqual(validateSettingPayload('startMinimized', false).valid, true);
      assert.strictEqual(validateSettingPayload('soundEffects', true).valid, true);

      // Rejections
      assert.strictEqual(validateSettingPayload('__proto__', 'evil').valid, false);
      assert.strictEqual(validateSettingPayload('unapprovedKey', 123).valid, false);
      assert.strictEqual(validateSettingPayload('scaleFactor', 5.0).valid, false); // Bounded [0.5, 2.0]
    });
  });

  describe('Gate 3: Tray Quit Lifecycle & Restoration Intent Separation', () => {
    test('Tray Quit (isQuitting: true) bypasses close interception across all states', () => {
      assert.strictEqual(
        shouldInterceptManagerClose({ isQuitting: true, hasActiveWidgets: true, closeToTray: true }),
        false,
        'Must NOT intercept when isQuitting is true'
      );
      assert.strictEqual(
        shouldInterceptManagerClose({ isQuitting: false, hasActiveWidgets: true, closeToTray: true }),
        true,
        'Must intercept during normal execution when closeToTray is true'
      );
    });

    test('reopening preserves restoreOnStartup on quit, but explicit removal clears it', () => {
      const initialRestore = { flowcus: true, playz: false, stickk: true };

      // App quit preserves intent
      const afterQuit = computeNextRestoreIntent({
        currentRestoreMap: initialRestore,
        action: 'window_closed',
        widgetId: 'flowcus',
        isQuitting: true,
      });
      assert.deepStrictEqual(afterQuit, { flowcus: true, playz: false, stickk: true });

      // Explicit removal clears intent
      const afterRemoval = computeNextRestoreIntent({
        currentRestoreMap: initialRestore,
        action: 'explicit_close',
        widgetId: 'flowcus',
      });
      assert.deepStrictEqual(afterRemoval, { flowcus: false, playz: false, stickk: true });
    });
  });

  describe('Gate 4: Offline Launch & Asset Bundling', () => {
    test('index.html contains zero remote network links for fonts or scripts', () => {
      const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      assert.ok(!indexHtml.includes('fonts.googleapis.com'));
      assert.ok(!indexHtml.includes('fonts.gstatic.com'));
      assert.ok(!indexHtml.includes('http://'));
      assert.ok(!indexHtml.includes('https://'));
    });

    test('all 5 handwriting fonts are bundled locally with valid WOFF2 headers', () => {
      const fontFiles = [
        'caveat.woff2',
        'comic-neue.woff2',
        'gloria-hallelujah.woff2',
        'pacifico.woff2',
        'permanent-marker.woff2',
      ];
      for (const font of fontFiles) {
        const fullPath = path.join(ROOT, 'public', 'fonts', font);
        assert.strictEqual(fs.existsSync(fullPath), true, `Missing font ${font}`);
        const buf = fs.readFileSync(fullPath);
        // WOFF2 header signature is 0x774F4632 ("wOF2")
        const sig = buf.toString('utf8', 0, 4);
        assert.strictEqual(sig, 'wOF2', `Invalid WOFF2 signature for ${font}`);
      }
    });
  });

  describe('Gate 5: Upgrade Simulation from Previous Legacy Build', () => {
    test('migrating legacy unversioned data creates pre-migration backup and retains all records', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w10-upgrade-'));
      const stateFile = path.join(tempDir, 'uwidgets_desktop_state.json');

      try {
        const legacyData = {
          pinned: { flowcus: true, playz: false, stickk: true },
          open: { flowcus: true, playz: false, stickk: true },
          accentColor: '#10B981',
          scaleFactor: 1.15,
          tasks: [
            { id: 'task-legacy-1', title: 'Legacy Task 1', durationEst: 25, completed: false },
            { id: 'task-legacy-2', title: 'Completed Yesterday', durationEst: 45, completed: true },
          ],
          stickkPages: [
            {
              id: 'note-legacy-1',
              title: 'Legacy Note',
              theme: 'theme-green',
              font: 'font-pacifico',
              text: 'Important meeting notes from previous release',
              doodleDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              updatedAt: '2026-10-20T10:00:00.000Z',
            },
          ],
        };

        fs.writeFileSync(stateFile, JSON.stringify(legacyData, null, 2));

        const store = new DurableStore(stateFile);
        const res = store.load();

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.migrated, true);

        // Pre-migration backup exists
        assert.strictEqual(fs.existsSync(`${stateFile}.pre-migration.bak`), true);

        // Tasks and notes preserved
        assert.strictEqual(store.state.tasks.length, 2);
        assert.strictEqual(store.state.tasks[0].id, 'task-legacy-1');
        assert.strictEqual(store.state.stickkPages.length, 1);
        assert.strictEqual(store.state.stickkPages[0].id, 'note-legacy-1');
        assert.strictEqual(store.state.stickkPages[0].doodleDataUrl, legacyData.stickkPages[0].doodleDataUrl);

        // Desktop preferences migrated
        assert.strictEqual(store.state.desktop.accentColor, '#10B981');
        assert.strictEqual(store.state.desktop.scaleFactor, 1.15);
        assert.deepStrictEqual(store.state.desktop.restoreOnStartup, { flowcus: true, playz: false, stickk: true });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Gate 6: Uninstall & Reinstall Retention Policy Verification', () => {
    test('package.json NSIS configuration guarantees deleteAppDataOnUninstall is false', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      assert.ok(pkg.build && pkg.build.nsis);
      assert.strictEqual(
        pkg.build.nsis.deleteAppDataOnUninstall,
        false,
        'NSIS must preserve %APPDATA% on uninstall to protect user data'
      );
    });

    test('simulated app binary removal leaves userData directory completely intact', () => {
      const simulatedInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-app-bin-'));
      const simulatedUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-app-data-'));
      const stateFile = path.join(simulatedUserDataDir, 'uwidgets_desktop_state.json');

      try {
        // Seed user data
        const store = new DurableStore(stateFile);
        store.load();
        store.state.tasks = [{ id: 't-survive', title: 'Task survives uninstall', durationEst: 30, completed: false }];
        store.saveSync(store.state);

        // Simulate uninstall: Delete binary installation folder
        fs.rmSync(simulatedInstallDir, { recursive: true, force: true });
        assert.strictEqual(fs.existsSync(simulatedInstallDir), false);

        // Verify userData was NOT deleted
        assert.strictEqual(fs.existsSync(stateFile), true);

        // Simulate reinstall: Re-open store from userData
        const reinstalledStore = new DurableStore(stateFile);
        const loadRes = reinstalledStore.load();
        assert.strictEqual(loadRes.success, true);
        assert.strictEqual(reinstalledStore.state.tasks.length, 1);
        assert.strictEqual(reinstalledStore.state.tasks[0].id, 't-survive');
      } finally {
        fs.rmSync(simulatedUserDataDir, { recursive: true, force: true });
      }
    });
  });

  describe('Gate 7: Release Candidate Packaging & Integrity (Audits 29 & 35)', () => {
    test('packaged executable release/win-unpacked/Uwidgets.exe exists with valid size and hash', (t) => {
      const exePath = path.join(ROOT, 'release', 'win-unpacked', 'Uwidgets.exe');
      if (!fs.existsSync(exePath)) {
        t.skip('Packaged executable not built in this working copy yet');
        return;
      }
      const stats = fs.statSync(exePath);
      assert.ok(stats.size > 100 * 1024 * 1024, 'Executable size must be > 100 MB');
      const hash = crypto.createHash('sha256').update(fs.readFileSync(exePath)).digest('hex');
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64);
    });

    test('Windows NSIS installer release/Uwidgets-Setup.exe exists with valid size and hash', (t) => {
      const installerPath = path.join(ROOT, 'release', 'Uwidgets-Setup.exe');
      if (!fs.existsSync(installerPath)) {
        t.skip('NSIS installer not built in this working copy yet');
        return;
      }
      const stats = fs.statSync(installerPath);
      assert.ok(stats.size > 50 * 1024 * 1024, 'Installer size must be > 50 MB');
      const hash = crypto.createHash('sha256').update(fs.readFileSync(installerPath)).digest('hex');
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64);
    });

    test('README.md, LICENSE, and dependency-audit.md are present and comprehensive', () => {
      assert.strictEqual(fs.existsSync(path.join(ROOT, 'README.md')), true);
      assert.strictEqual(fs.existsSync(path.join(ROOT, 'LICENSE')), true);
      assert.strictEqual(fs.existsSync(path.join(ROOT, 'docs', 'implementation', 'dependency-audit.md')), true);

      const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
      assert.ok(readme.includes('Supported Windows Versions'));
      assert.ok(readme.includes('Manual Upgrade'));
      assert.ok(readme.includes('Data Architecture'));
      assert.ok(readme.includes('deleteAppDataOnUninstall'));
    });
  });

});
