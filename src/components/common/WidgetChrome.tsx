import React, { useState, useEffect } from 'react';
import { WidgetId } from '../../types';

interface WidgetChromeProps {
  title: string;
  tag?: string;
  widgetId: WidgetId;
  onClose?: () => void;
  onPinChange?: (isPinned: boolean) => void;
  initialPinned?: boolean;
  isPreview?: boolean;
}

export const WidgetChrome: React.FC<WidgetChromeProps> = ({
  title,
  tag,
  widgetId,
  onClose,
  onPinChange,
  initialPinned = false,
  isPreview = false,
}) => {
  const [isPinned, setIsPinned] = useState<boolean>(initialPinned);

  useEffect(() => {
    if (isPreview) return;
    const api = window.electronAPI;
    if (!api) return;

    if (api.getWidgetPinState) {
      api.getWidgetPinState(widgetId).then((pinned: boolean) => {
        setIsPinned(Boolean(pinned));
      }).catch(() => {});
    }

    // Audit 14: Listen for live pin-state broadcasts from Manager and other controls
    if (api.onWidgetStateChange) {
      const unsubscribe = api.onWidgetStateChange((data) => {
        if (data?.pinned && data.pinned[widgetId] !== undefined) {
          setIsPinned(Boolean(data.pinned[widgetId]));
        }
      });
      return () => unsubscribe();
    }
  }, [widgetId, isPreview]);

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    onPinChange?.(next);

    if (!isPreview && typeof window !== 'undefined' && window.electronAPI?.togglePin) {
      window.electronAPI.togglePin(widgetId, next);
    }
  };

  const handleOpenHub = () => {
    if (isPreview) return;
    if (typeof window !== 'undefined' && window.electronAPI?.openMainWindow) {
      window.electronAPI.openMainWindow();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (!isPreview && typeof window !== 'undefined' && window.electronAPI?.closeWidget) {
      window.electronAPI.closeWidget(widgetId);
    }
  };

  return (
    <div
      className="uwidget-chrome-minimal"
      style={{ WebkitAppRegion: isPreview ? 'no-drag' : 'drag' } as any}
    >
      <div className="chrome-minimal-left">
        <span className="chrome-minimal-dot" />
        <span className="chrome-minimal-title">{title}</span>
        {tag && <span className="chrome-minimal-tag">{tag}</span>}
      </div>

      <div className="chrome-minimal-actions" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          type="button"
          className="chrome-icon-btn"
          onClick={handleOpenHub}
          title={isPreview ? 'Manager Hub (Disabled in Preview)' : 'Open Uwidgets Suite Manager'}
          aria-label="Open Uwidgets Suite Manager"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </button>

        <button
          type="button"
          className={`chrome-icon-btn ${isPinned ? 'is-pinned-active' : ''}`}
          onClick={handleTogglePin}
          title={isPinned ? 'Always on Top active. Click to unpin' : 'Pin Always on Top'}
          aria-label={isPinned ? 'Pinned Always-on-Top' : 'Pin Always-on-Top'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned ? '#F18A42' : 'none'} stroke={isPinned ? '#F18A42' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>

        <button
          type="button"
          className="chrome-icon-btn close-btn"
          onClick={handleClose}
          title={isPreview ? 'Close preview' : 'Close widget'}
          aria-label={isPreview ? 'Close preview' : 'Close widget'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
