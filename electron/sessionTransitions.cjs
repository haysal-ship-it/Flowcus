/**
 * Pure Session & Task Transitions (W04)
 * Pure, testable reducer transitions managing authoritative focus sessions,
 * task lifecycle, midnight rollover, and focus minute accounting.
 */

const DEFAULT_TOTAL_SESSIONS = 5;
const DEFAULT_TASK_DURATION_SECS = 1800; // 30 minutes

/**
 * Normalizes task duration string ('15m' | '30m' | '60m').
 */
function normalizeTaskDuration(raw) {
  if (!raw) return '30m';
  const clean = String(raw).trim().toLowerCase();
  if (clean === '15m' || clean === '15' || clean === '15 min' || clean === '15 mins') return '15m';
  if (clean === '60m' || clean === '60' || clean === '60 min' || clean === '60 mins' || clean === '1h') return '60m';
  if (clean === '30m' || clean === '30' || clean === '30 min' || clean === '30 mins') return '30m';

  const num = parseInt(clean, 10);
  if (!Number.isNaN(num)) {
    if (num <= 20) return '15m';
    if (num >= 45) return '60m';
    return '30m';
  }
  return '30m';
}

/**
 * Converts duration string to seconds.
 */
function taskDurationToSeconds(duration) {
  const norm = normalizeTaskDuration(duration);
  switch (norm) {
    case '15m': return 900;
    case '60m': return 3600;
    case '30m':
    default:
      return 1800;
  }
}

/**
 * Returns YYYY-MM-DD local calendar date string.
 */
function getLocalTodayDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates initial clean session state.
 */
function createInitialSessionState(dateStr = getLocalTodayDateString()) {
  return {
    schemaVersion: 1,
    tasks: [],
    taskHistory: [],
    activeSession: {
      id: null,
      taskId: null,
      taskTitle: '',
      initialDurationSeconds: DEFAULT_TASK_DURATION_SECS,
      remainingSeconds: DEFAULT_TASK_DURATION_SECS,
      status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
      targetEndTimeMs: null,
      startedAtMs: null,
      lastTickMs: null,
      creditedSeconds: 0,
      currentSession: 1,
      totalSessions: DEFAULT_TOTAL_SESSIONS,
    },
    dayFocusMinutes: { [dateStr]: 0 },
    completionLedger: {},
  };
}

/**
 * Gets candidate active task from incomplete tasks.
 */
function getCandidateTask(tasks, activeTaskId) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const incomplete = tasks.filter(t => !t.completed);
  if (incomplete.length === 0) return null;

  if (activeTaskId) {
    const found = incomplete.find(t => t.id === activeTaskId);
    if (found) return found;
  }
  return incomplete.find(t => t.inProgress) || incomplete[0] || null;
}

/**
 * Starts a focus session bound to a task.
 * Invariant: Cannot start if already running. Task must be incomplete.
 */
function transitionStartSession(state, targetTaskId, nowMs = Date.now(), idGenerator) {
  const currentStatus = state.activeSession.status;
  if (currentStatus === 'running') {
    return { ...state, error: 'SESSION_ALREADY_RUNNING' };
  }

  const activeTask = getCandidateTask(state.tasks, targetTaskId || state.activeSession.taskId);
  if (!activeTask) {
    return { ...state, error: 'NO_INCOMPLETE_TASK' };
  }

  const durationSecs = taskDurationToSeconds(activeTask.durationEst);
  const sessionId = typeof idGenerator === 'function'
    ? idGenerator()
    : `sess_${nowMs}_${Math.random().toString(36).substring(2, 8)}`;

  const updatedTasks = state.tasks.map(t => ({
    ...t,
    inProgress: t.id === activeTask.id,
  }));

  const todayStr = getLocalTodayDateString(new Date(nowMs));
  const dayFocus = { ...state.dayFocusMinutes };
  if (typeof dayFocus[todayStr] !== 'number') {
    dayFocus[todayStr] = 0;
  }

  return {
    ...state,
    error: undefined,
    tasks: updatedTasks,
    dayFocusMinutes: dayFocus,
    activeSession: {
      ...state.activeSession,
      id: sessionId,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      initialDurationSeconds: durationSecs,
      remainingSeconds: durationSecs,
      status: 'running',
      targetEndTimeMs: nowMs + durationSecs * 1000,
      startedAtMs: nowMs,
      lastTickMs: nowMs,
      creditedSeconds: 0,
    },
  };
}

/**
 * Pauses a running focus session.
 */
