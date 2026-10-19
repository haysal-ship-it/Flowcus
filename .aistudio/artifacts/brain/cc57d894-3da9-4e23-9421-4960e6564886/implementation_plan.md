# Implementation Plan — Empty State & Add Task Form Coordination

Ensure the "A fresh start" empty-state copy, illustration, and button are cleanly hidden while the Add Task form is active, preventing visual duplication and layout crowding.

## User Review Required

> [!IMPORTANT]
> **Confirmed Decisions:**
> 1. **While Add Task form is open on an empty day:** Hide the empty-state content completely so only the active task creation form is visible in the panel.
> 2. **When closing/cancelling without adding a task:** Smoothly fade the "A fresh start" empty state back into view.
> 3. **When submitting a task:** The new task immediately renders in the task list; the empty state does not reappear.

---

## Proposed Changes

### `src/components/TasksView.tsx`

- **Conditional Rendering for Empty State:**
  - Update the empty state condition from `tasks.length === 0` to:
    ```tsx
    {tasks.length === 0 && !isAddFormOpen && (
      <div className="flowcus-tasks-empty-area" role="region" aria-label="No tasks today">
        ...
      </div>
    )}
    ```
  - Coordinate with `isClosingForm`: Keep the empty state unmounted or fading during the 170ms form collapse transition, then smoothly fade in via CSS `flowcusFadeIn` animation when the form has fully closed.
  - When the user taps the white pill "Add Task" button in the empty state, `onToggleAddForm()` opens the form, and the empty state gracefully exits.

### `src/index.css`

- **Smooth Entrance Animation:**
  - Ensure `.flowcus-tasks-empty-area` has a calm, restrained entrance transition:
    ```css
    .flowcus-tasks-empty-area {
      animation: flowcusFadeIn 200ms var(--flowcus-ease);
    }
    ```
  - When reduced motion is preferred, remove the animation for instant state transitions.

---

## Verification Plan

### Automated Checks
- Run `compile_applet` (`npm run build`) and `lint_applet` (`npm run lint`) to confirm 0 compilation or type errors.

### Manual Verification Steps
1. **Empty State Initial State:**
   - On an empty day, verify "A fresh start", document illustration, and "Add Task" button are cleanly centered.
2. **Opening Add Task Form:**
   - Tap "Add Task" (or the header `+` button).
   - Verify the Add Task form expands smoothly.
   - Confirm the "A fresh start" illustration, copy, and duplicate button are completely hidden below the form.
3. **Cancelling/Closing Form:**
   - Click the form close `X` button (or press `Esc`).
   - Confirm the Add Task form collapses and the "A fresh start" empty state smoothly fades back into view.
4. **Submitting a Task:**
   - Open the form, enter a task title, choose 15m/30m/60m, and click "Add".
   - Confirm the task appears in the task list, and the empty state does not flash or display.
