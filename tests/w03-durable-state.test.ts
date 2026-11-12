/**
 * W03 Automated Regression Tests: Durable State & Storage Foundation
 * Audits covered: Audit 17 (P1 confirmed)
 * Storage foundation for: Audits 02–04 and 22
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
  validateSchema,
  migrateLegacyState,
  atomicWriteFileSync,
  DurableStore,
} = require('../electron/durableStore.cjs');

describe('W03: Schema Versioning & Boundaries (Audit 17)', () => {
  test('CURRENT_SCHEMA_VERSION is 1 and default state conforms to schema', () => {
    assert.strictEqual(CURRENT_SCHEMA_VERSION, 1);
    const def = getDefaultState();
    assert.strictEqual(def.schemaVersion, 1);
    assert.strictEqual(typeof def.updatedAt, 'string');
    assert.strictEqual(typeof def.revision, 'number');
    assert.ok(def.desktop, 'Default state must include desktop envelope');
    assert.strictEqual(validateSchema(def).valid, true);
  });

  test('validateSchema rejects unsupported newer schema versions without mutation', () => {
    const newerState = {
      schemaVersion: 99,
      appVersion: '99.0.0',
      desktop: { pinned: {} },
    };

    const result = validateSchema(newerState);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, 'UNSUPPORTED_NEWER_VERSION');
    assert.strictEqual(result.version, 99);
  });

  test('validateSchema rejects non-object or malformed structures', () => {
    assert.strictEqual(validateSchema(null).valid, false);
    assert.strictEqual(validateSchema([]).valid, false);
    assert.strictEqual(validateSchema('string').valid, false);
    assert.strictEqual(validateSchema({ schemaVersion: 1 }).valid, false); // missing desktop
  });
});

describe('W03: Atomic File Replacement (Audit 17)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w03-atomic-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test('atomicWriteFileSync writes complete file and cleans up temp files', () => {
    const targetFile = path.join(tempDir, 'state.json');
    const content = JSON.stringify({ hello: 'world', time: Date.now() });

    atomicWriteFileSync(targetFile, content);

    assert.ok(fs.existsSync(targetFile));
    assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), content);

    // Assert no leftover .tmp files in directory
    const files = fs.readdirSync(tempDir);
    const tmpFiles = files.filter(f => f.endsWith('.tmp'));
    assert.strictEqual(tmpFiles.length, 0, 'No .tmp files should linger after atomic write');
  });

  test('atomicWriteFileSync cleanly replaces existing file content', () => {
    const targetFile = path.join(tempDir, 'state.json');
    atomicWriteFileSync(targetFile, JSON.stringify({ version: 1 }));
    atomicWriteFileSync(targetFile, JSON.stringify({ version: 2 }));

    const readBack = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    assert.strictEqual(readBack.version, 2);
  });
});

describe('W03: DurableStore Lifecycle, Migration & Recovery (Audit 17)', () => {
  let tempDir: string;
  let statePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w03-store-test-'));
    statePath = path.join(tempDir, 'uwidgets_desktop_state.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test('Fresh initialization creates valid primary and backup files', () => {
    const store = new DurableStore(statePath);
    const result = store.load();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.initializedNew, true);
    assert.strictEqual(result.state.schemaVersion, 1);

    // Verify both primary and .bak exist on disk
    assert.ok(fs.existsSync(statePath));
    assert.ok(fs.existsSync(`${statePath}.bak`));
  });

  test('Safe legacy unversioned data migration preserves all IDs and content with backup', () => {
    // Write unversioned legacy file as existed in W00-W02
    const legacyState = {
      pinned: { flowcus: true, playz: false, stickk: true },
      open: { flowcus: true, playz: false, stickk: true },
      positions: { flowcus: { x: 500, y: 150 } },
      scaleFactor: 1.25,
      startWithWindows: true,
      startMinimized: false,
      soundEffects: true,
      alwaysOnTopDefault: true,
      closeToTray: true,
      accentColor: '#00C853',
      tasks: [
        { id: 'task-101', title: 'Legacy Task Preserved', completed: false, durationEst: '30m' },
      ],
      stickkPages: [
        { id: 'page-202', title: 'Legacy Note Preserved', text: 'Important ideas' },
      ],
    };
    fs.writeFileSync(statePath, JSON.stringify(legacyState, null, 2), 'utf8');

    const store = new DurableStore(statePath);
    const result = store.load();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.migrated, true);
    assert.strictEqual(result.state.schemaVersion, 1);

    // 1. Pre-migration backup exists
    assert.ok(fs.existsSync(`${statePath}.pre-migration.bak`), 'Pre-migration backup must be created');
    const rawPreMigration = JSON.parse(fs.readFileSync(`${statePath}.pre-migration.bak`, 'utf8'));
    assert.strictEqual(rawPreMigration.pinned.flowcus, true);

    // 2. Migration marker recorded
    assert.ok(result.state.migrationMarkers.v1_desktop_state_migrated);

    // 3. IDs and contents preserved verbatim
    assert.strictEqual(result.state.desktop.pinned.flowcus, true);
    assert.strictEqual(result.state.desktop.pinned.stickk, true);
    assert.strictEqual(result.state.desktop.restoreOnStartup.flowcus, true);
    assert.strictEqual(result.state.desktop.positions.flowcus.x, 500);
    assert.strictEqual(result.state.desktop.scaleFactor, 1.25);
    assert.strictEqual(result.state.desktop.accentColor, '#00C853');

    assert.strictEqual(result.state.tasks.length, 1);
    assert.strictEqual(result.state.tasks[0].id, 'task-101');
    assert.strictEqual(result.state.tasks[0].title, 'Legacy Task Preserved');

    assert.strictEqual(result.state.stickkPages.length, 1);
    assert.strictEqual(result.state.stickkPages[0].id, 'page-202');
    assert.strictEqual(result.state.stickkPages[0].title, 'Legacy Note Preserved');

    // 4. Repeated load is idempotent
    const secondLoad = store.load();
    assert.strictEqual(secondLoad.success, true);
    assert.strictEqual(secondLoad.state.tasks[0].id, 'task-101');
  });

  test('Unsupported newer schema versions reject loading and protect file from overwrite', () => {
    const futureData = {
      schemaVersion: 2,
      appVersion: '2.0.0',
      desktop: { pinned: {} },
      futureFeaturePayload: { doNotErase: true },
    };
    fs.writeFileSync(statePath, JSON.stringify(futureData, null, 2), 'utf8');

    const store = new DurableStore(statePath);
    const result = store.load();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'UNSUPPORTED_NEWER_VERSION');
    assert.strictEqual(result.version, 2);

    // Verify file on disk was NOT modified or truncated
    const diskContent = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(diskContent.schemaVersion, 2);
    assert.strictEqual(diskContent.futureFeaturePayload.doNotErase, true);
  });

  test('Corrupted or truncated primary file recovers from last-known-good backup and quarantines corrupt file', () => {
    // 1. Initialize a valid store and save state
    const store = new DurableStore(statePath);
    store.load();

    const goodState = {
      ...store.state,
      desktop: {
        ...store.state.desktop,
        accentColor: '#123456',
        scaleFactor: 1.5,
      },
      tasks: [{ id: 'task-good', title: 'Surviving task' }],
    };
    store.saveSync(goodState);

    assert.ok(fs.existsSync(`${statePath}.bak`), 'Backup must exist after save');

    // 2. Corrupt the primary file (simulating sudden power loss mid-write)
    fs.writeFileSync(statePath, '{"schemaVersion": 1, "desktop": { "acc', 'utf8');

    // 3. Load with corrupted primary file
    const storeRecovery = new DurableStore(statePath);
    const recoveryResult = storeRecovery.load();

    assert.strictEqual(recoveryResult.success, true);
    assert.strictEqual(recoveryResult.recoveredFromBackup, true);
    assert.strictEqual(recoveryResult.state.desktop.accentColor, '#123456');
    assert.strictEqual(recoveryResult.state.tasks[0].id, 'task-good');

    // 4. Verify corrupted file was quarantined
    assert.ok(recoveryResult.corruptPath);
    assert.ok(fs.existsSync(recoveryResult.corruptPath), 'Corrupted file must be preserved for forensics');
  });

  test('Serialized concurrent saves execute sequentially without race conditions', async () => {
    const store = new DurableStore(statePath);
    store.load();

    // Launch 10 concurrent saves
    const promises: Promise<any>[] = [];
    for (let i = 1; i <= 10; i++) {
      const stateToSave = {
        ...store.state,
        desktop: {
          ...store.state.desktop,
          scaleFactor: 1.0 + i * 0.05,
        },
      };
      promises.push(store.save(stateToSave));
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 10);

    // Final file on disk must be valid JSON with monotonic revision
    const diskContent = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(diskContent.schemaVersion, 1);
    assert.ok(diskContent.revision >= 10);

    // Assert no lingering .tmp files
    const files = fs.readdirSync(tempDir);
    const tmpFiles = files.filter(f => f.endsWith('.tmp'));
    assert.strictEqual(tmpFiles.length, 0);
  });
});