function transitionPauseSession(state, nowMs = Date.now()) {
  if (state.activeSession.status !== 'running') {
    return state;
  }

  const sess = state.activeSession;
  const remaining = sess.targetEndTimeMs
    ? Math.max(0, Math.ceil((sess.targetEndTimeMs - nowMs) / 1000))
    : sess.remainingSeconds;

  return {
    ...state,
    error: undefined,
    activeSession: {
      ...sess,
      status: 'paused',
      remainingSeconds: remaining,
      targetEndTimeMs: null,
      lastTickMs: nowMs,
    },
  };
}

/**
 * Resumes a paused focus session.
 */
function transitionResumeSession(state, nowMs = Date.now()) {
  if (state.activeSession.status !== 'paused') {
    return state;
  }

  const sess = state.activeSession;
  const duration = sess.remainingSeconds > 0 ? sess.remainingSeconds : sess.initialDurationSeconds;

  return {
    ...state,
    error: undefined,
    activeSession: {
      ...sess,
      status: 'running',
      remainingSeconds: duration,
      targetEndTimeMs: nowMs + duration * 1000,
      lastTickMs: nowMs,
    },
  };
}

/**
 * Cancels/resets an active session.
 * Invariant: Retains elapsed focus minutes, but active task remains incomplete.
 */
function transitionResetSession(state, nowMs = Date.now()) {
  const sess = state.activeSession;
  const todayStr = getLocalTodayDateString(new Date(nowMs));
  const dayFocus = { ...state.dayFocusMinutes };

  // Calculate elapsed active focus seconds
  let elapsedSeconds = 0;
  if (sess.status === 'running' || sess.status === 'paused') {
    elapsedSeconds = Math.max(0, sess.initialDurationSeconds - sess.remainingSeconds);
  }

  // Credit any uncredited whole minutes
  const uncreditedSeconds = Math.max(0, elapsedSeconds - sess.creditedSeconds);
  const minutesToAdd = Math.floor(uncreditedSeconds / 60);

  if (minutesToAdd > 0) {
    dayFocus[todayStr] = (dayFocus[todayStr] || 0) + minutesToAdd;
  }

  const activeTask = getCandidateTask(state.tasks, sess.taskId);
  const nextDuration = activeTask ? taskDurationToSeconds(activeTask.durationEst) : 0;

  return {
    ...state,
    error: undefined,
    dayFocusMinutes: dayFocus,
    activeSession: {
      ...sess,
      id: null,
      taskId: activeTask ? activeTask.id : null,
      taskTitle: activeTask ? activeTask.title : '',
      initialDurationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      status: 'idle',
      targetEndTimeMs: null,
      startedAtMs: null,
      lastTickMs: nowMs,
      creditedSeconds: 0,
    },
  };
}

/**
 * Authoritative timer tick calculation.
 * Handles system sleep/wake, clock shifts, and triggers completion on expiry.
 */
function transitionTick(state, nowMs = Date.now()) {
  if (state.activeSession.status !== 'running') {
    return state;
  }

  const sess = state.activeSession;

  // Protect against backward clock skew: clamp delta >= 0
  const effectiveNow = sess.lastTickMs && nowMs < sess.lastTickMs ? sess.lastTickMs : nowMs;

  // Check for expiry
  if (sess.targetEndTimeMs && effectiveNow >= sess.targetEndTimeMs) {
    return transitionCompleteSession(state, sess.id, sess.targetEndTimeMs);
  }

  const remaining = sess.targetEndTimeMs
    ? Math.max(0, Math.ceil((sess.targetEndTimeMs - effectiveNow) / 1000))
    : sess.remainingSeconds;

  return {
    ...state,
    activeSession: {
      ...sess,
      remainingSeconds: remaining,
      lastTickMs: effectiveNow,
    },
  };
}

/**
 * Completes a focus session deterministically and idempotently.
 * Invariant: Executed at most once per sessionId via completionLedger.
 */
