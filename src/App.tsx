/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WidgetId } from './types';
import { FlowcusWidget } from './components/FlowcusWidget';
import { PlayzWidget } from './components/playz/PlayzWidget';
import { StickkWidget } from './components/stickk/StickkWidget';
import { UwidgetsManager } from './components/manager/UwidgetsManager';
import { flipAudio } from './utils/flipAudio';
import { uwidgetsAudio } from './utils/uwidgetsAudio';

export default function App() {
  const [activeWindow, setActiveWindow] = useState<WidgetId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const winParam = params.get('window') as WidgetId;
      if (winParam && ['flowcus', 'playz', 'stickk', 'main', 'hub'].includes(winParam)) {
        return winParam;
      }
    }
    return 'main';
  });

  const isElectron = Boolean(
    typeof window !== 'undefined' && window.electronAPI?.isElectron
  );

  // Sync window route changes
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const winParam = params.get('window') as WidgetId;
      if (winParam) setActiveWindow(winParam);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Set transparent window classes on body/html for floating gadget mode
  useEffect(() => {
    const isFloating = ['flowcus', 'playz', 'stickk'].includes(activeWindow);
    if (isFloating) {
      document.documentElement.classList.add('floating-widget-mode');
      document.body.classList.add('floating-widget-mode');
    } else {
      document.documentElement.classList.remove('floating-widget-mode');
      document.body.classList.remove('floating-widget-mode');
    }
  }, [activeWindow]);

  // Audit 15 & 16: Synchronize global settings (accent color, global sound mute) across all windows
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const applySettings = (settings: any) => {
      if (!settings) return;
      if (settings.accentColor) {
        document.documentElement.style.setProperty('--color-accent', settings.accentColor);
        document.documentElement.style.setProperty('--flowcus-accent', settings.accentColor);
      }
      if (settings.soundEffects !== undefined) {
        const isGlobalMuted = settings.soundEffects === false;
        flipAudio.setGlobalMuted(isGlobalMuted);
        uwidgetsAudio.setGlobalMuted(isGlobalMuted);
      }
    };

    if (api.getSettings) {
      api.getSettings().then(applySettings).catch(() => {});
    }

    if (api.onSettingsChange) {
      const unsubscribe = api.onSettingsChange(applySettings);
      return unsubscribe;
    }
  }, []);

  const switchBrowserRoute = (route: WidgetId) => {
    setActiveWindow(route);
    const url = new URL(window.location.href);
    url.searchParams.set('window', route);
    window.history.pushState({}, '', url.toString());
  };

  const renderContent = () => {
    switch (activeWindow) {
      case 'flowcus':
        return (
          <div className="uwidget-floating-root">
            <FlowcusWidget />
          </div>
        );
      case 'playz':
        return (
          <div className="uwidget-floating-root">
            <PlayzWidget />
          </div>
        );
      case 'stickk':
        return (
          <div className="uwidget-floating-root">
            <StickkWidget />
          </div>
        );
      case 'main':
      case 'hub':
      default:
        return (
          <div className="uwidgets-manager-stage">
            <UwidgetsManager />
          </div>
        );
    }
  };

  return (
    <>
      {/* Dev Switcher: Only visible in browser dev mode, hidden in Electron */}
      {!isElectron && (
        <aside className="browser-dev-switcher" aria-label="Development Route Switcher">
          <button
            type="button"
            className={`dev-btn ${activeWindow === 'main' || activeWindow === 'hub' ? 'active' : ''}`}
            onClick={() => switchBrowserRoute('main')}
          >
            Manager Hub
          </button>
          <button
            type="button"
            className={`dev-btn ${activeWindow === 'flowcus' ? 'active' : ''}`}
            onClick={() => switchBrowserRoute('flowcus')}
          >
            Flowcus Gadget
          </button>
          <button
            type="button"
            className={`dev-btn ${activeWindow === 'playz' ? 'active' : ''}`}
            onClick={() => switchBrowserRoute('playz')}
          >
            Playz Gadget
          </button>
          <button
            type="button"
            className={`dev-btn ${activeWindow === 'stickk' ? 'active' : ''}`}
            onClick={() => switchBrowserRoute('stickk')}
          >
            Stickk Gadget
          </button>
        </aside>
      )}

      {renderContent()}
    </>
  );
}
