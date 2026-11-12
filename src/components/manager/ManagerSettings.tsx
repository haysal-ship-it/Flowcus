import React, { useState, useEffect } from 'react';

interface ManagerSettingsProps {
  onRemoveAllWidgets: () => void;
  openCount: number;
}

export const ManagerSettings: React.FC<ManagerSettingsProps> = ({
  onRemoveAllWidgets,
  openCount,
}) => {
  const [startWithWindows, setStartWithWindows] = useState<boolean>(false);
  const [closeToTray, setCloseToTray] = useState<boolean>(true);
  const [startMinimized, setStartMinimized] = useState<boolean>(false);
  const [alwaysOnTopDefault, setAlwaysOnTopDefault] = useState<boolean>(true);
  const [soundEffects, setSoundEffects] = useState<boolean>(true);
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [savedBanner, setSavedBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then((res) => {
        if (res) {
          if (res.startWithWindows !== undefined) setStartWithWindows(res.startWithWindows);
          if (res.closeToTray !== undefined) setCloseToTray(res.closeToTray);
          if (res.startMinimized !== undefined) setStartMinimized(res.startMinimized);
          if (res.alwaysOnTopDefault !== undefined) setAlwaysOnTopDefault(res.alwaysOnTopDefault);
          if (res.soundEnabled !== undefined) setSoundEffects(res.soundEnabled);
          if (res.scaleFactor !== undefined) setScaleFactor(res.scaleFactor);
        }
      }).catch(() => {});
    }
  }, []);

  const notifySaved = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(''), 2500);
  };

  const handleToggle = async (key: string, val: boolean, setter: (v: boolean) => void) => {
    setPendingKey(key);
    setErrorBanner('');
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveSetting) {
        const res = await window.electronAPI.saveSetting(key, val);
        if (res?.success) {
          setter(val);
          notifySaved('Setting updated');
        } else {
          setErrorBanner(`Failed to update ${key}. Reverted.`);
        }
      } else {
        setter(val);
        notifySaved('Setting updated');
      }
    } catch (err: unknown) {
      setErrorBanner(`Failed to update ${key}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingKey(null);
    }
  };

  const handleScaleChange = async (val: number) => {
    setPendingKey('scaleFactor');
    setErrorBanner('');
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveSetting) {
        const res = await window.electronAPI.saveSetting('scaleFactor', val);
        if (res?.success) {
          setScaleFactor(val);
          notifySaved(`Scale set to ${Math.round(val * 100)}%`);
        } else {
          setErrorBanner('Failed to update scale factor');
        }
      } else {
        setScaleFactor(val);
        notifySaved(`Scale set to ${Math.round(val * 100)}%`);
      }
    } catch (err: unknown) {
      setErrorBanner(`Failed to update scale factor: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingKey(null);
    }
  };

  const handleResetPositions = async () => {
    setIsResetting(true);
    setErrorBanner('');
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.resetWidgetPositions) {
        const res = await window.electronAPI.resetWidgetPositions();
        if (res?.success) {
          notifySaved('Widget positions reset to primary display');
        } else {
          setErrorBanner('Failed to reset widget positions');
        }
      } else {
        notifySaved('Positions reset');
      }
    } catch (err: any) {
      setErrorBanner(`Failed to reset positions: ${err?.message || err}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="manager-settings-view">
      {/* Settings Header */}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Configure desktop widget behavior, startup preferences, and display scaling.</p>
        {savedBanner && (
          <div className="settings-save-pill" role="status">
            ✓ {savedBanner}
          </div>
        )}
        {errorBanner && (
          <div className="settings-error-pill" role="alert" style={{ color: '#ff5252', marginTop: '6px', fontSize: '13px' }}>
            ⚠ {errorBanner}
          </div>
        )}
      </div>

      {/* Settings List */}
      <div className="settings-cards-stack">
        {/* Row 1: Start with Windows */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Start with Windows</span>
            <span className="row-desc">Launch Uwidgets automatically when you log into Windows and restore active widgets</span>
          </div>
          <div className="row-control">
            <label className="switch-toggle" aria-label="Start with Windows toggle">
              <input
                type="checkbox"
                checked={startWithWindows}
                disabled={pendingKey === 'startWithWindows'}
                onChange={e => handleToggle('startWithWindows', e.target.checked, setStartWithWindows)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        {/* Row 2: Close Manager to Tray (Audit 10) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Close Manager to System Tray</span>
            <span className="row-desc">Keep floating widgets active on your desktop when closing the manager window instead of exiting</span>
          </div>
          <div className="row-control">
            <label className="switch-toggle" aria-label="Close manager to tray toggle">
              <input
                type="checkbox"
                checked={closeToTray}
                disabled={pendingKey === 'closeToTray'}
                onChange={e => handleToggle('closeToTray', e.target.checked, setCloseToTray)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        {/* Row 3: Start Minimized to Tray (Audit 10) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Start Minimized to System Tray</span>
            <span className="row-desc">Open Uwidgets silently in the system tray when started, keeping your desktop clean until needed</span>
          </div>
          <div className="row-control">
            <label className="switch-toggle" aria-label="Start minimized to tray toggle">
              <input
                type="checkbox"
                checked={startMinimized}
                disabled={pendingKey === 'startMinimized'}
                onChange={e => handleToggle('startMinimized', e.target.checked, setStartMinimized)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        {/* Row 4: Always on Top by Default (Audit 11) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Always on Top by Default</span>
            <span className="row-desc">Keep newly pinned widgets floating above other application and browser windows</span>
          </div>
          <div className="row-control">
            <label className="switch-toggle" aria-label="Always on top toggle">
              <input
                type="checkbox"
                checked={alwaysOnTopDefault}
                disabled={pendingKey === 'alwaysOnTopDefault'}
                onChange={e => handleToggle('alwaysOnTopDefault', e.target.checked, setAlwaysOnTopDefault)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        {/* Row 5: Mechanical Sound Effects (Audit 15) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Mechanical Sound Effects</span>
            <span className="row-desc">Play tactile split-flap countdown clicks, paper rip tearing, and win celebrations</span>
          </div>
          <div className="row-control">
            <label className="switch-toggle" aria-label="Sound effects toggle">
              <input
                type="checkbox"
                checked={soundEffects}
                disabled={pendingKey === 'soundEffects'}
                onChange={e => handleToggle('soundEffects', e.target.checked, setSoundEffects)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        {/* Row 6: Default Widget Scale (Audit 12) */}
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Default Widget Scale</span>
            <span className="row-desc">Scale widget geometry relative to your display resolution (compact vs standard)</span>
          </div>
          <div className="row-control">
            <div className="scale-segmented-control">
              {[
                { label: '85% Compact', val: 0.85 },
                { label: '100% Standard', val: 1.0 },
                { label: '115% Large', val: 1.15 },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  className={`scale-segment-btn ${scaleFactor === opt.val ? 'active' : ''}`}
                  disabled={pendingKey === 'scaleFactor'}
                  onClick={() => handleScaleChange(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Management & Recovery (Audit 13 & AC 8) */}
      <div className="settings-section-divider">
        <h3 className="section-heading">Desktop Management</h3>
      </div>

      <div className="settings-cards-stack">
        <div className="settings-row-card">
          <div className="row-text">
            <span className="row-title">Reset Widget Positions</span>
            <span className="row-desc">
              Reposition all desktop widgets to their default visible bounds on your primary display.
            </span>
          </div>
          <div className="row-control">
            <button
              type="button"
              className="action-pill-btn"
              onClick={handleResetPositions}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Positions'}
            </button>
          </div>
        </div>

        <div className="settings-danger-card">
          <div className="row-text">
            <span className="row-title">Remove All Desktop Widgets</span>
            <span className="row-desc">
              Closes all floating widgets currently running on your desktop. {openCount > 0 ? `(${openCount} currently open)` : '(None currently open)'}
            </span>
          </div>
          <button
            type="button"
            className="danger-action-btn"
            onClick={onRemoveAllWidgets}
            disabled={openCount === 0}
          >
            Close All Widgets
          </button>
        </div>
      </div>

      {/* About Box */}
      <div className="settings-about-box">
        <div className="about-brand">
          <div className="about-logo">U</div>
          <div>
            <h4 className="about-title">Uwidgets for Windows</h4>
            <span className="about-version">Version 1.0.0 (x64) · Production Build</span>
          </div>
        </div>
        <p className="about-legal">
          Crafted with React, Electron &amp; Web Audio API. Designed for high focus and zero desktop distraction.
        </p>
      </div>
    </div>
  );
};