function transitionCompleteSession(state, sessionId, nowMs = Date.now()) {
  const sess = state.activeSession;

  // Idempotency check against completion ledger
  if (sessionId && state.completionLedger[sessionId]) {
    // Redundant completion ignored cleanly
    return state;
  }

  const todayStr = getLocalTodayDateString(new Date(nowMs));
  const dayFocus = { ...state.dayFocusMinutes };

  // Calculate uncredited focus minutes for the completed session
  const totalSecs = sess.initialDurationSeconds;
  const uncreditedSecs = Math.max(0, totalSecs - sess.creditedSeconds);
  const minutesToAdd = Math.max(1, Math.round(uncreditedSecs / 60));

  dayFocus[todayStr] = (dayFocus[todayStr] || 0) + minutesToAdd;

  const targetTaskId = sess.taskId;

  // Mark active task as completed
  const updatedTasks = state.tasks.map(t => {
    if (t.id === targetTaskId) {
      return {
        ...t,
        completed: true,
        inProgress: false,
        completedAt: new Date(nowMs).toISOString(),
      };
    }
    return t;
  });

  // Next session index calculation (1..totalSessions)
  const nextSessionIndex = sess.currentSession < sess.totalSessions
    ? sess.currentSession + 1
    : 1;

  // Ledger entry
  const updatedLedger = {
    ...state.completionLedger,
    [sessionId || `completed_${nowMs}`]: {
      completedAt: new Date(nowMs).toISOString(),
      taskId: targetTaskId,
      minutesCredited: minutesToAdd,
      sessionNumber: sess.currentSession,
    },
  };

  const nextCandidate = getCandidateTask(updatedTasks, null);
  const nextDuration = nextCandidate ? taskDurationToSeconds(nextCandidate.durationEst) : 0;

  return {
    ...state,
    error: undefined,
    tasks: updatedTasks,
    dayFocusMinutes: dayFocus,
    completionLedger: updatedLedger,
    activeSession: {
      ...sess,
      id: null,
      taskId: nextCandidate ? nextCandidate.id : null,
      taskTitle: nextCandidate ? nextCandidate.title : '',
      initialDurationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      status: 'completed',
      targetEndTimeMs: null,
      startedAtMs: null,
      lastTickMs: nowMs,
      creditedSeconds: 0,
      currentSession: nextSessionIndex,
    },
  };
}

/**
 * Task selection/switching transition.
 * Invariant: Prohibited while a session is running or paused.
 */
function transitionSelectActiveTask(state, newTaskId) {
  if (state.activeSession.status === 'running' || state.activeSession.status === 'paused') {
    return {
      ...state,
      error: 'TASK_SWITCH_REQUIRES_SESSION_RESET',
    };
  }

  const targetTask = state.tasks.find(t => t.id === newTaskId && !t.completed);
  if (!targetTask) return state;

  const secs = taskDurationToSeconds(targetTask.durationEst);
  const updatedTasks = state.tasks.map(t => ({
    ...t,
    inProgress: t.id === newTaskId,
  }));

  return {
    ...state,
    error: undefined,
    tasks: updatedTasks,
    activeSession: {
      ...state.activeSession,
      taskId: newTaskId,
      taskTitle: targetTask.title,
      initialDurationSeconds: secs,
      remainingSeconds: secs,
      status: 'idle',
      targetEndTimeMs: null,
    },
  };
}

/**
 * Non-destructive midnight rollover transition.
 * - Incomplete tasks are retained and rolled forward to new date.
 * - Completed tasks are preserved in taskHistory.
 * - Running sessions continue running; time before midnight credits to yesterday, after to today.
 */
function transitionMidnightRollover(state, newDateStr, yesterdayMidnightMs = Date.now()) {
  const currentDayFocus = { ...state.dayFocusMinutes };
  if (typeof currentDayFocus[newDateStr] !== 'number') {
    currentDayFocus[newDateStr] = 0;
  }

  const incompleteTasks = [];
  const newlyArchived = [];

  for (const task of state.tasks) {
    if (task.completed) {
      newlyArchived.push({
        ...task,
        archivedAt: new Date(yesterdayMidnightMs).toISOString(),
      });
    } else {
      incompleteTasks.push({
        ...task,
        targetDate: newDateStr,
      });
    }
  }

  const sess = state.activeSession;
  let updatedSession = { ...sess };

  // If a session is actively running across midnight, split the credit
  if (sess.status === 'running' && sess.startedAtMs && sess.targetEndTimeMs) {
    const elapsedBeforeMidnight = Math.max(0, Math.floor((yesterdayMidnightMs - sess.startedAtMs) / 1000));
    const uncreditedBefore = Math.max(0, elapsedBeforeMidnight - sess.creditedSeconds);
    const minsBefore = Math.floor(uncreditedBefore / 60);

    const prevDate = getLocalTodayDateString(new Date(sess.startedAtMs));
    if (minsBefore > 0) {
      currentDayFocus[prevDate] = (currentDayFocus[prevDate] || 0) + minsBefore;
      updatedSession.creditedSeconds += minsBefore * 60;
    }
  }

  return {
    ...state,
    tasks: incompleteTasks,
    taskHistory: [...(state.taskHistory || []), ...newlyArchived],
    dayFocusMinutes: currentDayFocus,
    activeSession: updatedSession,
  };
}

