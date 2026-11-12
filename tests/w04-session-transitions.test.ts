import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createInitialSessionState,
  transitionStartSession,
  transitionPauseSession,
  transitionResumeSession,
  transitionResetSession,
  transitionTick,
  transitionCompleteSession,
  transitionSelectActiveTask,
  transitionMidnightRollover,
  transitionTaskAdd,
  transitionTaskToggle,
  transitionTaskDelete,
  transitionTaskEdit,
} = require('../electron/sessionTransitions.cjs');

describe('W04: Pure Session State Transitions & Accounting (Audits 02, 04, 05)', () => {
  test('Initial session state conforms to schema with valid defaults', () => {
    const state = createInitialSessionState('2026-11-11');
    assert.strictEqual(state.schemaVersion, 1);
    assert.deepStrictEqual(state.tasks, []);
    assert.deepStrictEqual(state.taskHistory, []);
    assert.strictEqual(state.activeSession.status, 'idle');
    assert.strictEqual(state.activeSession.currentSession, 1);
    assert.strictEqual(state.activeSession.totalSessions, 5);
    assert.strictEqual(state.dayFocusMinutes['2026-11-11'], 0);
  });

  test('Start session binds to active task and duration immutably', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Audit 04 task', '30m', '2026-11-11', () => 't-1');

    const now = new Date('2026-11-11T12:00:00').getTime();
    const started = transitionStartSession(state, 't-1', now, () => 'sess-100');

    assert.strictEqual(started.activeSession.status, 'running');
    assert.strictEqual(started.activeSession.id, 'sess-100');
    assert.strictEqual(started.activeSession.taskId, 't-1');
    assert.strictEqual(started.activeSession.initialDurationSeconds, 1800);
    assert.strictEqual(started.activeSession.remainingSeconds, 1800);
    assert.strictEqual(started.activeSession.targetEndTimeMs, now + 1800 * 1000);
    assert.strictEqual(started.tasks.find((t: any) => t.id === 't-1')?.inProgress, true);

    // Invariant: Cannot start again if already running
    const secondStart = transitionStartSession(started, 't-1', now + 1000);
    assert.strictEqual(secondStart.error, 'SESSION_ALREADY_RUNNING');
  });

  test('Switching active task during active session is prohibited (Audit 05)', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Task 1', '30m', '2026-11-11', () => 't-1');
    state = transitionTaskAdd(state, 'Task 2', '15m', '2026-11-11', () => 't-2');

    const now = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-1', now, () => 'sess-1');
    assert.strictEqual(state.activeSession.status, 'running');

    // Attempting to switch task under active running session
    const switchAttempt = transitionSelectActiveTask(state, 't-2');
    assert.strictEqual(switchAttempt.error, 'TASK_SWITCH_REQUIRES_SESSION_RESET');
    assert.strictEqual(switchAttempt.activeSession.taskId, 't-1');

    // Pausing also prohibits task switching
    const paused = transitionPauseSession(state, now + 5000);
    const switchPausedAttempt = transitionSelectActiveTask(paused, 't-2');
    assert.strictEqual(switchPausedAttempt.error, 'TASK_SWITCH_REQUIRES_SESSION_RESET');
    assert.strictEqual(switchPausedAttempt.activeSession.taskId, 't-1');
  });

  test('Pause and resume preserve countdown accuracy and target end time', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Pausable task', '30m', '2026-11-11', () => 't-1');

    const startMs = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-1', startMs, () => 'sess-p');

    // 10 minutes (600s) pass
    const pauseMs = startMs + 600 * 1000;
    const paused = transitionPauseSession(state, pauseMs);

    assert.strictEqual(paused.activeSession.status, 'paused');
    assert.strictEqual(paused.activeSession.remainingSeconds, 1200);
    assert.strictEqual(paused.activeSession.targetEndTimeMs, null);

    // 5 minutes later, resume
    const resumeMs = pauseMs + 300 * 1000;
    const resumed = transitionResumeSession(paused, resumeMs);

    assert.strictEqual(resumed.activeSession.status, 'running');
    assert.strictEqual(resumed.activeSession.remainingSeconds, 1200);
    assert.strictEqual(resumed.activeSession.targetEndTimeMs, resumeMs + 1200 * 1000);
  });

  test('Reset/cancel awards elapsed focus minutes but leaves task incomplete (Audit 04)', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Incomplete test task', '30m', '2026-11-11', () => 't-1');

    const startMs = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-1', startMs, () => 'sess-c');

    // User focuses for 12 minutes (720s) and then resets
    const tickMs = startMs + 720 * 1000;
    const ticked = transitionTick(state, tickMs);
    assert.strictEqual(ticked.activeSession.remainingSeconds, 1080);

    const resetState = transitionResetSession(ticked, tickMs);

    // Elapsed focus minutes (12 min) awarded to daily bucket
    assert.strictEqual(resetState.dayFocusMinutes['2026-11-11'], 12);
    // Task remains INCOMPLETE
    const task = resetState.tasks.find((t: any) => t.id === 't-1');
    assert.strictEqual(task?.completed, false);
    // Session returned to idle
    assert.strictEqual(resetState.activeSession.status, 'idle');
    assert.strictEqual(resetState.activeSession.id, null);
  });

  test('Session expiry completes task and is strictly idempotent (Audit 02, 04)', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Full focus task', '30m', '2026-11-11', () => 't-1');

    const startMs = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-1', startMs, () => 'sess-complete-1');

    // Tick to expiry (1800s later)
    const expiryMs = startMs + 1800 * 1000;
    const completed = transitionTick(state, expiryMs);

    assert.strictEqual(completed.activeSession.status, 'completed');
    assert.strictEqual(completed.activeSession.currentSession, 2); // advanced to session 2
    assert.strictEqual(completed.dayFocusMinutes['2026-11-11'], 30); // 30 minutes awarded
    const task = completed.tasks.find((t: any) => t.id === 't-1');
    assert.strictEqual(task?.completed, true);
    assert.ok(task?.completedAt);
    assert.ok(completed.completionLedger['sess-complete-1']);

    // Duplicate completion call with same sessionId MUST BE A NO-OP
    const duplicateRun = transitionCompleteSession(completed, 'sess-complete-1', expiryMs + 5000);
    // Focus minutes must NOT be doubled
    assert.strictEqual(duplicateRun.dayFocusMinutes['2026-11-11'], 30);
    assert.strictEqual(duplicateRun.activeSession.currentSession, 2);
  });

  test('Backward system clock skew does not produce negative elapsed time', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Clock test', '30m', '2026-11-11', () => 't-1');

    const startMs = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-1', startMs, () => 'sess-skew');

    // 10 seconds elapse
    state = transitionTick(state, startMs + 10000);
    assert.strictEqual(state.activeSession.remainingSeconds, 1790);

    // User sets system clock backward by 1 hour
    const backwardMs = startMs - 3600000;
    const skewedState = transitionTick(state, backwardMs);

    // Remaining seconds must not increase beyond initial or become negative; delta clamped
    assert.strictEqual(skewedState.activeSession.remainingSeconds, 1790);
    assert.strictEqual(skewedState.activeSession.lastTickMs, startMs + 10000);
  });
});

