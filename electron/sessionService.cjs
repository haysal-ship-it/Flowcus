/**
 * Authoritative Session & Retention Service (W04)
 * Single source of truth for timer countdown, focus minute accounting,
 * task state, midnight rollover, and multi-window snapshot broadcasting.
 */

const {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
} = require('./durableStore.cjs');
const {
  createInitialSessionState,
  getLocalTodayDateString,
  getCandidateTask,
  taskDurationToSeconds,
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
} = require('./sessionTransitions.cjs');

class SessionService {
  /**
   * @param {object} options
   * @param {import('./durableStore.cjs').DurableStore} options.durableStore
   * @param {Function} [options.broadcastFn] Callback to broadcast snapshot to browser windows
   * @param {object} [options.powerMonitor] Electron powerMonitor instance (optional)
   */
  constructor({ durableStore, broadcastFn, powerMonitor } = {}) {
    this.durableStore = durableStore;
    this.broadcastFn = typeof broadcastFn === 'function' ? broadcastFn : () => {};
    this.powerMonitor = powerMonitor;

    this.tickIntervalId = null;
    this.midnightTimeoutId = null;

    // Load or initialize state
    this.state = this.initFromStore();

    // Start tick loop if state was running upon boot (e.g. crash recovery)
    this.checkSessionRecovery();

    // Setup midnight schedule
    this.scheduleMidnightCheck();

    // Hook power monitor if available
    if (this.powerMonitor && typeof this.powerMonitor.on === 'function') {
      this.powerMonitor.on('resume', () => this.handleWake());
      this.powerMonitor.on('unlock-screen', () => this.handleWake());
    }
  }

  /**
   * Initializes session and task data from durable store with safe migration.
   */
  initFromStore() {
    const todayStr = getLocalTodayDateString();
    const defaultState = createInitialSessionState(todayStr);

    if (!this.durableStore) {
      return defaultState;
    }

    const loaded = this.durableStore.state;
    if (!loaded) {
      return defaultState;
    }

    // Safely migrate or load existing tasks and session state
    const existingTasks = Array.isArray(loaded.tasks) ? loaded.tasks : [];
    const existingHistory = Array.isArray(loaded.taskHistory) ? loaded.taskHistory : [];
    const existingSession = loaded.activeSession && typeof loaded.activeSession === 'object'
      ? loaded.activeSession
      : defaultState.activeSession;
    const existingDayFocus = loaded.dayFocusMinutes && typeof loaded.dayFocusMinutes === 'object'
      ? loaded.dayFocusMinutes
      : { [todayStr]: 0 };
    const existingLedger = loaded.completionLedger && typeof loaded.completionLedger === 'object'
      ? loaded.completionLedger
      : {};

    const state = {
      schemaVersion: 1,
      tasks: existingTasks,
      taskHistory: existingHistory,
      activeSession: existingSession,
      dayFocusMinutes: existingDayFocus,
      completionLedger: existingLedger,
    };

    // If day has changed while app was closed, run safe midnight rollover
    const storedDate = Object.keys(existingDayFocus).sort().pop();
    if (storedDate && storedDate !== todayStr) {
      return transitionMidnightRollover(state, todayStr, Date.now());
    }

    return state;
  }

  /**
   * Persists authoritative state to durable store asynchronously.
   */
  async persist() {
    if (!this.durableStore) return;
    try {
      const defaultEnv = getDefaultState();
      const currentEnvelope = this.durableStore.state || defaultEnv;
      const updatedEnvelope = {
        ...defaultEnv,
        ...currentEnvelope,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        desktop: currentEnvelope.desktop || defaultEnv.desktop,
        updatedAt: new Date().toISOString(),
        tasks: this.state.tasks,
        taskHistory: this.state.taskHistory,
        activeSession: this.state.activeSession,
        dayFocusMinutes: this.state.dayFocusMinutes,
        completionLedger: this.state.completionLedger,
        migrationMarkers: {
          ...(currentEnvelope.migrationMarkers || {}),
          v1_session_state_migrated: new Date().toISOString(),
        },
      };

      await this.durableStore.save(updatedEnvelope);
    } catch (err) {
      console.error('[SessionService] Failed to persist state:', err);
    }
  }

