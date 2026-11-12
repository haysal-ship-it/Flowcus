/**
 * Native Electron Execution Test for W03 Durable State & Storage Foundation
 * Runs directly inside Electron runtime with real BrowserWindow and App APIs.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  process.exit(1);
});

// Create isolated temporary userData directory for test execution
const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w03-native-test-'));
app.setPath('userData', tempProfileDir);

const {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
  validateSchema,
  migrateLegacyState,
  atomicWriteFileSync,
  DurableStore,
} = require('c:/Users/Sal/Downloads/Flowcus-main/electron/durableStore.cjs');

const stateFilePath = path.join(tempProfileDir, 'uwidgets_desktop_state.json');

console.log('=== NATIVE ELECTRON W03 VERIFICATION START ===');
console.log('Test UserData Path:', tempProfileDir);

app.whenReady().then(async () => {
  try {
    const store = new DurableStore(stateFilePath);

    // --------------------------------------------------------------------------
    // Test 1: Missing primary file (fresh initialization)
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 1] Missing file initialization...');
    const initResult = store.load();
    assert.strictEqual(initResult.success, true);
    assert.strictEqual(initResult.initializedNew, true);
    assert.strictEqual(initResult.state.schemaVersion, 1);
    assert.ok(fs.existsSync(stateFilePath), 'Primary state file must exist');
    assert.ok(fs.existsSync(`${stateFilePath}.bak`), 'Backup file must exist');
    console.log('✔ Test 1 Passed: Fresh initialization created primary and backup files.');

    // --------------------------------------------------------------------------
    // Test 2: Valid data save and load
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 2] Valid data save and reload...');
    const updatedState = {
      ...store.state,
      desktop: {
        ...store.state.desktop,
        accentColor: '#00C853',
        scaleFactor: 1.2,
      },
      tasks: [{ id: 'task-native-1', title: 'Native Task', completed: false, durationEst: '30m' }],
      stickkPages: [{ id: 'note-native-1', title: 'Native Note', text: 'Clean durability' }],
    };
    await store.save(updatedState);

    const reloaded = store.load();
    assert.strictEqual(reloaded.success, true);
    assert.strictEqual(reloaded.state.desktop.accentColor, '#00C853');
    assert.strictEqual(reloaded.state.tasks[0].id, 'task-native-1');
    assert.strictEqual(reloaded.state.stickkPages[0].id, 'note-native-1');
    console.log('✔ Test 2 Passed: Valid state saved atomically and verified on reload.');

    // --------------------------------------------------------------------------
    // Test 3: Legacy unversioned migration & idempotency
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 3] Legacy unversioned migration...');
    const legacyPath = path.join(tempProfileDir, 'legacy_state.json');
    const legacyData = {
      pinned: { flowcus: true, playz: false, stickk: true },
      open: { flowcus: true, playz: false, stickk: true },
      positions: { flowcus: { x: 300, y: 120 } },
      scaleFactor: 1.1,
      tasks: [{ id: 'task-legacy-99', title: 'Preserved Legacy Task' }],
      stickkPages: [{ id: 'page-legacy-88', title: 'Preserved Legacy Note' }],
    };
    fs.writeFileSync(legacyPath, JSON.stringify(legacyData, null, 2), 'utf8');

    const legacyStore = new DurableStore(legacyPath);
    const migResult = legacyStore.load();
    assert.strictEqual(migResult.success, true);
    assert.strictEqual(migResult.migrated, true);
    assert.strictEqual(migResult.state.schemaVersion, 1);
    assert.ok(fs.existsSync(`${legacyPath}.pre-migration.bak`), 'Pre-migration backup must exist');
    assert.strictEqual(migResult.state.tasks[0].id, 'task-legacy-99');
    assert.strictEqual(migResult.state.stickkPages[0].id, 'page-legacy-88');

    // Repeated load must be idempotent without duplication
    const repeatedMig = legacyStore.load();
    assert.strictEqual(repeatedMig.success, true);
    assert.strictEqual(repeatedMig.state.tasks.length, 1);
    console.log('✔ Test 3 Passed: Legacy migration created backup, preserved IDs/content, and verified idempotent.');

    // --------------------------------------------------------------------------
    // Test 4: Corrupted / truncated primary with valid backup recovery
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 4] Recovery from corrupted / truncated primary file...');
    // Corrupt primary file with incomplete JSON
    fs.writeFileSync(stateFilePath, '{"schemaVersion": 1, "desktop": {"accentColor": "', 'utf8');

    const recoveryStore = new DurableStore(stateFilePath);
    const recResult = recoveryStore.load();
    assert.strictEqual(recResult.success, true);
    assert.strictEqual(recResult.recoveredFromBackup, true);
    assert.strictEqual(recResult.state.desktop.accentColor, '#00C853');
    assert.strictEqual(recResult.state.tasks[0].id, 'task-native-1');
    assert.ok(recResult.corruptPath && fs.existsSync(recResult.corruptPath), 'Corrupted file must be quarantined');
    console.log('✔ Test 4 Passed: Corrupt primary cleanly recovered from backup; corrupt bytes quarantined.');

    // --------------------------------------------------------------------------
    // Test 5: Unsupported newer schema version rejection
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 5] Unsupported newer schema version protection...');
    const futurePath = path.join(tempProfileDir, 'future_state.json');
    const futureData = {
      schemaVersion: 50,
      appVersion: '50.0.0',
      desktop: { pinned: {} },
      criticalFutureBytes: 'MUST_NOT_OVERWRITE',
    };
    fs.writeFileSync(futurePath, JSON.stringify(futureData, null, 2), 'utf8');

    const futureStore = new DurableStore(futurePath);
    const futureResult = futureStore.load();
    assert.strictEqual(futureResult.success, false);
    assert.strictEqual(futureResult.code, 'UNSUPPORTED_NEWER_VERSION');

    // Verify file on disk is untouched
    const afterCheck = JSON.parse(fs.readFileSync(futurePath, 'utf8'));
    assert.strictEqual(afterCheck.criticalFutureBytes, 'MUST_NOT_OVERWRITE');
    console.log('✔ Test 5 Passed: Newer schema version rejected and protected from overwrite.');

    // --------------------------------------------------------------------------
    // Test 6: Concurrent serialized saves
    // --------------------------------------------------------------------------
    console.log('\n[Native Test 6] Concurrent serialized saves...');
    const concurrentPromises = [];
    for (let i = 1; i <= 5; i++) {
      concurrentPromises.push(
        store.save({
          ...store.state,
          desktop: {
            ...store.state.desktop,
            scaleFactor: 1.0 + i * 0.1,
          },
        })
      );
    }
    await Promise.all(concurrentPromises);
    const finalOnDisk = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    assert.strictEqual(finalOnDisk.schemaVersion, 1);
    assert.ok(finalOnDisk.revision >= 5);
    console.log('✔ Test 6 Passed: 5 concurrent saves executed sequentially without race conditions.');

    // Clean up temporary userData
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {}

    console.log('\n=== ALL NATIVE ELECTRON W03 CHECKS PASSED SUCCESSFULLY ===');
    app.exit(0);
  } catch (err) {
    console.error('NATIVE TEST FAILED:', err);
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {}
    app.exit(1);
  }
});