/**
 * Task CRUD transitions
 */
function transitionTaskAdd(state, title, durationEst, targetDate = getLocalTodayDateString(), idGenerator) {
  const validDuration = normalizeTaskDuration(durationEst);
  const taskId = typeof idGenerator === 'function' ? idGenerator() : `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newTask = {
    id: taskId,
    title: String(title).trim(),
    completed: false,
    durationEst: validDuration,
    inProgress: false,
    targetDate,
    createdAt: new Date().toISOString(),
  };

  const wasEmpty = state.tasks.filter(t => !t.completed).length === 0;
  const updatedTasks = [...state.tasks, newTask];

  let nextSession = { ...state.activeSession };
  if (wasEmpty && (state.activeSession.status === 'idle' || state.activeSession.status === 'completed')) {
    const secs = taskDurationToSeconds(validDuration);
    nextSession = {
      ...nextSession,
      status: 'idle',
      taskId: newTask.id,
      taskTitle: newTask.title,
      initialDurationSeconds: secs,
      remainingSeconds: secs,
      targetEndTimeMs: null,
    };
  }

  return {
    ...state,
    tasks: updatedTasks,
    activeSession: nextSession,
  };
}

function transitionTaskToggle(state, taskId, nowMs = Date.now()) {
  const target = state.tasks.find(t => t.id === taskId);
  if (!target) return state;

  const nextCompleted = !target.completed;
  const updatedTasks = state.tasks.map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        completed: nextCompleted,
        inProgress: nextCompleted ? false : t.inProgress,
        completedAt: nextCompleted ? new Date(nowMs).toISOString() : undefined,
      };
    }
    return t;
  });

  let nextSession = { ...state.activeSession };

  // If the active task is completed outside timer, clean up running session
  if (state.activeSession.taskId === taskId && nextCompleted) {
    if (state.activeSession.status === 'running' || state.activeSession.status === 'paused') {
      // Award elapsed focus and reset session
      return transitionResetSession({
        ...state,
        tasks: updatedTasks,
      }, nowMs);
    }

    const candidate = getCandidateTask(updatedTasks, null);
    const secs = candidate ? taskDurationToSeconds(candidate.durationEst) : 0;
    nextSession = {
      ...nextSession,
      status: 'idle',
      taskId: candidate ? candidate.id : null,
      taskTitle: candidate ? candidate.title : '',
      initialDurationSeconds: secs,
      remainingSeconds: secs,
      targetEndTimeMs: null,
    };
  }

  return {
    ...state,
    tasks: updatedTasks,
    activeSession: nextSession,
  };
}

function transitionTaskDelete(state, taskId, nowMs = Date.now()) {
  const target = state.tasks.find(t => t.id === taskId);
  if (!target) return state;

  const updatedTasks = state.tasks.filter(t => t.id !== taskId);

  // If deleted task was bound to active session, cancel session cleanly
  if (state.activeSession.taskId === taskId) {
    return transitionResetSession({
      ...state,
      tasks: updatedTasks,
    }, nowMs);
  }

  return {
    ...state,
    tasks: updatedTasks,
  };
}

function transitionTaskEdit(state, taskId, newTitle, newDuration) {
  const normDuration = newDuration ? normalizeTaskDuration(newDuration) : undefined;
  const updatedTasks = state.tasks.map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        title: newTitle !== undefined ? String(newTitle).trim() : t.title,
        durationEst: normDuration !== undefined ? normDuration : t.durationEst,
      };
    }
    return t;
  });

  let nextSession = { ...state.activeSession };
  if (state.activeSession.taskId === taskId && (state.activeSession.status === 'idle' || state.activeSession.status === 'completed')) {
    const updatedTask = updatedTasks.find(t => t.id === taskId);
    const secs = taskDurationToSeconds(updatedTask?.durationEst);
    nextSession = {
      ...nextSession,
      taskTitle: updatedTask ? updatedTask.title : '',
      initialDurationSeconds: secs,
      remainingSeconds: secs,
    };
  }

  return {
    ...state,
    tasks: updatedTasks,
    activeSession: nextSession,
  };
}

module.exports = {
  DEFAULT_TOTAL_SESSIONS,
  DEFAULT_TASK_DURATION_SECS,
  normalizeTaskDuration,
  taskDurationToSeconds,
  getLocalTodayDateString,
  createInitialSessionState,
  getCandidateTask,
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
};
