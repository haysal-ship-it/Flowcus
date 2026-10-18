import React from 'react';
import { FocusFlowLogo, SettingsIcon } from './Icons';
import { ViewMode } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
}) => {
  return (
    <header className="ff-header" role="banner">
      {/* Brand & App Name */}
      <div className="ff-brand">
        <span className="ff-brand-logo">
          <FocusFlowLogo size={18} />
        </span>
        <span>FocusFlow</span>
      </div>

      {/* Tasks / Focus Segmented Control */}
      <nav className="ff-segmented-control" aria-label="Main Navigation">
        <button
          type="button"
          className={`ff-segmented-btn ${currentView === 'tasks' ? 'active' : ''}`}
          onClick={() => onSelectView('tasks')}
          aria-current={currentView === 'tasks' ? 'page' : undefined}
        >
          Tasks
        </button>
        <button
          type="button"
          className={`ff-segmented-btn ${currentView === 'focus' ? 'active' : ''}`}
          onClick={() => onSelectView('focus')}
          aria-current={currentView === 'focus' ? 'page' : undefined}
        >
          Focus
        </button>
      </nav>

      {/* Header Actions: Small Settings Button */}
      <div className="ff-header-actions">
        <button
          type="button"
          className={`ff-btn-settings ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectView('settings')}
          title="Settings"
          aria-label="Settings"
          aria-current={currentView === 'settings' ? 'page' : undefined}
        >
          <SettingsIcon size={14} />
        </button>
      </div>
    </header>
  );
};
