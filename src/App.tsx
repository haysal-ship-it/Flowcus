/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FlowcusWidget, ReferenceState } from './components/FlowcusWidget';

export default function App() {
  // Gated behind explicit build-time development flag; false by default
  const showFigmaStatePanel = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_SHOW_FIGMA_STATE_PANEL === 'true'
  );

  const [activeReferenceState, setActiveReferenceState] = useState<ReferenceState>('tasks-default');
  const [replaySplashTrigger, setReplaySplashTrigger] = useState<number>(0);
  const [sampleTasksTrigger, setSampleTasksTrigger] = useState<number>(0);
  const [resetDayTrigger, setResetDayTrigger] = useState<number>(0);

  const handleReplaySplash = () => {
    setReplaySplashTrigger(prev => prev + 1);
  };

  const handleSimulateMidnight = () => {
    // Set day key to yesterday and trigger reset check
    const yesterday = new Date(Date.now() - 86400000);
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yesterday.getFullYear()}-${yMonth}-${yDay}`;
    localStorage.setItem('flowcus_day_key_v4', yesterdayStr);
    setResetDayTrigger(prev => prev + 1);
  };

  const handleSeedSample = () => {
    setSampleTasksTrigger(prev => prev + 1);
  };

  const handleResetDay = () => {
    setResetDayTrigger(prev => prev + 1);
  };

  return (
    <div className={`flowcus-desktop-stage ${showFigmaStatePanel ? 'has-debug-panel' : ''}`} role="main">
      {/* 418px Centered Flowcus Widget */}
      <FlowcusWidget
        activeReferenceState={showFigmaStatePanel ? activeReferenceState : undefined}
        onChangeReferenceState={showFigmaStatePanel ? setActiveReferenceState : undefined}
        replaySplashTrigger={replaySplashTrigger}
        sampleTasksTrigger={sampleTasksTrigger}
        resetDayTrigger={resetDayTrigger}
      />

      {/* Discreet Figma Reference State Switcher & Test Controls: only rendered when explicitly enabled */}
      {showFigmaStatePanel && (
        <nav
          className="flowcus-state-switcher-toolbar"
          aria-label="Figma Reference States & Test Controls"
        >
          <span className="flowcus-state-switcher-label">Figma State:</span>
          <button
            type="button"
            className={`flowcus-state-btn ${activeReferenceState === 'tasks-default' ? 'active' : ''}`}
            onClick={() => setActiveReferenceState('tasks-default')}
          >
            1. Tasks
          </button>
          <button
            type="button"
            className={`flowcus-state-btn ${activeReferenceState === 'add-task' ? 'active' : ''}`}
            onClick={() => setActiveReferenceState('add-task')}
          >
            2. Add Task
          </button>
          <button
            type="button"
            className={`flowcus-state-btn ${activeReferenceState === 'focus-idle' ? 'active' : ''}`}
            onClick={() => setActiveReferenceState('focus-idle')}
          >
            3. Focus Idle
          </button>
          <button
            type="button"
            className={`flowcus-state-btn ${activeReferenceState === 'focus-running' ? 'active' : ''}`}
            onClick={() => setActiveReferenceState('focus-running')}
          >
            4. Focus Running
          </button>

          <span className="flowcus-state-switcher-sep" aria-hidden="true">|</span>

          <button
            type="button"
            className="flowcus-state-btn test-btn"
            onClick={handleReplaySplash}
            title="Replay introductory splash screen and widget handoff"
          >
            Replay Splash
          </button>
          <button
            type="button"
            className="flowcus-state-btn test-btn"
            onClick={handleSimulateMidnight}
            title="Simulate calendar midnight transition & automatic task reset (Test E)"
          >
            Simulate Midnight
          </button>
          <button
            type="button"
            className="flowcus-state-btn test-btn"
            onClick={handleSeedSample}
            title="Seed today's 5 Figma reference tasks"
          >
            Seed Sample Tasks
          </button>
          <button
            type="button"
            className="flowcus-state-btn test-btn"
            onClick={handleResetDay}
            title="Clear all tasks for today (Empty State)"
          >
            Clear Day
          </button>
        </nav>
      )}
    </div>
  );
}
