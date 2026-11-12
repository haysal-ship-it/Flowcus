import React, { useState, useEffect } from 'react';
import { ManagerTab, WidgetMeta, WidgetId } from '../../types';
import { WIDGETS_CATALOG } from '../../utils/widgetsCatalog';
import { ManagerSidebar } from './ManagerSidebar';
import { ManagerHome } from './ManagerHome';
import { ManagerCatalog } from './ManagerCatalog';
import { ManagerFavorites } from './ManagerFavorites';
import { ManagerCustomize } from './ManagerCustomize';
import { ManagerSettings } from './ManagerSettings';
import { WidgetDetailModal } from './WidgetDetailModal';

export const UwidgetsManager: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<ManagerTab>('home');
  const [inspectingWidget, setInspectingWidget] = useState<WidgetMeta | null>(null);

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({
    flowcus: false,
    playz: false,
    stickk: false,
  });

  const [pinnedStates, setPinnedStates] = useState<Record<string, boolean>>({
    flowcus: false,
    playz: false,
    stickk: false,
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('uwidgets_favorites');
      return stored ? JSON.parse(stored) : ['flowcus', 'stickk'];
    } catch {
      return ['flowcus', 'stickk'];
    }
  });

  const [managerError, setManagerError] = useState<string | null>(null);

  // Sync state from Electron main process
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getWidgetStates) {
      window.electronAPI.getWidgetStates().then((res) => {
        if (res) setOpenStates(res);
      }).catch(() => {});
    }

    if (typeof window !== 'undefined' && window.electronAPI?.onWidgetStateChange) {
      const unsubscribe = window.electronAPI.onWidgetStateChange((data) => {
        if (data?.open) setOpenStates(data.open);
        if (data?.pinned) setPinnedStates(data.pinned);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      try {
        localStorage.setItem('uwidgets_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleDesktop = async (widgetId: string) => {
    const isOpen = Boolean(openStates[widgetId]);
    setManagerError(null);
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        if (isOpen) {
          const res = await window.electronAPI.closeWidget(widgetId);
          if (res?.success) {
            setOpenStates(prev => ({ ...prev, [widgetId]: false }));
          } else {
            setManagerError(`Failed to close ${widgetId}`);
          }
        } else {
          const res = await window.electronAPI.openWidget(widgetId);
          if (res?.success) {
            setOpenStates(prev => ({ ...prev, [widgetId]: true }));
          } else {
            setManagerError(`Failed to open ${widgetId}`);
          }
        }
      } catch (err: unknown) {
        setManagerError(`Action failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      // Browser fallback demo
      setOpenStates(prev => ({ ...prev, [widgetId]: !isOpen }));
    }
  };

  const handleTogglePin = async (widgetId: string) => {
    const isPinned = Boolean(pinnedStates[widgetId]);
    const next = !isPinned;
    setManagerError(null);

    if (typeof window !== 'undefined' && window.electronAPI?.togglePin) {
      try {
        const res = await window.electronAPI.togglePin(widgetId, next);
        if (res?.success) {
          setPinnedStates(prev => ({ ...prev, [widgetId]: next }));
        } else {
          setManagerError(`Failed to update pin state for ${widgetId}`);
        }
      } catch (err: unknown) {
        setManagerError(`Pin action failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      setPinnedStates(prev => ({ ...prev, [widgetId]: next }));
    }
  };

  const handleRemoveAllWidgets = async () => {
    setManagerError(null);
    if (typeof window !== 'undefined' && window.electronAPI?.removeAllWidgets) {
      try {
        const res = await window.electronAPI.removeAllWidgets();
        if (res?.success) {
          setOpenStates({ flowcus: false, playz: false, stickk: false });
        } else {
          setManagerError('Failed to close all widgets');
        }
      } catch (err: unknown) {
        setManagerError(`Failed to close widgets: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      setOpenStates({ flowcus: false, playz: false, stickk: false });
    }
  };

  const openCount = Object.values(openStates).filter(Boolean).length;
  const pinnedCount = Object.values(pinnedStates).filter(Boolean).length;

  return (
    <div className="uwidgets-manager-app">
      {/* Window Titlebar (Clean single bar, OS caption controls handle minimize/maximize/close) */}
      <div className="manager-titlebar" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="titlebar-left">
          <div className="titlebar-logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
            </svg>
          </div>
          <span className="titlebar-title">Uwidgets</span>
          <span className="titlebar-version">v1.0</span>
        </div>
      </div>

      {managerError && (
        <div
          role="alert"
          style={{
            background: 'rgba(255, 82, 82, 0.15)',
            border: '1px solid rgba(255, 82, 82, 0.4)',
            color: '#ff5252',
            padding: '6px 14px',
            fontSize: '12px',
            margin: '8px 16px 0 16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠ {managerError}</span>
          <button
            type="button"
            onClick={() => setManagerError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff5252',
              cursor: 'pointer',
              fontWeight: 'bold',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="manager-workspace-body">
        {/* Left Navigation Sidebar */}
        <ManagerSidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          openCount={openCount}
          pinnedCount={pinnedCount}
        />

        {/* Right Content View Area */}
        <main className="manager-main-content">
          {currentTab === 'home' && (
            <ManagerHome
              onInspectWidget={setInspectingWidget}
              openStates={openStates}
              pinnedStates={pinnedStates}
              onToggleDesktop={handleToggleDesktop}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {currentTab === 'widgets' && (
            <ManagerCatalog
              onInspectWidget={setInspectingWidget}
              openStates={openStates}
              onToggleDesktop={handleToggleDesktop}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {currentTab === 'favorites' && (
            <ManagerFavorites
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onInspectWidget={setInspectingWidget}
              openStates={openStates}
              onToggleDesktop={handleToggleDesktop}
            />
          )}

          {currentTab === 'customize' && (
            <ManagerCustomize />
          )}

          {currentTab === 'settings' && (
            <ManagerSettings
              onRemoveAllWidgets={handleRemoveAllWidgets}
              openCount={openCount}
            />
          )}
        </main>
      </div>

      {/* Widget Detail Inspection Modal (Screenshot 2) */}
      <WidgetDetailModal
        widget={inspectingWidget}
        isOpen={Boolean(inspectingWidget)}
        isDesktopOpen={inspectingWidget ? Boolean(openStates[inspectingWidget.id]) : false}
        isPinned={inspectingWidget ? Boolean(pinnedStates[inspectingWidget.id]) : false}
        onClose={() => setInspectingWidget(null)}
        onToggleDesktop={handleToggleDesktop}
        onTogglePin={handleTogglePin}
      />
    </div>
  );
};
