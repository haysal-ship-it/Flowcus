import React, { useState, useEffect, useRef } from 'react';
import { TaskItem } from '../types';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  getLocalTodayDateString,
  getFocusMinutesToday,
  saveFocusMinutesToday,
  loadTimerFromStorage,
  saveTimerToStorage,
  StoredTimerData,
  normalizeTaskDuration,
  taskDurationToSeconds,
  checkAndPerformDailyReset,
  getMsUntilNextLocalMidnight,
  DAY_KEY_STORAGE,
  TASKS_STORAGE_KEY,
  FOCUS_MINUTES_KEY,
  getDefaultTimer,
  performDailyReset,
  seedReferenceTasks,
} from '../utils/taskStorage';
import { DailyProgress } from './DailyProgress';
import { ViewSwitcher, FlowcusView } from './ViewSwitcher';
import { TasksView } from './TasksView';
import { FocusView } from './FocusView';
import { SplashScreen } from './SplashScreen';
import { WidgetChrome } from './common/WidgetChrome';
import { getPreviewTasks, getPreviewTimer, PREVIEW_FOCUSED_MINUTES } from '../utils/previewFixtures';

export type ReferenceState = 'tasks-default' | 'add-task' | 'focus-idle' | 'focus-running';

export interface FlowcusWidgetProps {
  activeReferenceState?: ReferenceState;
  onChangeReferenceState?: (state: ReferenceState) => void;
  replaySplashTrigger?: number;
  sampleTasksTrigger?: number;
  resetDayTrigger?: number;
  isPreview?: boolean;
  initialTasks?: TaskItem[];
  initialTimer?: StoredTimerData;
  initialFocusedMinutes?: number;
}

export const getActiveTask = (allTasks: TaskItem[], activeTaskId: string | null): TaskItem | null => {
  if (activeTaskId) {
    const found = allTasks.find(t => t.id === activeTaskId);
    if (found && !found.completed) return found;
  }
  return allTasks.find(t => t.inProgress && !t.completed) || allTasks.find(t => !t.completed) || null;
};

export const getTaskDurationSeconds = (task: TaskItem | null | undefined): number => {
  if (!task || task.completed) return 0; // Empty focus state displays 00:00
  return taskDurationToSeconds(task.durationEst);
};

