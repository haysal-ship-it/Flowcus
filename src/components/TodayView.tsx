import React, { useState, useEffect, useRef } from 'react';
import {
  PlusIcon,
  CheckIcon,
  PlayIcon,
  RotateCcwIcon,
  ClockIcon,
  EditIcon,
  TrashIcon,
  UndoIcon,
  TargetIcon,
} from './Icons';
import { TaskItem } from '../types';
import {
  getLocalTodayDateString,
  getFormattedTodayDate,
  loadTasksFromStorage,
  saveTasksToStorage,
  getFocusMinutesToday,
} from '../utils/taskStorage';

interface TodayViewProps {
  onOpenFocusView: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ onOpenFocusView }) => {
  // Local persistence for tasks
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasksFromStorage());
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('25m');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [lastDeletedTask, setLastDeletedTask] = useState<{ task: TaskItem; index: number } | null>(null);
  const [justAddedTaskId, setJustAddedTaskId] = useState<string | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  const todayDateString = getLocalTodayDateString();
  const formattedDate = getFormattedTodayDate();
  const focusedMinutesToday = getFocusMinutesToday();

  // Save tasks to local storage whenever tasks state changes
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  // Clean up undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Filter tasks belonging to today's date (or uncompleted tasks targeted for today)
  // Historical tasks from previous dates remain in storage and are never silently deleted
  const todayTasks = tasks.filter(t => t.targetDate === todayDateString);

  // Derive progress strictly from actual tasks for the current local date
  const totalTodayTasks = todayTasks.length;
  const completedTodayTasks = todayTasks.filter(t => t.completed).length;
  const progressPercent = totalTodayTasks === 0 ? 0 : Math.round((completedTodayTasks / totalTodayTasks) * 100);

  // 36 segments for the horizontal progress indicator
  const TOTAL_SEGMENTS = 36;
  const filledSegments = totalTodayTasks === 0
    ? 0
    : Math.min(
        TOTAL_SEGMENTS,
        completedTodayTasks === totalTodayTasks
          ? TOTAL_SEGMENTS
          : Math.max(
              completedTodayTasks > 0 ? 1 : 0,
              Math.round((completedTodayTasks / totalTodayTasks) * TOTAL_SEGMENTS)
            )
      );

  // Current active task in focus
  const activeFocusTask = tasks.find(t => t.inProgress) || todayTasks.find(t => !t.completed);

  // Handlers
  const toggleTaskCompletion = (id: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id === id) {
          const nextCompleted = !task.completed;
          return {
            ...task,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return task;
      })
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskInput.trim();
    if (!trimmed) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: trimmed,
      completed: false,
      durationEst: newTaskDuration,
      category: 'General',
      inProgress: tasks.length === 0, // auto-select first task if none exists
      targetDate: todayDateString,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);
    setJustAddedTaskId(newTask.id);
    setNewTaskInput('');

    // Clear entrance highlight after animation completes
    setTimeout(() => {
      setJustAddedTaskId(null);
    }, 300);
  };

  const handleDeleteTask = (id: string) => {
    const taskIndex = tasks.findIndex(t => t.id === id);
    const taskToDelete = tasks[taskIndex];
    if (!taskToDelete) return;

    setTasks(prev => prev.filter(t => t.id !== id));
    setLastDeletedTask({ task: taskToDelete, index: taskIndex });

    // Set auto-dismiss for undo banner after 5 seconds
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
    }
    undoTimeoutRef.current = window.setTimeout(() => {
      setLastDeletedTask(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!lastDeletedTask) return;
    setTasks(prev => {
      const copy = [...prev];
      copy.splice(lastDeletedTask.index, 0, lastDeletedTask.task);
      return copy;
    });
    setLastDeletedTask(null);
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
    }
  };

  const handleSetInFocus = (id: string) => {
    setTasks(prev =>
      prev.map(task => ({
        ...task,
        inProgress: task.id === id ? !task.inProgress : false,
      }))
    );
  };

  const startEditing = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEditing = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setTasks(prev =>
        prev.map(t => (t.id === id ? { ...t, title: trimmed } : t))
      );
    }
    setEditingTaskId(null);
    setEditingTitle('');
  };

  return (
    <div className="ff-today-grid ff-view-enter">
      {/* 1. DAILY PROGRESS PANEL */}
      <section className="ff-card" aria-labelledby="daily-progress-heading">
        <div className="ff-card-header" style={{ marginBottom: '6px' }}>
          <div>
            <h2 id="daily-progress-heading" className="ff-card-title">Daily Progress</h2>
            <div className="ff-card-subtitle">Keep momentum with calm, steady focus.</div>
          </div>
          <div className="ff-meta-row tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* 36-Segment Horizontal Progress Indicator */}
        <div
          className="ff-segmented-progress-track"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily progress: ${progressPercent} percent completed`}
        >
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, index) => (
            <div
              key={index}
              className={`ff-progress-segment ${index < filledSegments ? 'filled' : ''}`}
            />
          ))}
        </div>

        {/* Supporting Progress Metadata */}
        <div className="ff-meta-row" style={{ marginTop: '8px', fontSize: '11.5px' }}>
          <span className="tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
            {completedTodayTasks} / {totalTodayTasks} tasks completed
          </span>
          <span className="ff-meta-sep">·</span>
          <span className="tabular-nums">{focusedMinutesToday} min focused today</span>
          {totalTodayTasks > 0 && completedTodayTasks === totalTodayTasks && (
            <>
              <span className="ff-meta-sep">·</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>All completed!</span>
            </>
          )}
        </div>
      </section>

      {/* 2-Column (Expanded) or Stacked (340px) Layout */}
      <div className="ff-today-columns">
        {/* Left Column: Tasks Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Add Task Input & Duration Estimate Bar */}
          <section className="ff-card" aria-label="Add task for today">
            <form onSubmit={handleAddTask} className="ff-input-group">
              <input
                type="text"
                className="ff-input"
                placeholder="Add a task for today... (Press Enter)"
                value={newTaskInput}
                onChange={e => setNewTaskInput(e.target.value)}
                aria-label="New task title"
              />

              {/* Estimate selector (distinct from focus timer session) */}
              <select
                value={newTaskDuration}
                onChange={e => setNewTaskDuration(e.target.value)}
                aria-label="Estimated task duration"
                className="ff-input"
                style={{ width: '80px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                <option value="15m">15m</option>
                <option value="25m">25m</option>
                <option value="45m">45m</option>
                <option value="60m">60m</option>
              </select>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                title="Add task to today"
                aria-label="Add task to today"
              >
                <PlusIcon size={14} />
                <span>Add</span>
              </button>
            </form>
          </section>

          {/* Today's Tasks List */}
          <section className="ff-card" aria-labelledby="tasks-heading">
            <div className="ff-card-header" style={{ paddingBottom: '4px' }}>
              <div>
                <h2 id="tasks-heading" className="ff-card-title">Today's Tasks</h2>
                <div className="ff-card-subtitle">{formattedDate}</div>
              </div>
              <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {completedTodayTasks} of {totalTodayTasks} done
              </span>
            </div>

            {/* Undo Notification Banner */}
            {lastDeletedTask && (
              <div className="ff-undo-banner" role="status" aria-live="polite">
                <span>Task removed</span>
                <button
                  type="button"
                  className="ff-undo-btn"
                  onClick={handleUndoDelete}
                  title="Undo task deletion"
                >
                  <UndoIcon size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Undo
                </button>
              </div>
            )}

            {/* Tasks Container */}
            <div role="list" aria-label="Today's task list" style={{ marginTop: '8px' }}>
              {todayTasks.length === 0 ? (
                /* Empty state */
                <div className="ff-empty-state">
                  <div style={{ color: 'var(--text-muted)' }}>No tasks for today yet.</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Add your first task above to start your flow.
                  </div>
                </div>
              ) : (
                /* Populated / Partial / Completed states */
                todayTasks.map(task => {
                  const isEditing = editingTaskId === task.id;
                  const isJustAdded = justAddedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      role="listitem"
                      className={`ff-task-item ${task.completed ? 'completed' : ''} ${task.inProgress ? 'is-focus-selected' : ''} ${isJustAdded ? 'ff-task-item-enter' : ''}`}
                    >
                      <div className="ff-task-left">
                        {/* Checkbox */}
                        <button
                          type="button"
                          className={`ff-checkbox ${task.completed ? 'checked' : ''}`}
                          onClick={() => toggleTaskCompletion(task.id)}
                          aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'completed'}`}
                          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {task.completed && <CheckIcon size={12} strokeWidth={3} />}
                        </button>

                        {/* Title & Metadata or Edit Form */}
                        <div className="ff-task-body">
                          {isEditing ? (
                            <form
                              className="ff-task-edit-form"
                              onSubmit={e => {
                                e.preventDefault();
                                saveEditing(task.id);
                              }}
                            >
                              <input
                                type="text"
                                className="ff-task-edit-input"
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                autoFocus
                                onBlur={() => saveEditing(task.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') setEditingTaskId(null);
                                }}
                              />
                            </form>
                          ) : (
                            <>
                              <div className="ff-task-label" title={task.title}>
                                {task.title}
                              </div>
                              <div className="ff-task-meta">
                                <span className="tabular-nums">{task.durationEst}</span>
                                {task.category && (
                                  <>
                                    <span className="ff-meta-sep">·</span>
                                    <span>{task.category}</span>
                                  </>
                                )}
                                {task.inProgress && (
                                  <>
                                    <span className="ff-meta-sep">·</span>
                                    <span className="ff-badge-focus">
                                      <TargetIcon size={11} strokeWidth={2.5} />
                                      In Focus
                                    </span>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Accessible Task Actions (In-Focus, Edit, Delete) */}
                      {!isEditing && (
                        <div className="ff-task-actions">
                          <button
                            type="button"
                            className={`ff-task-action-btn ${task.inProgress ? 'active-focus' : ''}`}
                            onClick={() => handleSetInFocus(task.id)}
                            title={task.inProgress ? 'Remove from focus' : 'Set as active focus task'}
                            aria-label={task.inProgress ? 'Remove from focus' : 'Set as active focus task'}
                          >
                            <TargetIcon size={13} />
                          </button>

                          <button
                            type="button"
                            className="ff-task-action-btn"
                            onClick={() => startEditing(task)}
                            title="Edit task"
                            aria-label={`Edit task "${task.title}"`}
                          >
                            <EditIcon size={12} />
                          </button>

                          <button
                            type="button"
                            className="ff-task-action-btn delete"
                            onClick={() => handleDeleteTask(task.id)}
                            title="Delete task"
                            aria-label={`Delete task "${task.title}"`}
                          >
                            <TrashIcon size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Focus Timer Preview Card */}
        <div>
          <section className="ff-card" aria-labelledby="timer-heading">
            <div className="ff-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClockIcon size={15} />
                <h2 id="timer-heading" className="ff-card-title">Focus Session</h2>
              </div>
              <span className="ff-card-subtitle">Session 2 of 4</span>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 0 16px 0' }}>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '40px',
                  fontWeight: 300,
                  letterSpacing: '-0.03em',
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  margin: '8px 0',
                }}
              >
                25:00
              </div>
              <div
                className="ff-card-subtitle"
                style={{
                  marginTop: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 8px',
                }}
                title={activeFocusTask ? activeFocusTask.title : 'No task selected'}
              >
                Active: {activeFocusTask ? activeFocusTask.title : 'Select a task to focus on'}
              </div>
            </div>

            {/* Timer Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                className="ff-btn ff-btn-primary"
                style={{ flex: 1 }}
                onClick={onOpenFocusView}
              >
                <PlayIcon size={12} />
                <span>Start Focus</span>
              </button>
              <button
                type="button"
                className="ff-btn ff-btn-secondary"
                title="Reset session timer"
                aria-label="Reset session timer"
              >
                <RotateCcwIcon size={13} />
              </button>
            </div>

            <button
              type="button"
              className="ff-btn ff-btn-subtle"
              style={{ width: '100%', marginTop: '10px', fontSize: '12px' }}
              onClick={onOpenFocusView}
            >
              Open Immersive Focus View &rarr;
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
