import React from 'react';
import { ManagerTab } from '../../types';

interface ManagerSidebarProps {
  currentTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  openCount: number;
  pinnedCount: number;
}

export const ManagerSidebar: React.FC<ManagerSidebarProps> = ({
  currentTab,
  onSelectTab,
  openCount,
  pinnedCount,
}) => {
  return (
    <aside className="manager-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-section">
        <div className="sidebar-logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">
            <span>Uwidgets</span>
            <span className="sidebar-brand-badge">Pro</span>
          </div>
          <span className="sidebar-brand-desc">Desktop Widgets Suite</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`sidebar-nav-item ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => onSelectTab('home')}
        >
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="nav-label">Home</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-item ${currentTab === 'widgets' ? 'active' : ''}`}
          onClick={() => onSelectTab('widgets')}
        >
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          <span className="nav-label">Widgets</span>
          <span className="nav-counter">3</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-item ${currentTab === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectTab('favorites')}
        >
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="nav-label">Favorites</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-item ${currentTab === 'customize' ? 'active' : ''}`}
          onClick={() => onSelectTab('customize')}
        >
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span className="nav-label">Customize</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      {/* Bottom Desktop Status Card */}
      <div className="sidebar-status-card">
        <div className="status-indicator-row">
          <span className={`status-dot ${openCount > 0 ? 'online' : ''}`} />
          <span className="status-title">Desktop Gadgets</span>
        </div>
        <p className="status-subtitle">
          {openCount === 0
            ? 'No widgets pinned to desktop'
            : `${openCount} active (${pinnedCount} pinned)`}
        </p>
      </div>
    </aside>
  );
};
