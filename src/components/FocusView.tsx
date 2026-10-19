import React, { useState } from 'react';
import { TaskItem } from '../types';
import { PlayIcon, PauseIcon, RotateCcwIcon, Volume2Icon, VolumeXIcon } from './Icons';
import { StoredTimerData } from '../utils/taskStorage';
import { FlipClock } from './FlipClock';
import { flipAudio } from '../utils/flipAudio';

interface FocusViewProps {
  tasks: TaskItem[];
  timerState: StoredTimerData;
  onStartFocus: () => void;
  onPauseFocus: () => void;
  onResumeFocus: () => void;
  onResetFocus: () => void;
  onSelectActiveTask: (id: string) => void;
  focusedMinutesToday?: number;
}

export const FocusView: React.FC<FocusViewProps> = ({
  tasks,
  timerState,
  onStartFocus,
  onPauseFocus,
  onResumeFocus,
  onResetFocus,
  onSelectActiveTask,
  focusedMinutesToday = 0,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => flipAudio.getMuted());

  // Incomplete tasks available for focus sessions (Section 2.1)
  const eligibleTasks = tasks.filter(t => !t.completed);
  const isFocusEmpty = eligibleTasks.length === 0;

  // Identify active task from eligible incomplete tasks only
  const activeTask = isFocusEmpty
    ? null
    : (timerState.activeTaskId ? eligibleTasks.find(t => t.id === timerState.activeTaskId) : null) ||
      eligibleTasks.find(t => t.inProgress) ||
      eligibleTasks[0] ||
      null;

  const handleCycleTask = () => {
    if (eligibleTasks.length <= 1) return;
    const currentIndex = eligibleTasks.findIndex(t => t.id === activeTask?.id);
    const nextIndex = (currentIndex + 1) % eligibleTasks.length;
    onSelectActiveTask(eligibleTasks[nextIndex].id);
  };

  const handleToggleSound = () => {
    const nextMuted = flipAudio.toggleMuted();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      flipAudio.playRelease();
    }
  };

  // Section 2.3: Session counter display rules:
  // - No eligible task and no active focus session: hide session counter
  // - An eligible task exists but user has not started a session: do not prematurely show Session 1 / 5
  // - Once a session has started (running, paused, completed, or subsequent sessions), show counter
  const hasActiveOrCompletedSession =
    timerState.status === 'running' ||
    timerState.status === 'paused' ||
    timerState.status === 'completed' ||
    timerState.currentSession > 1 ||
    focusedMinutesToday > 0;

  const showSessionCounter = !isFocusEmpty && hasActiveOrCompletedSession;

  // When focus is empty: timer displays exactly 00:00 (Section 2.2)
  const displaySeconds = isFocusEmpty ? 0 : timerState.remainingSeconds;

  const isResetDisabled =
    isFocusEmpty ||
    (timerState.status === 'idle' && timerState.remainingSeconds === timerState.initialDurationSeconds);

  return (
    <div className="flowcus-focus-view">
      {/* 1. Heading Row: "Focus Session" on left, sound toggle & conditional session counter on right */}
      <div className="flowcus-focus-header-row">
        <h2 className="flowcus-heading-focus">Focus Session</h2>
        <div className="flowcus-focus-header-meta">
          <button
            type="button"
            className="flowcus-sound-toggle-btn"
            onClick={handleToggleSound}
            title={isMuted ? 'Unmute mechanical click sounds' : 'Mute mechanical click sounds'}
            aria-label={isMuted ? 'Mechanical flip sound muted. Click to unmute' : 'Mechanical flip sound active. Click to mute'}
          >
            {isMuted ? <VolumeXIcon size={14} /> : <Volume2Icon size={14} />}
          </button>
          {showSessionCounter && (
            <span className="flowcus-session-counter tabular-nums">
              Session {timerState.currentSession} / {timerState.totalSessions}
            </span>
          )}
        </div>
      </div>

      {/* 2. Large Centered Split-Flap Flip Clock Timer (Displays exactly 00:00 in empty state) */}
      <div className="flowcus-timer-region">
        <FlipClock
          remainingSeconds={displaySeconds}
          animate={!isFocusEmpty && (timerState.status === 'running' || timerState.status === 'idle')}
        />
      </div>

      {/* 3. Active task beneath timer */}
      {activeTask ? (
        <button
          type="button"
          className="flowcus-focus-active-task-green"
          title={`Active task: ${activeTask.title} (Click to switch)`}
          onClick={handleCycleTask}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: eligibleTasks.length > 1 ? 'pointer' : 'default',
          }}
        >
          Active: {activeTask.title}
        </button>
      ) : (
        <span className="flowcus-focus-active-task-muted" aria-label="No active task">
          No active task
        </span>
      )}

      {/* 4. Subtle thin horizontal divider */}
      <div className="flowcus-focus-divider" role="separator" />

      {/* 5. Focus controls: Start Focus (disabled in empty state) + Repeat/Reset (disabled in empty state) */}
      <div className="flowcus-focus-controls-row">
        {isFocusEmpty ? (
          <button
            type="button"
            className="flowcus-focus-white-pill-btn disabled"
            disabled
            aria-disabled="true"
            title="No incomplete tasks available for focus"
          >
            <PlayIcon size={15} />
            <span>Start focus</span>
          </button>
        ) : timerState.status === 'running' ? (
          <button
            type="button"
            className="flowcus-focus-white-pill-btn"
            onClick={onPauseFocus}
            aria-label="Pause focus timer"
          >
            <PauseIcon size={15} />
            <span>Pause</span>
          </button>
        ) : timerState.status === 'paused' ? (
          <button
            type="button"
            className="flowcus-focus-white-pill-btn"
            onClick={onResumeFocus}
            aria-label="Resume focus timer"
          >
            <PlayIcon size={15} />
            <span>Resume</span>
          </button>
        ) : (
          <button
            type="button"
            className="flowcus-focus-white-pill-btn"
            onClick={onStartFocus}
            aria-label="Start focus session"
          >
            <PlayIcon size={15} />
            <span>Start focus</span>
          </button>
        )}

        <button
          type="button"
          className={`flowcus-focus-reset-circle-btn ${isResetDisabled ? 'disabled' : ''}`}
          onClick={isResetDisabled ? undefined : onResetFocus}
          disabled={isResetDisabled}
          aria-disabled={isResetDisabled}
          title={isResetDisabled ? 'Reset unavailable' : 'Reset session'}
          aria-label={isResetDisabled ? 'Reset unavailable' : 'Reset session'}
        >
          <RotateCcwIcon size={16} />
        </button>
      </div>
    </div>
  );
};
