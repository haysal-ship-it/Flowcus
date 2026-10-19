import { TaskItem } from '../types';

export const TASKS_STORAGE_KEY = 'flowcus_tasks_v4';
export const FOCUS_MINUTES_KEY = 'flowcus_focus_minutes_v4';
export const TIMER_STORAGE_KEY = 'flowcus_timer_v4';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface StoredTimerData {
  status: TimerStatus;
  initialDurationSeconds: number;
  remainingSeconds: number;
  targetEndTimeMs: number | null;
  currentSession: number;
  totalSessions: number;
  activeTaskId: string | null;
  lastUpdatedMs: number;
}

export type AllowedTaskDuration = '15m' | '30m' | '60m';
export const ALLOWED_DURATIONS: readonly AllowedTaskDuration[] = ['15m', '30m', '60m'] as const;

export const normalizeTaskDuration = (raw?: string | null): AllowedTaskDuration => {
  if (!raw) return '30m';
  const clean = String(raw).trim().toLowerCase();
  if (clean === '15m' || clean === '15' || clean === '15 min' || clean === '15 mins') return '15m';
  if (clean === '60m' || clean === '60' || clean === '60 min' || clean === '60 mins' || clean === '1h') return '60m';
  if (clean === '30m' || clean === '30' || clean === '30 min' || clean === '30 mins') return '30m';

  const num = parseInt(clean, 10);
  if (!isNaN(num)) {
    if (num <= 20) return '15m';
    if (num >= 45) return '60m';
    return '30m';
  }
  return '30m';
};

export const taskDurationToSeconds = (duration?: string | null): number => {
  const norm = normalizeTaskDuration(duration);
  switch (norm) {
    case '15m':
      return 15 * 60; // 900s
    case '60m':
      return 60 * 60; // 3600s
    case '30m':
    default:
      return 30 * 60; // 1800s
  }
};

export const getLocalTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFormattedTodayDate = (): string => {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
  const day = now.getDate();
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(now);
  const year = now.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

export const DAY_KEY_STORAGE = 'flowcus_day_key_v4';

export const getMsUntilNextLocalMidnight = (): number => {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 50
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
};

export const getDefaultTimer = (): StoredTimerData => ({
  status: 'idle',
  initialDurationSeconds: 1800, // 30 minutes default
  remainingSeconds: 1800,
  targetEndTimeMs: null,
  currentSession: 1,
  totalSessions: 5,
  activeTaskId: null,
  lastUpdatedMs: Date.now(),
});

export const performDailyReset = (newDayKey: string): void => {
  try {
    localStorage.setItem(DAY_KEY_STORAGE, newDayKey);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(FOCUS_MINUTES_KEY, '0');
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(getDefaultTimer()));
  } catch (err) {
    console.error('Failed to perform daily reset', err);
  }
};

export const checkAndPerformDailyReset = (
  onReset?: (newDay: string) => void
): boolean => {
  const today = getLocalTodayDateString();
  const storedDay = localStorage.getItem(DAY_KEY_STORAGE);
  if (!storedDay || storedDay !== today) {
    performDailyReset(today);
    onReset?.(today);
    return true;
  }
  return false;
};

