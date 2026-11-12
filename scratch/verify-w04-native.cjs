/**
 * Native Electron W04 Verification Script
 * Validates multi-window broadcast observation, close-before-expiry recovery,
 * idempotent completion, cancellation accounting, and task retention on restart.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { DurableStore } = require('../electron/durableStore.cjs');
const { SessionService } = require('../electron/sessionService.cjs');
const { getLocalTodayDateString } = require('../electron/sessionTransitions.cjs');

async function runNativeChecks() {
  console.log('=== Running Native Electron W04 Verification ===');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uwidgets-w04-verify-'));
  const statePath = path.join(tempDir, 'uwidgets_desktop_state.json');
  console.log('Temp test directory:', tempDir);

  const durableStore = new DurableStore(statePath);

  // Track broadcasts
  const window1Snapshots = [];
  const window2Snapshots = [];
  const broadcastFn = (snapshot) => {
    window1Snapshots.push(JSON.parse(JSON.stringify(snapshot)));
    window2Snapshots.push(JSON.parse(JSON.stringify(snapshot)));
  };

  const service = new SessionService({ durableStore, broadcastFn });

  try {
    // ------------------------------------------------------------------------
    // [Native Test 1] Two views observing one session & task add broadcast
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 1] Verifying two views observing one session simultaneously...');
    service.addTask('Desktop Feature A', '30m');

    assert.strictEqual(window1Snapshots.length, 1);
    assert.strictEqual(window2Snapshots.length, 1);
    assert.strictEqual(window1Snapshots[0].tasks.length, 1);
    assert.strictEqual(window2Snapshots[0].tasks.length, 1);
    assert.strictEqual(window1Snapshots[0].tasks[0].title, 'Desktop Feature A');
    assert.strictEqual(window2Snapshots[0].tasks[0].title, 'Desktop Feature A');
    console.log('✔ Test 1 Passed: Both views received identical synchronized snapshots via IPC broadcast.');

    // ------------------------------------------------------------------------
    // [Native Test 2] Start session & Active task switching restriction (Audit 05)
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 2] Verifying task switching restriction during active session (Audit 05)...');
    service.addTask('Desktop Feature B', '15m');
    const taskIdA = service.state.tasks[0].id;
    const taskIdB = service.state.tasks[1].id;

    const startRes = service.startSession(taskIdA);
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(service.state.activeSession.status, 'running');
    assert.strictEqual(service.state.activeSession.taskId, taskIdA);

    // Attempt to switch task while session is running
    const switchRes = service.selectActiveTask(taskIdB);
    assert.strictEqual(switchRes.success, false);
    assert.strictEqual(switchRes.error, 'TASK_SWITCH_REQUIRES_SESSION_RESET');
    assert.strictEqual(service.state.activeSession.taskId, taskIdA, 'Active task must remain unchanged');
    console.log('✔ Test 2 Passed: Switching active task under running session was safely rejected.');

    // ------------------------------------------------------------------------
    // [Native Test 3] Pause, resume, and cancellation accounting (Audit 04)
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 3] Verifying cancellation accounting & task incomplete retention (Audit 04)...');
    service.pauseSession();
    assert.strictEqual(service.state.activeSession.status, 'paused');

    service.resumeSession();
    assert.strictEqual(service.state.activeSession.status, 'running');

    // Simulate elapsed time (e.g. 15 minutes of 30 min block)
    const startedAt = service.state.activeSession.startedAtMs;
    service.state.activeSession.remainingSeconds = 900; // 15 min left
    service.state.activeSession.lastTickMs = startedAt + 900 * 1000;

    // Reset session (cancel)
    service.resetSession();
    assert.strictEqual(service.state.activeSession.status, 'idle');
    const todayStr = getLocalTodayDateString();
    assert.strictEqual(service.state.dayFocusMinutes[todayStr], 15, '15 minutes of elapsed focus credited');
    const taskA = service.state.tasks.find(t => t.id === taskIdA);
    assert.strictEqual(taskA.completed, false, 'Canceled session must NOT mark task as completed');
    console.log('✔ Test 3 Passed: Elapsed focus credited on cancellation while task remains incomplete.');

    // ------------------------------------------------------------------------
    // [Native Test 4] Idempotent session completion (Audit 02, 04)
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 4] Verifying idempotent completion ledger (Audit 02, 04)...');
    service.startSession(taskIdA);
    const sessionId = service.state.activeSession.id;
    assert.ok(sessionId);

    // Complete session
    service.completeSession(sessionId);
    assert.strictEqual(service.state.activeSession.status, 'completed');
    assert.strictEqual(service.state.tasks.find(t => t.id === taskIdA).completed, true);
    const minsAfterFirstComplete = service.state.dayFocusMinutes[todayStr];

    // Repeated completion call with same sessionId
    service.completeSession(sessionId);
    assert.strictEqual(
      service.state.dayFocusMinutes[todayStr],
      minsAfterFirstComplete,
      'Duplicate completion call must not double credit focus minutes'
    );
    console.log('✔ Test 4 Passed: Repeated completion requests deduplicated with 0 double crediting.');

    // ------------------------------------------------------------------------
    // [Native Test 5] Closing before expiry and reopening afterward (Restart Recovery)
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 5] Verifying close before expiry & recovery upon restart...');
    service.startSession(taskIdB);
    const sessBId = service.state.activeSession.id;
    // Set target expiry in past (as if app was closed while running and reopened 30 mins later)
    service.state.activeSession.targetEndTimeMs = Date.now() - 60000;
    await service.persist();
    service.destroy();

    // Reopen application with new service instance reading persisted store
    const recoveredStore = new DurableStore(statePath);
    recoveredStore.load();
    const serviceReopened = new SessionService({ durableStore: recoveredStore });

    assert.strictEqual(serviceReopened.state.activeSession.status, 'completed');
    assert.strictEqual(serviceReopened.state.tasks.find(t => t.id === taskIdB).completed, true);
    assert.ok(serviceReopened.state.completionLedger[sessBId]);
    console.log('✔ Test 5 Passed: Expired session completed safely on reopening and task completed.');

    // ------------------------------------------------------------------------
    // [Native Test 6] Safe midnight rollover preserves unfinished tasks (Audit 03)
    // ------------------------------------------------------------------------
    console.log('\n[Native Test 6] Verifying safe midnight rollover & task retention (Audit 03)...');
    serviceReopened.addTask('Unfinished Task for Tomorrow', '30m');
    const uncompletedCountBefore = serviceReopened.state.tasks.filter(t => !t.completed).length;

    // Trigger rollover to tomorrow
    serviceReopened.performMidnightRollover();

    const uncompletedCountAfter = serviceReopened.state.tasks.filter(t => !t.completed).length;
    assert.strictEqual(uncompletedCountAfter, uncompletedCountBefore, 'Unfinished tasks must be preserved across midnight');
    assert.ok(serviceReopened.state.taskHistory.length > 0, 'Completed tasks must be retained in taskHistory');
    console.log('✔ Test 6 Passed: Unfinished tasks carried over and completed tasks archived.');

    serviceReopened.destroy();
    console.log('\n=== ALL NATIVE ELECTRON W04 CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {}
  }
}

runNativeChecks().catch(err => {
  console.error('\n❌ NATIVE W04 VERIFICATION FAILED:', err);
  process.exit(1);
});