describe('W04: Safe Retention & Non-Destructive Midnight Rollover (Audit 03)', () => {
  test('Midnight rollover carries incomplete tasks and archives completed tasks', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Incomplete Task', '30m', '2026-11-11', () => 't-inc');
    state = transitionTaskAdd(state, 'Completed Task', '15m', '2026-11-11', () => 't-comp');
    const toggleMs = new Date('2026-11-11T20:00:00').getTime();
    state = transitionTaskToggle(state, 't-comp', toggleMs);

    assert.strictEqual(state.tasks.find((t: any) => t.id === 't-comp')?.completed, true);
    assert.strictEqual(state.tasks.find((t: any) => t.id === 't-inc')?.completed, false);

    // Midnight rollover to 2026-11-12
    const rolloverMs = new Date('2026-11-12T00:00:01').getTime();
    const rolloverState = transitionMidnightRollover(state, '2026-11-12', rolloverMs);

    // Incomplete tasks preserved and rolled forward
    assert.strictEqual(rolloverState.tasks.length, 1);
    assert.strictEqual(rolloverState.tasks[0].id, 't-inc');
    assert.strictEqual(rolloverState.tasks[0].targetDate, '2026-11-12');

    // Completed task safely archived into taskHistory
    assert.strictEqual(rolloverState.taskHistory.length, 1);
    assert.strictEqual(rolloverState.taskHistory[0].id, 't-comp');
    assert.ok(rolloverState.taskHistory[0].archivedAt);

    // Next day's focus minutes initialized
    assert.strictEqual(rolloverState.dayFocusMinutes['2026-11-12'], 0);
  });

  test('Running session spanning midnight splits credit across calendar day buckets', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Midnight Task', '30m', '2026-11-11', () => 't-mid');

    // Session starts at 23:45 (15 min before midnight)
    // 30 min duration = 1800s. Target end is 00:15 next day.
    const midnightMs = new Date('2026-11-12T00:00:00').getTime();
    const startMs = midnightMs - 15 * 60 * 1000; // 15 mins before midnight
    state = transitionStartSession(state, 't-mid', startMs, () => 'sess-midnight');

    // Rollover occurs at midnight
    const rolledOver = transitionMidnightRollover(state, '2026-11-12', midnightMs);

    // 15 minutes before midnight credited to 2026-11-11
    assert.strictEqual(rolledOver.dayFocusMinutes['2026-11-11'], 15);
    // Session is still running!
    assert.strictEqual(rolledOver.activeSession.status, 'running');
    assert.strictEqual(rolledOver.activeSession.id, 'sess-midnight');

    // Finish session at 00:15
    const finishMs = midnightMs + 15 * 60 * 1000;
    const finished = transitionTick(rolledOver, finishMs);

    assert.strictEqual(finished.activeSession.status, 'completed');
    // Remaining 15 minutes credited to 2026-11-12
    assert.strictEqual(finished.dayFocusMinutes['2026-11-12'], 15);
    // Task marked completed
    assert.strictEqual(finished.tasks.find((t: any) => t.id === 't-mid')?.completed, true);
  });
});