export const simulateNextDayReset = (): void => {
  const yesterday = new Date(Date.now() - 86400000);
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yesterday.getFullYear()}-${yMonth}-${yDay}`;
  localStorage.setItem(DAY_KEY_STORAGE, yesterdayStr);
};

export const loadTasksFromStorage = (): TaskItem[] => {
  const today = getLocalTodayDateString();
  const storedDay = localStorage.getItem(DAY_KEY_STORAGE);

  // If opening on a new local calendar day or fresh install:
  // Automatically clear expired tasks from yesterday and initialize clean empty state for today
  if (!storedDay || storedDay !== today) {
    performDailyReset(today);
    return [];
  }

  // Same day: restore today's tasks
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t: TaskItem) => ({
          ...t,
          durationEst: normalizeTaskDuration(t.durationEst),
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load tasks from localStorage', err);
  }

  return [];
};

export const seedReferenceTasks = (): TaskItem[] => {
  const today = getLocalTodayDateString();
  const seedTasks: TaskItem[] = [
    {
      id: 'task-1',
      title: 'Review and refine valorant landing page',
      completed: true,
      durationEst: '30m',
      inProgress: false,
      targetDate: today,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'task-2',
      title: 'Update solime design system',
      completed: false,
      durationEst: '30m',
      inProgress: true,
      targetDate: today,
      createdAt: new Date(Date.now() - 5400000).toISOString(),
    },
    {
      id: 'task-3',
      title: 'Publish framer websites to web',
      completed: false,
      durationEst: '15m',
      inProgress: false,
      targetDate: today,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'task-4',
      title: 'Verify trinipix mobile responsiveness',
      completed: false,
      durationEst: '30m',
      inProgress: false,
      targetDate: today,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'task-5',
      title: 'Send invites to propective donors',
      completed: false,
      durationEst: '15m',
      inProgress: false,
      targetDate: today,
      createdAt: new Date().toISOString(),
    },
  ];

  try {
    localStorage.setItem(DAY_KEY_STORAGE, today);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(seedTasks));
    saveFocusMinutesToday(60);
  } catch (e) {
    // ignore
  }

  return seedTasks;
};

export const saveTasksToStorage = (tasks: TaskItem[]): void => {
  try {
    const today = getLocalTodayDateString();
    localStorage.setItem(DAY_KEY_STORAGE, today);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to localStorage', err);
  }
};

export const getFocusMinutesToday = (): number => {
  try {
    const today = getLocalTodayDateString();
    const storedDay = localStorage.getItem(DAY_KEY_STORAGE);
    if (!storedDay || storedDay !== today) {
      return 0;
    }
    const raw = localStorage.getItem(FOCUS_MINUTES_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return 0;
};

export const saveFocusMinutesToday = (minutes: number): void => {
  try {
    localStorage.setItem(FOCUS_MINUTES_KEY, String(minutes));
  } catch (e) {
    // ignore
  }
};

export const loadTimerFromStorage = (): {
  timer: StoredTimerData;
  completedMinutesToAdd: number;
} => {
  const defaultTimer: StoredTimerData = getDefaultTimer();
  const today = getLocalTodayDateString();
  const storedDay = localStorage.getItem(DAY_KEY_STORAGE);

  // If new day, return default clean timer state with no stale task reference
  if (!storedDay || storedDay !== today) {
    return { timer: defaultTimer, completedMinutesToAdd: 0 };
  }

  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { timer: defaultTimer, completedMinutesToAdd: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { timer: defaultTimer, completedMinutesToAdd: 0 };
    }

    const initialDuration =
      typeof parsed.initialDurationSeconds === 'number' && parsed.initialDurationSeconds >= 60
        ? parsed.initialDurationSeconds
        : 1800;
    const currentSession = typeof parsed.currentSession === 'number' ? parsed.currentSession : 1;
    const totalSessions = typeof parsed.totalSessions === 'number' ? parsed.totalSessions : 5;
    const activeTaskId = typeof parsed.activeTaskId === 'string' ? parsed.activeTaskId : null;

    if (parsed.status === 'running' && parsed.targetEndTimeMs) {
      const now = Date.now();
      if (now >= parsed.targetEndTimeMs) {
        // Session expired while app was closed - complete deterministically without double counting
        const sessionMins = Math.round(initialDuration / 60) || 1;
        return {
          timer: {
            status: 'completed',
            initialDurationSeconds: initialDuration,
            remainingSeconds: initialDuration,
            targetEndTimeMs: null,
            currentSession: currentSession < totalSessions ? currentSession + 1 : 1,
            totalSessions,
            activeTaskId,
            lastUpdatedMs: now,
          },
          completedMinutesToAdd: sessionMins,
        };
      } else {
        // Still running - calculate exact drift-resistant remaining seconds
        const remaining = Math.max(0, Math.ceil((parsed.targetEndTimeMs - now) / 1000));
        return {
          timer: {
            status: 'running',
            initialDurationSeconds: initialDuration,
            remainingSeconds: remaining,
            targetEndTimeMs: parsed.targetEndTimeMs,
            currentSession,
            totalSessions,
            activeTaskId,
            lastUpdatedMs: now,
          },
          completedMinutesToAdd: 0,
        };
      }
    } else if (parsed.status === 'paused') {
      const rem =
        typeof parsed.remainingSeconds === 'number' && parsed.remainingSeconds >= 0
          ? parsed.remainingSeconds
          : initialDuration;
      return {
        timer: {
          status: 'paused',
          initialDurationSeconds: initialDuration,
          remainingSeconds: rem,
          targetEndTimeMs: null,
          currentSession,
          totalSessions,
          activeTaskId,
          lastUpdatedMs: Date.now(),
        },
        completedMinutesToAdd: 0,
      };
    } else if (parsed.status === 'completed') {
      return {
        timer: {
          status: 'completed',
          initialDurationSeconds: initialDuration,
          remainingSeconds: initialDuration,
          targetEndTimeMs: null,
          currentSession,
          totalSessions,
          activeTaskId,
          lastUpdatedMs: Date.now(),
        },
        completedMinutesToAdd: 0,
      };
    } else {
      return {
        timer: {
          ...defaultTimer,
          currentSession,
          totalSessions,
          activeTaskId,
        },
        completedMinutesToAdd: 0,
      };
    }
  } catch (err) {
    console.error('Failed to parse timer from storage', err);
    return { timer: defaultTimer, completedMinutesToAdd: 0 };
  }
};

export const saveTimerToStorage = (timer: StoredTimerData): void => {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
  } catch (err) {
    console.error('Failed to save timer to localStorage', err);
  }
};
