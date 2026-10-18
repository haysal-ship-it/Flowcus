# Implementation Plan — Daily Progress & Focus Session Integration

Synchronize the **Daily Progress container** and the **Focus tab Session counter** so that focus timer completions automatically advance both metrics accurately, respecting daily goals and user workflow.

## User Review Required

> [!IMPORTANT]
> **Key Decisions Confirmed by User:**
> 1. **Focus Session Counter (`Session X / Y`):** Operates on a daily session target (default `5` sessions/day, persisted per calendar date, resetting each day).
> 2. **Automatic Task Completion:** When a Focus countdown reaches 0:00, the active task is automatically marked completed (`completed: true`), instantly updating the Daily Progress container (`X / Y completed` and progress segments).

- **Daily Target Adjustments:** Users will be able to click on the session counter or adjust their target sessions (default 5) if desired, while preserving the exact Figma design and compact typography.
- **Next Active Task Auto-Selection:** Once an active task completes automatically upon timer finish, Flowcus will automatically queue the next uncompleted task and prime the timer with its duration (15m, 30m, or 60m).

---

## Proposed Changes

### Storage & State Models (`src/utils/taskStorage.ts`)

- **Daily Sessions Tracking:**
  - Add `loadDailySessions(dateStr)` and `saveDailySessions(dateStr, data)` to track `{ completedSessions: number, targetSessions: number }` per calendar day (`YYYY-MM-DD`).
  - Set default target to `5` sessions.
  - Automatically reset session count at midnight or upon date rollover.
- **Timer State Consistency:**
  - Ensure `timerState.currentSession` represents the current active session index (e.g., Session 1 of 5 until completed, or total completed + 1).

### Flowcus Core Engine (`src/components/FlowcusWidget.tsx`)

- **Timer Expiration Workflow (`handleTimerComplete`):**
  1. Record focus duration into `focusMinutesToday`.
  2. Locate the currently active task (`timerState.activeTaskId` or current in-progress task).
  3. Mark that task as `completed: true` and `inProgress: false`.
  4. Update `tasks` state and persist via `saveTasksToStorage`.
  5. Increment daily completed focus sessions count.
  6. Pick the next incomplete task in the list and set it as active.
  7. Reset timer to the new active task's duration in a clean `completed` or `idle` state.
  8. Trigger accessibility announcement: *"Session complete! Task '{title}' marked completed. Daily progress updated."*
- **Daily Progress Reactive Synchronization:**
  - `completedTodayTasks / totalTodayTasks` recalculates immediately from the updated `tasks` state.
  - 48-segment diagonal progress bar smoothly animates to the new completion percentage.

### Focus Tab UI (`src/components/FocusView.tsx`)

- **Session Counter Display:**
  - Render `Session {currentSession} / {targetSessions}` cleanly in `.flowcus-session-counter`.
  - Provide an accessible modal or popover trigger on click to allow setting a custom daily target (e.g. 3, 4, 5, 6, 8 sessions) without cluttering the compact UI.
- **Completion Feedback:**
  - Visual indicator when the daily session goal is met (e.g. 5 / 5 sessions achieved).

---

## Verification Plan

### Automated Checks
- Run `npm run lint` and `compile_applet` to guarantee type safety and zero regressions.

### Manual Verification Steps
1. **Focus Session Counter Verification:**
   - Verify `Session X / Y` displays `Session 1 / 5` (or current stored session) on initial launch.
   - Verify changing dates or resetting starts fresh for the day.
2. **Timer End & Task Completion Test:**
   - Select a task (e.g., "Review design tokens", 15m) as active.
   - Start the Focus timer and simulate or allow completion (0:00).
   - Verify the active task is marked completed with strikethrough in the Tasks tab.
   - Verify the Daily Progress container updates from `1 / 4 completed` to `2 / 4 completed` with diagonal bar fill.
   - Verify the next incomplete task is automatically queued as the active task in Focus.
3. **Session Counter Increment Test:**
   - Verify the session counter increments from `Session 1 / 5` to `Session 2 / 5`.
   - Verify `Z min focused` reflects the additional completed minutes in Daily Progress.
