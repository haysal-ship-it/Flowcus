import React from 'react';

export type FlowcusView = 'tasks' | 'focus';

interface ViewSwitcherProps {
  currentView: FlowcusView;
  onSelectView: (view: FlowcusView) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onSelectView,
}) => {
  return (
    <div
      className="flowcus-view-switcher"
      role="radiogroup"
      aria-label="View Switcher"
    >
      {/* Animated sliding pill indicator (180ms ease, #090909 fill) */}
      <div
        className={`flowcus-switch-pill-slider ${currentView}`}
        aria-hidden="true"
      />

      <button
        type="button"
        role="radio"
        aria-checked={currentView === 'tasks'}
        aria-pressed={currentView === 'tasks'}
        className={`flowcus-switch-opt ${currentView === 'tasks' ? 'active' : ''}`}
        onClick={() => onSelectView('tasks')}
      >
        Tasks
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={currentView === 'focus'}
        aria-pressed={currentView === 'focus'}
        className={`flowcus-switch-opt ${currentView === 'focus' ? 'active' : ''}`}
        onClick={() => onSelectView('focus')}
      >
        Focus
      </button>
    </div>
  );
};