describe('W04: Task Lifecycle & Active Session Consistency (Audit 07)', () => {
  test('Deleting active task during running session resets session and awards elapsed focus', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Task to delete', '30m', '2026-11-11', () => 't-del');

    const startMs = new Date('2026-11-11T12:00:00').getTime();
    state = transitionStartSession(state, 't-del', startMs, () => 'sess-del');

    // 6 minutes pass (360s)
    state = transitionTick(state, startMs + 360 * 1000);

    // User deletes the active task
    const afterDelete = transitionTaskDelete(state, 't-del', startMs + 360 * 1000);

    // Task deleted
    assert.strictEqual(afterDelete.tasks.length, 0);
    // Elapsed focus credited (6 min)
    assert.strictEqual(afterDelete.dayFocusMinutes['2026-11-11'], 6);
    // Session cleanly reset
    assert.strictEqual(afterDelete.activeSession.status, 'idle');
    assert.strictEqual(afterDelete.activeSession.taskId, null);
  });

  test('Editing task updates duration when session is idle', () => {
    let state = createInitialSessionState('2026-11-11');
    state = transitionTaskAdd(state, 'Old Title', '30m', '2026-11-11', () => 't-edit');

    const edited = transitionTaskEdit(state, 't-edit', 'New Title', '60m');
    assert.strictEqual(edited.tasks[0].title, 'New Title');
    assert.strictEqual(edited.tasks[0].durationEst, '60m');
    assert.strictEqual(edited.activeSession.initialDurationSeconds, 3600);
    assert.strictEqual(edited.activeSession.remainingSeconds, 3600);
  });
});
