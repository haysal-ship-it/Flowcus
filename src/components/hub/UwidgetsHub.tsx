import React, { useState, useEffect } from 'react';
import { WidgetId } from '../../types';

interface UwidgetsHubProps {
  onSelectWidget?: (id: WidgetId) => void;
}

export const UwidgetsHub: React.FC<UwidgetsHubProps> = ({ onSelectWidget }) => {
  const [pinnedStates, setPinnedStates] = useState<Record<string, boolean>>({
    flowcus: false,
    playz: false,
    stickk: true,
  });

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({
    flowcus: true,
    playz: false,
    stickk: true,
  });

  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getWidgetStates) {
      window.electronAPI.getWidgetStates().then((res) => {
        if (res) setOpenStates(res);
      }).catch(() => {});
    }
  }, []);

  const handleLaunch = (id: WidgetId) => {
    if (typeof window !== 'undefined' && window.electronAPI?.openWidget) {
      window.electronAPI.openWidget(id);
      setOpenStates(prev => ({ ...prev, [id]: true }));
    } else {
      onSelectWidget?.(id);
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !pinnedStates[id];
    setPinnedStates(prev => ({ ...prev, [id]: next }));

    if (typeof window !== 'undefined' && window.electronAPI?.togglePin) {
      window.electronAPI.togglePin(id, next);
    }
  };

  const handleScaleChange = (val: number) => {
    setScale(val);
    if (typeof window !== 'undefined' && window.electronAPI?.setScale) {
      window.electronAPI.setScale(val);
    }
  };

  const handleLaunchAll = () => {
    ['flowcus', 'playz', 'stickk'].forEach(id => {
      handleLaunch(id as WidgetId);
    });
  };

  return (
    <div className="uwidget-shell" id="uwidgets-hub-root">
      {/* Chrome */}
      <div className="uwidget-chrome">
        <div className="chrome-left">
          <div className="chrome-grip">
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div className="chrome-brand">
            <span>Uwidgets</span>
            <span className="chrome-tag">· Suite Manager</span>
          </div>
        </div>
        <div className="chrome-actions">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1C1C1C] text-[#00C853]">v1.0 Ready</span>
        </div>
      </div>

      {/* Surface 1: Brand Hero with Ambient Burnt-Orange Glow */}
      <section className="uwidget-card-top relative overflow-hidden" style={{ minHeight: '136px', justifyContent: 'space-between' }}>
        <div style={{ position: 'absolute', bottom: '-35px', left: '10%', right: '10%', height: '90px', background: 'radial-gradient(ellipse at 50% 100%, rgba(208,83,0,0.45) 0%, transparent 75%)', filter: 'blur(18px)', pointerEvents: 'none' }} />
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Uwidgets</h1>
            <p className="card-subtitle">Pin calm, focused productivity tools anywhere on your desktop.</p>
          </div>
          <div className="flex items-center gap-1 bg-[#1C1C1C] p-1 rounded-lg border border-[rgba(255,255,255,0.08)]">
            {[0.85, 1, 1.15].map(sc => (
              <button
                key={sc}
                type="button"
                className={`px-2 py-0.5 rounded text-xs transition-colors ${scale === sc ? 'bg-[#D05300] text-white font-medium' : 'text-[#797979] hover:text-white'}`}
                onClick={() => handleScaleChange(sc)}
              >
                {Math.round(sc * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs relative z-10 pt-2" style={{ color: '#797979' }}>
          <span>{Object.values(openStates).filter(Boolean).length} widgets open</span>
          <span style={{ color: '#F18A42' }}>{Object.values(pinnedStates).filter(Boolean).length} pinned Always-on-Top</span>
        </div>
      </section>

      {/* Surface 2: Widget Cards */}
      <section className="uwidget-card-bottom" style={{ gap: '10px' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#797979' }}>Desktop Widgets</span>
          <span className="text-xs" style={{ color: '#797979' }}>Click to launch</span>
        </div>

        {/* 1. Flowcus Card */}
        <div className="note-card" onClick={() => handleLaunch('flowcus')}>
          <div className="note-accent-bar" style={{ background: '#D05300' }} />
          <div className="flex items-center justify-between pl-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Flowcus</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${openStates.flowcus ? 'bg-[rgba(0,200,83,0.12)] text-[#00C853]' : 'bg-[#1C1C1C] text-[#797979]'}`}>
                  {openStates.flowcus ? 'Open' : 'Ready'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#797979' }}>Daily task tracker &amp; mechanical split-flap Pomodoro timer</p>
            </div>
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={`chrome-btn ${pinnedStates.flowcus ? 'pin-active' : ''}`}
                onClick={e => handleTogglePin('flowcus', e)}
              >
                {pinnedStates.flowcus ? 'Pinned' : 'Pin'}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full bg-white text-[#090909] text-xs font-semibold hover:bg-[#ECECEC]"
                onClick={() => handleLaunch('flowcus')}
              >
                Launch
              </button>
            </div>
          </div>
        </div>

        {/* 2. Playz Card */}
        <div className="note-card" onClick={() => handleLaunch('playz')}>
          <div className="note-accent-bar" style={{ background: '#F18A42' }} />
          <div className="flex items-center justify-between pl-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Playz</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${openStates.playz ? 'bg-[rgba(0,200,83,0.12)] text-[#00C853]' : 'bg-[#1C1C1C] text-[#797979]'}`}>
                  {openStates.playz ? 'Open' : 'Ready'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#797979' }}>Best-of-5 Tic-Tac-Toe · Minimax AI &amp; brush-stroke lines</p>
            </div>
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={`chrome-btn ${pinnedStates.playz ? 'pin-active' : ''}`}
                onClick={e => handleTogglePin('playz', e)}
              >
                {pinnedStates.playz ? 'Pinned' : 'Pin'}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full bg-white text-[#090909] text-xs font-semibold hover:bg-[#ECECEC]"
                onClick={() => handleLaunch('playz')}
              >
                Launch
              </button>
            </div>
          </div>
        </div>

        {/* 3. Stickk Card */}
        <div className="note-card" onClick={() => handleLaunch('stickk')}>
          <div className="note-accent-bar" style={{ background: '#00C853' }} />
          <div className="flex items-center justify-between pl-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Stickk</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${openStates.stickk ? 'bg-[rgba(0,200,83,0.12)] text-[#00C853]' : 'bg-[#1C1C1C] text-[#797979]'}`}>
                  {openStates.stickk ? 'Open' : 'Ready'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#797979' }}>Sticky note sketchpad · 3D page flip, paper rip &amp; funky fonts</p>
            </div>
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={`chrome-btn ${pinnedStates.stickk ? 'pin-active' : ''}`}
                onClick={e => handleTogglePin('stickk', e)}
              >
                {pinnedStates.stickk ? 'Pinned' : 'Pin'}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full bg-white text-[#090909] text-xs font-semibold hover:bg-[#ECECEC]"
                onClick={() => handleLaunch('stickk')}
              >
                Launch
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Global Controls */}
        <div className="controls-row pt-2">
          <button type="button" className="white-pill-btn" onClick={handleLaunchAll}>
            <span>Launch All Widgets</span>
          </button>
        </div>
      </section>
    </div>
  );
};