  /**
   * Generates public snapshot of session, tasks, and daily progress.
   */
  getSnapshot() {
    const todayStr = getLocalTodayDateString();
    const focusedMinutesToday = this.state.dayFocusMinutes[todayStr] || 0;

    const todayTasks = this.state.tasks.filter(t => t.targetDate === todayStr);
    const completedToday = todayTasks.filter(t => t.completed).length;

    // Calculate streak days (consecutive preceding days with > 0 minutes or completed tasks)
    let streakDays = focusedMinutesToday > 0 || completedToday > 0 ? 1 : 0;
    const pastDates = Object.keys(this.state.dayFocusMinutes)
      .filter(d => d < todayStr)
      .sort()
      .reverse();

    let checkDate = new Date();
    for (const d of pastDates) {
      checkDate.setDate(checkDate.getDate() - 1);
      const expectedStr = getLocalTodayDateString(checkDate);
      if (d === expectedStr && (this.state.dayFocusMinutes[d] || 0) > 0) {
        streakDays += 1;
      } else {
        break;
      }
    }

    return {
      session: { ...this.state.activeSession },
      tasks: [...this.state.tasks],
      taskHistory: [...(this.state.taskHistory || [])],
      focusedMinutesToday,
      dailyStats: {
        completedTasks: completedToday,
        totalTasks: todayTasks.length,
        focusMinutes: focusedMinutesToday,
        streakDays,
      },
    };
  }

  /**
   * Broadcasts latest snapshot to all subscribed windows.
   */
  notify() {
    const snapshot = this.getSnapshot();
    this.broadcastFn(snapshot);
  }

  /**
   * Recovers active session state on startup.
   */
  checkSessionRecovery() {
    const sess = this.state.activeSession;
    if (sess.status === 'running') {
      const now = Date.now();
      if (sess.targetEndTimeMs && now >= sess.targetEndTimeMs) {
        // Expired while closed: complete deterministically
        this.state = transitionCompleteSession(this.state, sess.id, sess.targetEndTimeMs);
        this.persist();
      } else {
        // Still running: resume tick interval
        this.startTickLoop();
      }
    }
  }

  /**
   * Starts internal 250ms tick loop.
   */
  startTickLoop() {
    if (this.tickIntervalId) return;

    this.tickIntervalId = setInterval(() => {
      if (this.state.activeSession.status !== 'running') {
        this.stopTickLoop();
        return;
      }

      const prevRemaining = this.state.activeSession.remainingSeconds;
      const prevStatus = this.state.activeSession.status;

      this.state = transitionTick(this.state, Date.now());

      if (this.state.activeSession.status !== prevStatus) {
        // Status changed (e.g. completed)
        this.stopTickLoop();
        this.persist();
        this.notify();
      } else if (this.state.activeSession.remainingSeconds !== prevRemaining) {
        // Second ticked down
        this.notify();
      }
    }, 250);
  }

  /**
   * Stops internal tick loop.
   */
  stopTickLoop() {
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  /**
   * Handles system sleep/wake or screen unlock.
   */
  handleWake() {
    if (this.state.activeSession.status === 'running') {
      this.state = transitionTick(this.state, Date.now());
      if (this.state.activeSession.status !== 'running') {
        this.stopTickLoop();
        this.persist();
      }
      this.notify();
    }
  }

  /**
   * Schedules midnight rollover check.
   */
  scheduleMidnightCheck() {
    if (this.midnightTimeoutId) {
      clearTimeout(this.midnightTimeoutId);
    }

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0, 50
    );
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    this.midnightTimeoutId = setTimeout(() => {
      this.performMidnightRollover();
      this.scheduleMidnightCheck();
    }, msUntilMidnight);
  }

  /**
   * Executes midnight rollover.
   */
  performMidnightRollover() {
    const todayStr = getLocalTodayDateString();
    this.state = transitionMidnightRollover(this.state, todayStr, Date.now());
    this.persist();
    this.notify();
  }

  /* --- Public Session Commands --- */

