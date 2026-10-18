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
}

export const FocusView: React.FC<FocusViewProps> = ({
  tasks,
  timerState,
  onStartFocus,
  onPauseFocus,
  onResumeFocus,
  onResetFocus,
  onSelectActiveTask,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(() => flipAudio.getMuted());

  // Identify the active task from timerState or task flags
  const activeTask =
    (timerState.activeTaskId ? tasks.find(t => t.id === timerState.activeTaskId) : null) ||
    tasks.find(t => t.inProgress) ||
    tasks.find(t => !t.completed) ||
    tasks[0];

  const handleCycleTask = () => {
    const uncompletedTasks = tasks.filter(t => !t.completed);
    if (uncompletedTasks.length === 0) return;
    const currentIndex = uncompletedTasks.findIndex(t => t.id === activeTask?.id);
    const nextIndex = (currentIndex + 1) % uncompletedTasks.length;
    onSelectActiveTask(uncompletedTasks[nextIndex].id);
  };

  const handleToggleSound = () => {
    const nextMuted = flipAudio.toggleMuted();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      // Play a quick tactile click to confirm sound is active
      flipAudio.playRelease();
    }
  };

  const activeTaskTitle = activeTask ? activeTask.title : 'Update solime design system';

  return (
    <div className="flowcus-focus-view">
      {/* 1. Heading Row: "Focus Session" on left, "Session 2 / 5" and sound toggle on far right */}
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
          <span className="flowcus-session-counter tabular-nums">
            Session {timerState.currentSession} / {timerState.totalSessions}
          </span>
        </div>
      </div>

      {/* 2. Large Centered Split-Flap Flip Clock Timer */}
      <div className="flowcus-timer-region">
        <FlipClock
          remainingSeconds={timerState.remainingSeconds}
          animate={timerState.status === 'running' || timerState.status === 'idle'}
        />
      </div>

      {/* 3. Active task in green beneath the timer: "Active: Update solime design system" */}
      <button
        type="button"
        className="flowcus-focus-active-task-green"
        title={`Active task: ${activeTaskTitle} (Click to switch)`}
        onClick={handleCycleTask}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: tasks.length > 1 ? 'pointer' : 'default',
        }}
      >
        Active: {activeTaskTitle}
      </button>

      {/* 4. Subtle thin horizontal divider */}
      <div className="flowcus-focus-divider" role="separator" />

      {/* 5. Focus controls: Wide white pill button (~40px) with dark icon/label + 40x40px circular dark reset button */}
      <div className="flowcus-focus-controls-row">
        {timerState.status === 'running' ? (
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
          className="flowcus-focus-reset-circle-btn"
          onClick={onResetFocus}
          title="Reset session"
          aria-label="Reset session"
        >
          <RotateCcwIcon size={16} />
        </button>
      </div>
    </div>
  );
};