export const FlowcusWidget: React.FC<FlowcusWidgetProps> = ({
  activeReferenceState,
  onChangeReferenceState,
  replaySplashTrigger,
  sampleTasksTrigger,
  resetDayTrigger,
  isPreview = false,
  initialTasks,
  initialTimer,
  initialFocusedMinutes,
}) => {
  const [currentView, setCurrentView] = useState<FlowcusView>('tasks');
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (isPreview) return initialTasks || getPreviewTasks();
    return loadTasksFromStorage();
  });
  const [justAddedTaskId, setJustAddedTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [isSplashDone, setIsSplashDone] = useState<boolean>(() => isPreview ? true : false);

  const isElectron = Boolean(
    typeof window !== 'undefined' && window.electronAPI?.isElectron
  );

  // Initial load of timer and focused minutes with deterministic recovery
  const [timerState, setTimerState] = useState<StoredTimerData>(() => {
    if (isPreview) return initialTimer || getPreviewTimer();
    const { timer } = loadTimerFromStorage();
    return timer;
  });

  const [focusedMinutes, setFocusedMinutes] = useState<number>(() => {
    if (isPreview) return initialFocusedMinutes ?? PREVIEW_FOCUSED_MINUTES;
    const baseMinutes = getFocusMinutesToday();
    const { completedMinutesToAdd } = loadTimerFromStorage();
    if (completedMinutesToAdd > 0) {
      const updated = baseMinutes + completedMinutesToAdd;
      saveFocusMinutesToday(updated);
      return updated;
    }
    return baseMinutes;
  });

  const todayDateString = getLocalTodayDateString();

  // Authoritative session snapshot sync in Electron desktop mode (Audit 02, 07)
  useEffect(() => {
    if (isPreview || !isElectron) return;
    const api = window.electronAPI;
    if (!api?.getSessionSnapshot) return;

    api.getSessionSnapshot().then((snapshot) => {
      if (snapshot) {
        if (Array.isArray(snapshot.tasks)) setTasks(snapshot.tasks);
        if (snapshot.session) setTimerState(snapshot.session);
        if (typeof snapshot.focusedMinutesToday === 'number') setFocusedMinutes(snapshot.focusedMinutesToday);
      }
    }).catch(() => {});

    const unsub = api.onSessionSnapshot((snapshot) => {
      if (snapshot) {
        if (Array.isArray(snapshot.tasks)) setTasks(snapshot.tasks);
        if (snapshot.session) setTimerState(snapshot.session);
        if (typeof snapshot.focusedMinutesToday === 'number') setFocusedMinutes(snapshot.focusedMinutesToday);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isPreview, isElectron]);

  // Replay splash trigger
  useEffect(() => {
    if (replaySplashTrigger && replaySplashTrigger > 0) {
      setIsSplashDone(false);
    }
  }, [replaySplashTrigger]);

  // Seed sample tasks trigger
  useEffect(() => {
    if (isPreview) return;
    if (sampleTasksTrigger && sampleTasksTrigger > 0) {
      if (isElectron) {
        window.electronAPI?.seedSampleTasks?.();
      } else {
        const seeded = seedReferenceTasks();
        setTasks(seeded);
        setFocusedMinutes(60);
      }
      setAnnouncement('Sample reference tasks loaded for today.');
    }
  }, [sampleTasksTrigger, isPreview, isElectron]);

  // Daily reset trigger
  useEffect(() => {
    if (resetDayTrigger && resetDayTrigger > 0) {
      if (isPreview) return;
      if (!isElectron) {
        performDailyReset(getLocalTodayDateString());
        setTasks([]);
        setFocusedMinutes(0);
        setTimerState(getDefaultTimer());
      }
      setIsAddFormOpen(false);
      setAnnouncement('Daily reset executed: task list and progress updated.');
    }
  }, [resetDayTrigger, isPreview, isElectron]);

  // Daily lifecycle monitor: scheduled midnight timeout + wake-up / focus recheck + storage sync (browser fallback)
  useEffect(() => {
    if (isPreview || isElectron) return;
    let timeoutId: number | null = null;

    const scheduleMidnightCheck = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      const msUntilMidnight = getMsUntilNextLocalMidnight();
      timeoutId = window.setTimeout(() => {
        handleDateValidation();
        scheduleMidnightCheck();
      }, msUntilMidnight);
    };

    const handleDateValidation = () => {
      checkAndPerformDailyReset((newDayKey) => {
        setTasks(loadTasksFromStorage());
        setFocusedMinutes(0);
        setTimerState(getDefaultTimer());
        setIsAddFormOpen(false);
        setAnnouncement(`New day started (${newDayKey}). Tasks and daily progress updated.`);
      });
    };

    scheduleMidnightCheck();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleDateValidation();
      }
    };
    const onWindowFocus = () => {
      handleDateValidation();
    };

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === DAY_KEY_STORAGE) {
        handleDateValidation();
      } else if (e.key === TASKS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setTasks(parsed);
        } catch (err) {}
      } else if (e.key === FOCUS_MINUTES_KEY && e.newValue) {
        setFocusedMinutes(parseInt(e.newValue, 10) || 0);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('storage', onStorageChange);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [isPreview, isElectron]);

  // Save tasks to local storage (only in browser standalone dev mode)
  useEffect(() => {
    if (isPreview || isElectron) return;
    saveTasksToStorage(tasks);
  }, [tasks, isPreview, isElectron]);

  // Save timer to local storage on changes (only in browser standalone dev mode)
  useEffect(() => {
    if (isPreview || isElectron) return;
    saveTimerToStorage(timerState);
  }, [timerState, isPreview, isElectron]);

  // Sync toolbar reference state if activated
  useEffect(() => {
    if (activeReferenceState === 'tasks-default') {
      setCurrentView('tasks');
      setIsAddFormOpen(false);
    } else if (activeReferenceState === 'add-task') {
      setCurrentView('tasks');
      setIsAddFormOpen(true);
    } else if (activeReferenceState === 'focus-idle') {
      setCurrentView('focus');
      const active = getActiveTask(tasks, timerState.activeTaskId);
      const activeSecs = getTaskDurationSeconds(active);
      setTimerState(curr => ({
        ...curr,
        status: 'idle',
        initialDurationSeconds: activeSecs,
        remainingSeconds: activeSecs,
        targetEndTimeMs: null,
      }));
    } else if (activeReferenceState === 'focus-running') {
      setCurrentView('focus');
      const active = getActiveTask(tasks, timerState.activeTaskId);
      const activeSecs = getTaskDurationSeconds(active);
      const runningSecs = Math.max(10, activeSecs - 5);
      setTimerState(curr => ({
        ...curr,
        status: 'running',
        initialDurationSeconds: activeSecs,
        remainingSeconds: runningSecs,
        targetEndTimeMs: Date.now() + runningSecs * 1000,
      }));
    }
  }, [activeReferenceState]);

  // Synchronize idle timer duration with the active task's duration or enforce 00:00 empty state
  useEffect(() => {
    const incompleteTasks = tasks.filter(t => !t.completed);
    const hasEligible = incompleteTasks.length > 0;

    if (!hasEligible) {
      // Empty focus state: enforce 00:00, idle, and no active task
      if (
        timerState.status !== 'idle' ||
        timerState.remainingSeconds !== 0 ||
        timerState.initialDurationSeconds !== 0 ||
        timerState.activeTaskId !== null ||
        timerState.targetEndTimeMs !== null
      ) {
        setTimerState(curr => ({
          ...curr,
          status: 'idle',
          activeTaskId: null,
          targetEndTimeMs: null,
          initialDurationSeconds: 0,
          remainingSeconds: 0,
        }));
      }
    } else if (timerState.status === 'idle') {
      const active = getActiveTask(tasks, timerState.activeTaskId);
      const activeSecs = getTaskDurationSeconds(active);
      if (
        timerState.initialDurationSeconds !== activeSecs ||
        timerState.remainingSeconds !== activeSecs ||
        timerState.activeTaskId !== (active ? active.id : null)
      ) {
        setTimerState(curr => ({
          ...curr,
          activeTaskId: active ? active.id : null,
          initialDurationSeconds: activeSecs,
          remainingSeconds: activeSecs,
        }));
      }
    }
  }, [tasks, timerState.activeTaskId, timerState.status, timerState.remainingSeconds, timerState.initialDurationSeconds, timerState.targetEndTimeMs]);

  // Drift-resistant timer interval calculation
  useEffect(() => {
    if (timerState.status !== 'running' || !timerState.targetEndTimeMs) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diffMs = timerState.targetEndTimeMs! - now;

      if (diffMs <= 0) {
        if (isElectron && !isPreview) {
          // Audit 02: In Electron desktop mode, the main process is the sole authority
          // for awarding focus credit and completing tasks. Avoid renderer double credit.
          return;
        }

        // Session successfully completed!
        const sessionMins = Math.round(timerState.initialDurationSeconds / 60) || 1;
        setFocusedMinutes(prevMins => {
          const nextMins = prevMins + sessionMins;
          if (!isPreview) saveFocusMinutesToday(nextMins);
          return nextMins;
        });

        // Automatically mark active task as completed
        const activeId = timerState.activeTaskId;
        let nextCandidateId: string | null = null;
        setTasks(prevTasks => {
          const updated = prevTasks.map(t => {
            if ((activeId && t.id === activeId) || (!activeId && t.inProgress)) {
              return {
                ...t,
                completed: true,
                inProgress: false,
                completedAt: new Date().toISOString(),
              };
            }
            return t;
          });
          const nextIncomplete = updated.find(t => !t.completed);
          nextCandidateId = nextIncomplete ? nextIncomplete.id : null;
          if (!isPreview) saveTasksToStorage(updated);
          return updated;
        });

        const nextSession =
          timerState.currentSession < timerState.totalSessions
            ? timerState.currentSession + 1
            : 1;

        const nextTimer: StoredTimerData = {
          ...timerState,
          status: 'completed',
          activeTaskId: nextCandidateId,
          remainingSeconds: timerState.initialDurationSeconds,
          targetEndTimeMs: null,
          currentSession: nextSession,
          lastUpdatedMs: now,
        };

        setTimerState(nextTimer);
        if (!isPreview) saveTimerToStorage(nextTimer);
        setAnnouncement('Focus session completed! Task marked completed and daily progress updated.');
      } else {
        const remainingSecs = Math.max(0, Math.ceil(diffMs / 1000));
        setTimerState(prev => {
          if (prev.remainingSeconds === remainingSecs) return prev;
          return {
            ...prev,
            remainingSeconds: remainingSecs,
            lastUpdatedMs: now,
          };
        });
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [timerState.status, timerState.targetEndTimeMs, timerState.initialDurationSeconds, timerState.currentSession, timerState.totalSessions, timerState.activeTaskId]);

  // Filter tasks for today
  const todayTasks = tasks.filter(t => t.targetDate === todayDateString);
  const totalTodayTasks = todayTasks.length;
  const completedTodayTasks = todayTasks.filter(t => t.completed).length;

  // Task actions
  const handleToggleComplete = (id: string) => {
    if (isElectron && !isPreview) {
      window.electronAPI?.toggleTask?.(id);
      return;
    }
    setTasks(prev => {
      let clearedActive = false;
      const updated = prev.map(task => {
        if (task.id === id) {
          const nextCompleted = !task.completed;
          const nextInProgress = nextCompleted ? false : task.inProgress;
          if (nextCompleted && task.inProgress) {
            clearedActive = true;
          }
          const taskStateText = nextCompleted ? 'completed' : 'reopened';
          setAnnouncement(`Task "${task.title}" ${taskStateText}.`);
          return {
            ...task,
            completed: nextCompleted,
            inProgress: nextInProgress,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return task;
      });

      const nextCandidates = updated.filter(t => !t.completed);
      if (nextCandidates.length === 0) {
        // All tasks completed: Focus enters empty state (00:00, idle, no active task)
        setTimerState(curr => ({
          ...curr,
          status: 'idle',
          activeTaskId: null,
          targetEndTimeMs: null,
          initialDurationSeconds: 0,
          remainingSeconds: 0,
        }));
      } else if (clearedActive || !updated.some(t => t.id === timerState.activeTaskId && !t.completed)) {
        const nextCandidate = nextCandidates[0];
        const nextActiveId = nextCandidate ? nextCandidate.id : null;
        const nextSecs = getTaskDurationSeconds(nextCandidate);
        setTimerState(curr => ({
          ...curr,
          activeTaskId: nextActiveId,
          status: 'idle',
          initialDurationSeconds: nextSecs,
          remainingSeconds: nextSecs,
          targetEndTimeMs: null,
        }));
      }

      return updated;
    });
  };

  const handleAddTask = (title: string, duration?: string) => {
    const validDuration = normalizeTaskDuration(duration || '30m');
    if (isElectron && !isPreview) {
      window.electronAPI?.addTask?.(title, validDuration);
      setAnnouncement(`Task "${title}" added to list.`);
      return;
    }
    const wasEmpty = tasks.filter(t => !t.completed).length === 0;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title,
      completed: false,
      durationEst: validDuration,
      inProgress: false,
      targetDate: todayDateString,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => {
      const updated = [...prev, newTask];
      if (wasEmpty) {
        const secs = taskDurationToSeconds(validDuration);
        setTimerState(curr => ({
          ...curr,
          status: 'idle',
          activeTaskId: newTask.id,
          initialDurationSeconds: secs,
          remainingSeconds: secs,
          targetEndTimeMs: null,
        }));
      }
      return updated;
    });

    setJustAddedTaskId(newTask.id);
    // Form closing transition is owned by TasksView via onCloseAddForm
    setAnnouncement(`Task "${title}" added to list.`);

    setTimeout(() => {
      setJustAddedTaskId(null);
    }, 300);
  };

  const handleDeleteTask = (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (isElectron && !isPreview) {
      window.electronAPI?.deleteTask?.(id);
      if (target) {
        setAnnouncement(`Task "${target.title}" deleted.`);
      }
      return;
    }
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      const remainingIncompletes = updated.filter(t => !t.completed);
      if (remainingIncompletes.length === 0) {
        setTimerState(curr => ({
          ...curr,
          status: 'idle',
          activeTaskId: null,
          targetEndTimeMs: null,
          initialDurationSeconds: 0,
          remainingSeconds: 0,
        }));
      } else if (timerState.activeTaskId === id) {
        const nextActive = remainingIncompletes[0];
        const nextSecs = getTaskDurationSeconds(nextActive);
        setTimerState(curr => ({
          ...curr,
          activeTaskId: nextActive.id,
          status: 'idle',
          initialDurationSeconds: nextSecs,
          remainingSeconds: nextSecs,
          targetEndTimeMs: null,
        }));
      }
      return updated;
    });

    if (target) {
      setAnnouncement(`Task "${target.title}" deleted.`);
    }
  };

  const handleEditTask = (id: string, newTitle: string, newDuration?: string) => {
    const validDuration = newDuration ? normalizeTaskDuration(newDuration) : undefined;
    if (isElectron && !isPreview) {
      if (validDuration) {
        window.electronAPI?.editTask?.(id, newTitle, validDuration);
      }
      setAnnouncement(`Task "${newTitle}" updated.`);
      return;
    }
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              title: newTitle,
              durationEst: validDuration !== undefined ? validDuration : t.durationEst,
            }
          : t
      )
    );

    if (timerState.activeTaskId === id && validDuration && (timerState.status === 'idle' || timerState.status === 'completed')) {
      const newSecs = taskDurationToSeconds(validDuration);
      setTimerState(curr => ({
        ...curr,
        initialDurationSeconds: newSecs,
        remainingSeconds: newSecs,
      }));
    }

    setAnnouncement(`Task "${newTitle}" updated.`);
  };

  const handleToggleFocus = (id: string) => {
    const isDeselecting = timerState.activeTaskId === id;
    const nextActiveId = isDeselecting ? null : id;

    if (isElectron && !isPreview) {
      if (timerState.status === 'running' || timerState.status === 'paused') {
        setAnnouncement('Cannot switch active task while focus session is running or paused. Please reset session first.');
        return;
      }
      if (nextActiveId) {
        window.electronAPI?.selectActiveTask?.(nextActiveId);
      }
      return;
    }

    setTasks(prev =>
      prev.map(task => ({
        ...task,
        inProgress: task.id === nextActiveId,
      }))
    );

    const nextActiveTask = nextActiveId
      ? tasks.find(t => t.id === nextActiveId)
      : tasks.find(t => !t.completed && t.id !== id) || tasks[0];

    const taskSeconds = getTaskDurationSeconds(nextActiveTask);

    setTimerState(curr => {
      if (curr.status === 'idle' || curr.status === 'completed') {
        return {
          ...curr,
          activeTaskId: nextActiveId,
          initialDurationSeconds: taskSeconds,
          remainingSeconds: taskSeconds,
          targetEndTimeMs: null,
        };
      }
      return {
        ...curr,
        activeTaskId: nextActiveId,
        initialDurationSeconds: taskSeconds,
      };
    });

    const target = tasks.find(t => t.id === id);
    if (target) {
      setAnnouncement(`Task "${target.title}" set as active focus task.`);
    }
  };

  // Timer controls
  const handleStartFocus = () => {
    const eligible = tasks.filter(t => !t.completed);
    if (eligible.length === 0) return; // Guard: Cannot start focus in empty state

    if (isElectron && !isPreview) {
      const active = getActiveTask(tasks, timerState.activeTaskId);
      if (!active) return;
      window.electronAPI?.startFocusSession?.(active.id);
      setAnnouncement('Focus session started.');
      return;
    }

    const now = Date.now();
    const active = getActiveTask(tasks, timerState.activeTaskId);
    if (!active) return;
    const taskSeconds = getTaskDurationSeconds(active);

    // If starting fresh (idle or completed, or remainingSeconds <= 0), start full task countdown
    const duration =
      timerState.status === 'idle' || timerState.status === 'completed' || timerState.remainingSeconds <= 0
        ? taskSeconds
        : timerState.remainingSeconds;

    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'running',
      activeTaskId: active.id,
      initialDurationSeconds: taskSeconds,
      remainingSeconds: duration,
      targetEndTimeMs: now + duration * 1000,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    if (!isPreview) saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session started.');
  };

  const handlePauseFocus = () => {
    if (isElectron && !isPreview) {
      window.electronAPI?.pauseFocusSession?.();
      setAnnouncement('Focus session paused.');
      return;
    }

    const now = Date.now();
    const remaining = timerState.targetEndTimeMs
      ? Math.max(0, Math.ceil((timerState.targetEndTimeMs - now) / 1000))
      : timerState.remainingSeconds;

    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'paused',
      remainingSeconds: remaining,
      targetEndTimeMs: null,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    if (!isPreview) saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session paused.');
  };

  const handleResumeFocus = () => {
    const eligible = tasks.filter(t => !t.completed);
    if (eligible.length === 0) return; // Guard: Cannot resume in empty state

    if (isElectron && !isPreview) {
      window.electronAPI?.resumeFocusSession?.();
      setAnnouncement('Focus session resumed.');
      return;
    }

    const now = Date.now();
    const duration = timerState.remainingSeconds > 0 ? timerState.remainingSeconds : timerState.initialDurationSeconds;
    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'running',
      remainingSeconds: duration,
      targetEndTimeMs: now + duration * 1000,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    if (!isPreview) saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session resumed.');
  };

  const handleResetFocus = () => {
    const eligible = tasks.filter(t => !t.completed);
    if (eligible.length === 0) return; // Guard: Cannot reset in empty state

    if (isElectron && !isPreview) {
      window.electronAPI?.resetFocusSession?.();
      setAnnouncement('Focus session reset to task duration.');
      return;
    }

    const now = Date.now();
    const active = getActiveTask(tasks, timerState.activeTaskId);
    if (!active) return;
    const taskSeconds = getTaskDurationSeconds(active);
    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'idle',
      activeTaskId: active.id,
      initialDurationSeconds: taskSeconds,
      remainingSeconds: taskSeconds,
      targetEndTimeMs: null,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    if (!isPreview) saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session reset to task duration.');
  };

  const handleSelectView = (view: FlowcusView) => {
    setCurrentView(view);
    if (view === 'tasks') {
      onChangeReferenceState?.(isAddFormOpen ? 'add-task' : 'tasks-default');
    } else {
      onChangeReferenceState?.(timerState.status === 'running' ? 'focus-running' : 'focus-idle');
    }
  };

  const handleOpenAddForm = () => {
    setIsAddFormOpen(true);
    onChangeReferenceState?.('add-task');
  };

  const handleCloseAddForm = () => {
    setIsAddFormOpen(false);
    onChangeReferenceState?.('tasks-default');
  };

  const handleToggleAddForm = () => {
    const nextOpen = !isAddFormOpen;
    setIsAddFormOpen(nextOpen);
    if (onChangeReferenceState) {
      onChangeReferenceState(nextOpen ? 'add-task' : 'tasks-default');
    }
  };

  return (
    <div className="flowcus-shell-container">
      {/* 1. Figma-Inspired Intro Splash Screen */}
      {!isSplashDone && (
        <SplashScreen onFinish={() => setIsSplashDone(true)} />
      )}

      {/* 2. Flowcus Widget Content (Crossfades smoothly with Splash Screen) */}
      <div
        className={`flowcus-widget-content-wrap ${!isSplashDone ? 'splash-active' : ''}`}
        aria-hidden={!isSplashDone}
      >
        {/* Polite live accessibility announcement region */}
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {/* Surface 1: Daily Progress Panel (~410 x 144px, 22px radius, shared between tabs) */}
        <WidgetChrome title="Flowcus" tag="Focus & Tasks" widgetId="flowcus" isPreview={isPreview} />
        <DailyProgress
          completedTasks={completedTodayTasks}
          totalTasks={totalTodayTasks}
          focusedMinutes={focusedMinutes}
        />

        {/* Surface 2: Lower Content Panel (~410px wide, 22px radius) */}
        <section className="flowcus-lower-panel" aria-label="Tasks and Focus Controls">
          {/* Segmented Tasks / Focus selector: ~378 x 57px, 36px radius sliding pill */}
          <ViewSwitcher
            currentView={currentView}
            onSelectView={handleSelectView}
          />

          <div className="flowcus-panel-content">
            <div key={currentView} className="flowcus-view-fade">
              {currentView === 'tasks' ? (
                <TasksView
                  tasks={todayTasks}
                  onToggleComplete={handleToggleComplete}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={handleEditTask}
                  onToggleFocus={handleToggleFocus}
                  justAddedTaskId={justAddedTaskId}
                  isAddFormOpen={isAddFormOpen}
                  onToggleAddForm={handleToggleAddForm}
                  onCloseAddForm={handleCloseAddForm}
                  onOpenAddForm={handleOpenAddForm}
                />
              ) : (
                <FocusView
                  tasks={todayTasks}
                  timerState={timerState}
                  onStartFocus={handleStartFocus}
                  onPauseFocus={handlePauseFocus}
                  onResumeFocus={handleResumeFocus}
                  onResetFocus={handleResetFocus}
                  onSelectActiveTask={handleToggleFocus}
                  focusedMinutesToday={focusedMinutes}
                  isPreview={isPreview}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

