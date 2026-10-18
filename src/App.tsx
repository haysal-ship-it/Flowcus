/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FlowcusWidget, ReferenceState } from './components/FlowcusWidget';

export default function App() {
  const [activeReferenceState, setActiveReferenceState] = useState<ReferenceState>('tasks-default');

  return (
    <div className="flowcus-desktop-stage" role="main">
      {/* 418px Centered Flowcus Widget */}
      <FlowcusWidget
        activeReferenceState={activeReferenceState}
        onChangeReferenceState={setActiveReferenceState}
      />

      {/* Discreet Figma Reference State Switcher for Section 12 Validation */}
      <nav
        className="flowcus-state-switcher-toolbar"
        aria-label="Figma Reference States Quick Switcher"
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
      </nav>
    </div>
  );
}
