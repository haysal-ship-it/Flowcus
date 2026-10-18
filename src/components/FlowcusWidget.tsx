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
} from '../utils/taskStorage';
import { DailyProgress } from './DailyProgress';
import { ViewSwitcher, FlowcusView } from './ViewSwitcher';
import { TasksView } from './TasksView';
import { FocusView } from './FocusView';

export type ReferenceState = 'tasks-default' | 'add-task' | 'focus-idle' | 'focus-running';

interface FlowcusWidgetProps {
  activeReferenceState?: ReferenceState;
  onChangeReferenceState?: (state: ReferenceState) => void;
}

export const getActiveTask = (allTasks: TaskItem[], activeTaskId: string | null): TaskItem | null => {
  if (activeTaskId) {
    const found = allTasks.find(t => t.id === activeTaskId);
    if (found) return found;
  }
  return allTasks.find(t => t.inProgress) || allTasks.find(t => !t.completed) || allTasks[0] || null;
};

export const getTaskDurationSeconds = (task: TaskItem | null | undefined): number => {
  if (!task) return 1800; // 30 minutes default
  return taskDurationToSeconds(task.durationEst);
};

export const FlowcusWidget: React.FC<FlowcusWidgetProps> = ({
  activeReferenceState,
  onChangeReferenceState,
}) => {
  const [currentView, setCurrentView] = useState<FlowcusView>('tasks');
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasksFromStorage());
  const [justAddedTaskId, setJustAddedTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // Initial load of timer and focused minutes with deterministic recovery
  const [timerState, setTimerState] = useState<StoredTimerData>(() => {
    const { timer } = loadTimerFromStorage();
    return timer;
  });

  const [focusedMinutes, setFocusedMinutes] = useState<number>(() => {
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

  // Save tasks to local storage
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  // Save timer to local storage on changes
  useEffect(() => {
    saveTimerToStorage(timerState);
  }, [timerState]);

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

  // Synchronize idle timer duration with the active task's duration
  useEffect(() => {
    if (timerState.status === 'idle') {
      const active = getActiveTask(tasks, timerState.activeTaskId);
      const activeSecs = getTaskDurationSeconds(active);
      if (timerState.initialDurationSeconds !== activeSecs || timerState.remainingSeconds !== activeSecs) {
        setTimerState(curr => ({
          ...curr,
          initialDurationSeconds: activeSecs,
          remainingSeconds: activeSecs,
        }));
      }
    }
  }, [tasks, timerState.activeTaskId, timerState.status]);

  // Drift-resistant timer interval calculation
  useEffect(() => {
    if (timerState.status !== 'running' || !timerState.targetEndTimeMs) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diffMs = timerState.targetEndTimeMs! - now;

      if (diffMs <= 0) {
        // Session successfully completed!
        const sessionMins = Math.round(timerState.initialDurationSeconds / 60) || 1;
        setFocusedMinutes(prevMins => {
          const nextMins = prevMins + sessionMins;
          saveFocusMinutesToday(nextMins);
          return nextMins;
        });

        const nextSession =
          timerState.currentSession < timerState.totalSessions
            ? timerState.currentSession + 1
            : 1;

        const nextTimer: StoredTimerData = {
          ...timerState,
          status: 'completed',
          remainingSeconds: timerState.initialDurationSeconds,
          targetEndTimeMs: null,
          currentSession: nextSession,
          lastUpdatedMs: now,
        };

        setTimerState(nextTimer);
        saveTimerToStorage(nextTimer);
        setAnnouncement('Focus session completed! Daily progress updated.');
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
  }, [timerState.status, timerState.targetEndTimeMs, timerState.initialDurationSeconds, timerState.currentSession, timerState.totalSessions]);

  // Filter tasks for today
  const todayTasks = tasks.filter(t => t.targetDate === todayDateString);
  const totalTodayTasks = todayTasks.length;
  const completedTodayTasks = todayTasks.filter(t => t.completed).length;

  // Task actions
  const handleToggleComplete = (id: string) => {
    setTasks(prev => {
      let clearedActive = false;
      const updated = prev.map(task => {
        if (task.id === id) {
          const nextCompleted = !task.completed;
          // Prevent completed task from remaining active focus task unless explicitly selected again
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

      if (clearedActive) {
        // Find next incomplete candidate
        const nextCandidate = updated.find(t => !t.completed);
        const nextActiveId = nextCandidate ? nextCandidate.id : null;
        const nextSecs = getTaskDurationSeconds(nextCandidate);
        setTimerState(curr => ({
          ...curr,
          activeTaskId: nextActiveId,
          ...(curr.status === 'idle' || curr.status === 'completed'
            ? { initialDurationSeconds: nextSecs, remainingSeconds: nextSecs, targetEndTimeMs: null }
            : { initialDurationSeconds: nextSecs }),
        }));
      }

      return updated;
    });
  };

  const handleAddTask = (title: string, duration?: string) => {
    const validDuration = normalizeTaskDuration(duration || '30m');
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title,
      completed: false,
      durationEst: validDuration,
      inProgress: false,
      targetDate: todayDateString,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]); // Append task preserving existing order
    setJustAddedTaskId(newTask.id);
    setIsAddFormOpen(false);
    setAnnouncement(`Task "${title}" added to list.`);

    setTimeout(() => {
      setJustAddedTaskId(null);
    }, 300);
  };

  const handleDeleteTask = (id: string) => {
    const target = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));
    if (target) {
      setAnnouncement(`Task "${target.title}" deleted.`);
    }
  };

  const handleEditTask = (id: string, newTitle: string, newDuration?: string) => {
    const validDuration = newDuration ? normalizeTaskDuration(newDuration) : undefined;
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
    const now = Date.now();
    const active = getActiveTask(tasks, timerState.activeTaskId);
    const taskSeconds = getTaskDurationSeconds(active);

    // If starting fresh (idle or completed, or remainingSeconds <= 0), start full task countdown
    const duration =
      timerState.status === 'idle' || timerState.status === 'completed' || timerState.remainingSeconds <= 0
        ? taskSeconds
        : timerState.remainingSeconds;

    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'running',
      initialDurationSeconds: taskSeconds,
      remainingSeconds: duration,
      targetEndTimeMs: now + duration * 1000,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session started.');
  };

  const handlePauseFocus = () => {
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
    saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session paused.');
  };

  const handleResumeFocus = () => {
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
    saveTimerToStorage(nextTimer);
    setAnnouncement('Focus session resumed.');
  };

  const handleResetFocus = () => {
    const now = Date.now();
    const active = getActiveTask(tasks, timerState.activeTaskId);
    const taskSeconds = getTaskDurationSeconds(active);
    const nextTimer: StoredTimerData = {
      ...timerState,
      status: 'idle',
      initialDurationSeconds: taskSeconds,
      remainingSeconds: taskSeconds,
      targetEndTimeMs: null,
      lastUpdatedMs: now,
    };
    setTimerState(nextTimer);
    saveTimerToStorage(nextTimer);
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

  const handleToggleAddForm = () => {
    const nextOpen = !isAddFormOpen;
    setIsAddFormOpen(nextOpen);
    if (onChangeReferenceState) {
      onChangeReferenceState(nextOpen ? 'add-task' : 'tasks-default');
    }
  };

  return (
    <div className="flowcus-shell-container">
      {/* Polite live accessibility announcement region */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Surface 1: Daily Progress Panel (~410 x 144px, 22px radius, shared between tabs) */}
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
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
