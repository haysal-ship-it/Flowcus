import React from 'react';
import { ArrowLeftIcon } from './Icons';
import { WindowWidthMode } from '../types';

interface SettingsViewProps {
  onBackToTasks: () => void;
  windowMode: WindowWidthMode;
  onSetWindowMode: (mode: WindowWidthMode) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBackToTasks,
  windowMode,
  onSetWindowMode,
}) => {
  return (
    <div className="ff-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="ff-btn ff-btn-subtle ff-btn-sm"
          onClick={onBackToTasks}
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Tasks</span>
        </button>
        <span className="ff-meta-row" style={{ fontSize: '12px' }}>
          Settings &amp; Preferences
        </span>
      </div>

      {/* 1. Window & Layout */}
      <div className="ff-settings-group">
        <div className="ff-settings-group-title">Layout &amp; Window</div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Window Layout Preview</div>
            <div className="ff-setting-desc">Switch between 340px companion dock, compact, and expanded window</div>
          </div>
          <div className="ff-segmented-control" role="radiogroup" aria-label="Window layout preview">
            <button
              type="button"
              role="radio"
              aria-checked={windowMode === 'mini340'}
              className={`ff-segmented-btn ${windowMode === 'mini340' ? 'active' : ''}`}
              onClick={() => onSetWindowMode('mini340')}
            >
              340px Mini
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={windowMode === 'window480'}
              className={`ff-segmented-btn ${windowMode === 'window480' ? 'active' : ''}`}
              onClick={() => onSetWindowMode('window480')}
            >
              480px Window
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={windowMode === 'expanded'}
              className={`ff-segmented-btn ${windowMode === 'expanded' ? 'active' : ''}`}
              onClick={() => onSetWindowMode('expanded')}
            >
              Expanded
            </button>
          </div>
        </div>
      </div>

      {/* 2. Focus Intervals */}
      <div className="ff-settings-group">
        <div className="ff-settings-group-title">Focus Intervals</div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Focus Session Duration</div>
            <div className="ff-setting-desc">Default length of a deep work sprint</div>
          </div>
          <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            25 minutes
          </span>
        </div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Short Break</div>
            <div className="ff-setting-desc">Rest period between regular sessions</div>
          </div>
          <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            5 minutes
          </span>
        </div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Auto-start Breaks</div>
            <div className="ff-setting-desc">Automatically transition when focus countdown completes</div>
          </div>
          <label className="ff-toggle" aria-label="Auto-start breaks toggle">
            <input type="checkbox" defaultChecked />
            <span className="ff-toggle-slider" />
          </label>
        </div>
      </div>

      {/* 3. Daily Goals */}
      <div className="ff-settings-group">
        <div className="ff-settings-group-title">Daily Goals</div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Daily Task Target</div>
            <div className="ff-setting-desc">Ideal number of completed tasks per day</div>
          </div>
          <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            5 tasks
          </span>
        </div>

        <div className="ff-setting-row">
          <div>
            <div className="ff-setting-label">Daily Focus Target</div>
            <div className="ff-setting-desc">Target total deep work minutes</div>
          </div>
          <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            100 minutes
          </span>
        </div>
      </div>

      {/* 4. Keyboard Shortcuts */}
      <div className="ff-card ff-card-subtle">
        <div className="ff-card-header" style={{ marginBottom: '8px' }}>
          <span className="ff-card-title">Keyboard Navigation</span>
          <span className="ff-card-subtitle">Quick keys</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Start / Pause Timer</span>
            <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>Space</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Add New Task</span>
            <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>Enter</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Tasks View</span>
            <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>Alt + 1</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Focus View</span>
            <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>Alt + 2</kbd>
          </div>
        </div>
      </div>

      {/* 5. Design System Tokens Spec */}
      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '11px', color: 'var(--text-muted)' }}>
        Flowcus Design System · Dark #0E0E0E · Surfaces #090909 / #1C1C1C · Accent #D05300 · Focus #F18A42
      </div>
    </div>
  );
};