  startSession(taskId) {
    this.state = transitionStartSession(this.state, taskId, Date.now());
    if (this.state.error) {
      return { success: false, error: this.state.error };
    }
    this.startTickLoop();
    this.persist();
    this.notify();
    return { success: true };
  }

  pauseSession() {
    this.state = transitionPauseSession(this.state, Date.now());
    this.stopTickLoop();
    this.persist();
    this.notify();
    return { success: true };
  }

  resumeSession() {
    this.state = transitionResumeSession(this.state, Date.now());
    if (this.state.activeSession.status === 'running') {
      this.startTickLoop();
    }
    this.persist();
    this.notify();
    return { success: true };
  }

  resetSession() {
    this.state = transitionResetSession(this.state, Date.now());
    this.stopTickLoop();
    this.persist();
    this.notify();
    return { success: true };
  }

  completeSession(sessionId) {
    this.state = transitionCompleteSession(this.state, sessionId || this.state.activeSession.id, Date.now());
    this.stopTickLoop();
    this.persist();
    this.notify();
    return { success: true };
  }

  selectActiveTask(taskId) {
    this.state = transitionSelectActiveTask(this.state, taskId);
    if (this.state.error) {
      return { success: false, error: this.state.error };
    }
    this.persist();
    this.notify();
    return { success: true };
  }

  /* --- Public Task Commands --- */

  addTask(title, durationEst) {
    this.state = transitionTaskAdd(this.state, title, durationEst, getLocalTodayDateString());
    this.persist();
    this.notify();
    return { success: true, tasks: this.state.tasks };
  }

  toggleTask(taskId) {
    this.state = transitionTaskToggle(this.state, taskId, Date.now());
    this.persist();
    this.notify();
    return { success: true, tasks: this.state.tasks };
  }

  deleteTask(taskId) {
    this.state = transitionTaskDelete(this.state, taskId, Date.now());
    this.persist();
    this.notify();
    return { success: true, tasks: this.state.tasks };
  }

  editTask(taskId, newTitle, newDuration) {
    this.state = transitionTaskEdit(this.state, taskId, newTitle, newDuration);
    this.persist();
    this.notify();
    return { success: true, tasks: this.state.tasks };
  }

  seedSampleTasks() {
    const today = getLocalTodayDateString();
    const seedTasks = [
      {
        id: `task-sample-1-${Date.now()}`,
        title: 'Review and refine valorant landing page',
        completed: true,
        durationEst: '30m',
        inProgress: false,
        targetDate: today,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `task-sample-2-${Date.now()}`,
        title: 'Update solime design system',
        completed: false,
        durationEst: '30m',
        inProgress: true,
        targetDate: today,
        createdAt: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: `task-sample-3-${Date.now()}`,
        title: 'Publish framer websites to web',
        completed: false,
        durationEst: '15m',
        inProgress: false,
        targetDate: today,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `task-sample-4-${Date.now()}`,
        title: 'Verify trinipix mobile responsiveness',
        completed: false,
        durationEst: '30m',
        inProgress: false,
        targetDate: today,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: `task-sample-5-${Date.now()}`,
        title: 'Send invites to prospective donors',
        completed: false,
        durationEst: '15m',
        inProgress: false,
        targetDate: today,
        createdAt: new Date().toISOString(),
      },
    ];

    const currentDayFocus = { ...this.state.dayFocusMinutes };
    currentDayFocus[today] = Math.max(60, currentDayFocus[today] || 0);

    const activeSecs = taskDurationToSeconds('30m');

    this.state = {
      ...this.state,
      tasks: seedTasks,
      dayFocusMinutes: currentDayFocus,
      activeSession: {
        ...this.state.activeSession,
        status: 'idle',
        taskId: seedTasks[1].id,
        taskTitle: seedTasks[1].title,
        initialDurationSeconds: activeSecs,
        remainingSeconds: activeSecs,
        targetEndTimeMs: null,
      },
    };

    this.persist();
    this.notify();
    return { success: true };
  }

  destroy() {
    this.stopTickLoop();
    if (this.midnightTimeoutId) {
      clearTimeout(this.midnightTimeoutId);
      this.midnightTimeoutId = null;
    }
  }
}

module.exports = {
  SessionService,
};
