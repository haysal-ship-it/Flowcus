# Uwidgets Architecture & Implementation Decisions

**Document Date:** 11 November 2026  
**Status:** Living Record  
**Project:** Flowcus-main / Uwidgets  

---

## 1. Package Management & Tooling Decisions (W00)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Authoritative Package Manager: `npm`** | `npm` (`v11.12.1`) is installed natively in the Windows environment, matches `package-lock.json` (lockfileVersion: 3), and is detected by `electron-builder`. | `bun`: Not installed on host; `bun.lock` is a stale AI Studio export artifact. |
| **Authoritative Lockfile: `package-lock.json`** | Preserves exact transitive dependency tree for Node/Electron builds. | `bun.lock` (ignored, slated for archive/removal in W10). |
| **Vite Config Resolution: `import.meta.dirname`** | Vite 8 plans to make `configLoader: 'native'` default. Using `import.meta.dirname` (with `fileURLToPath` fallback) eliminates `__dirname` deprecation warnings and prevents `ReferenceError` crashes under `native` and `runner` loaders. | Keeping `__dirname` (fails under native loader); hardcoded relative paths (brittle). |
| **Preservation of Existing Changes** | The repository contains active user edits to desktop layout, widgets, and styles. All work packages must respect and build upon existing Git working tree state without destructive `clean` or `reset`. | `git reset --hard` / `git clean -fd` (prohibited). |
| **Windows File Traversal Protocol** | In PowerShell commands, recursive file operations must explicitly use `Get-ChildItem -File` or verify item types before opening file streams to avoid `UnauthorizedAccessException` on folder paths. | Bare `Select-String -Path ...\*` (causes false EPERM errors). |

---

## 2. Preview Isolation & Form Ownership Decisions (W01)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Dedicated Preview Mode Prop (`isPreview?: boolean`)** | Decorating widget root components (`FlowcusWidget`, `PlayzWidget`, `StickkWidget`, `WidgetChrome`) with `isPreview` cleanly separates preview rendering from desktop side effects without requiring separate duplicate components. | Dynamic inspection of window location (fragile in iframe/embedded contexts); Separate `<FlowcusPreview />` duplicate components (risk of visual/code drift). |
| **In-Memory Preview Fixtures (`previewFixtures.ts`)** | Previews in `WidgetDetailModal` are seeded from immutable in-memory fixtures (`getPreviewTasks()`, `getPreviewTimer()`, `getPreviewStickkPages()`), ensuring zero disk reads or writes to `localStorage`. | Using empty mock state (poor user preview experience); Reading user's real data in read-only mode (privacy and state confusion). |
| **Explicit Form Close Callback (`onCloseAddForm`)** | In `TasksView`, replacing delayed toggle logic (`setTimeout(() => onToggleAddForm(), 170)`) with an explicit, idempotent `onCloseAddForm` callback guarantees that the add form never reopens due to state-inversion race conditions. | Relying on `onToggleAddForm` with debounce flags (complex, prone to edge case flips); Omitting collapse animation (degraded UX). |
| **Suppression of Desktop Controls in Preview** | In `WidgetChrome`, when `isPreview: true`, window dragging (`WebkitAppRegion`), pin toggling (`electronAPI.togglePin`), widget closing (`electronAPI.closeWidget`), and main window opening (`electronAPI.openMainWindow`) are completely suppressed. | Hiding the chrome entirely (fails to show users what the widget looks like on desktop); Rendering dummy chrome elements (code duplication). |
| **Audio Suppression in Previews** | Sound effects (fanfares, paper tears, page flips, release clicks) are muted or suppressed in preview mode to prevent annoying audio triggers during modal browsing. | Global audio mute (affects running desktop widgets); Allowing sound in modal (jarring user experience). |
| **Single Transition Ownership for Form Collapse** | In `TasksView`, rendering `{(isAddFormOpen \|\| isClosingForm) && <AddTaskForm ... />}` and retaining component mounting throughout the 170ms collapse animation ensures smooth visual exit, while cleaning up timer handles in `useEffect` prevents stale callbacks on unmount. | Synchronous unmount on submit (instant cutoff, no animation); Double state setters in parent and child (state race condition). |
| **Local Calendar Date Sync for Preview Tasks** | Using `getLocalTodayDateString()` instead of UTC `toISOString().slice(0, 10)` in `previewFixtures.ts` ensures preview tasks match the local day filter across all time zones. | Hardcoded date strings (go stale); Dynamic dates in UTC (fails in timezones with +/- offsets around midnight). |

---

## 3. Desktop Lifecycle & Trusted IPC Decisions (W02)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Explicit Quit State (`app.isQuitting`)** | Intercepting `mainWindow.on('close')` to hide to tray keeps background widgets running during everyday use, but previously prevented application exit. Tracking `app.isQuitting` allows `close` events to proceed unhindered during explicit Tray Quit and system shutdown. | Calling `process.exit()` directly (skips window unmount and file sync); Destroying windows without setting state (messy teardown). |
| **Separation of Restoration Intent from Liveness** | Storing `appState.restoreOnStartup` independently from ephemeral window instances prevents window teardown events (`win.on('closed')`) during app quit from wiping out the user's desktop layout. Explicit user removals clear intent; app shutdown preserves it. | Storing open window array without distinguishing quit from close (loses windows on restart); Storing nothing (forces user to re-open widgets every launch). |
| **Top-Level Frame & Sender Origin Verification** | Validating `senderFrame.parent === null` and ensuring sender URLs belong to local app origins (`file://.../dist/index.html` or local dev server) prevents malicious iframes or external navigations from invoking desktop IPC. | Relying on Electron contextIsolation alone (does not prevent iframe spoofing if iframes are opened); Blind IPC handlers (vulnerable to command injection). |
| **Strict Whitelist & Finite Numeric Bounds** | Restricting `widgetId` to approved constants (`flowcus`, `playz`, `stickk`), `settings` keys to approved settings, and numeric payloads (`height` 100–1200, `scaleFactor` 0.5–2.0) guarantees zero state corruption or prototype pollution from malformed IPC calls. | Unvalidated dynamic property assignment (`appState[key] = value` without key whitelist); Lenient type coercion. |
| **Unified Window Security & Global CSP** | Consistently attaching `will-navigate`, `setWindowOpenHandler` (deny popups, route external HTTP to default browser), and `will-attach-webview` to both the manager and every floating widget prevents arbitrary navigation or nested webviews across all desktop surfaces. | Attaching handlers only to `mainWindow` (leaves floating widgets vulnerable to navigation/phishing); Relying on meta tag only. |

---

## 4. Durable State & Storage Foundation Decisions (W03)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Schema Versioning Envelope (`schemaVersion: 1`)** | Storing an explicit schema version in the primary file protects against data corruption when older app binaries encounter newer schemas. Loading newer versions is explicitly blocked to protect forward compatibility. | Unversioned JSON (fragile, impossible to migrate safely); Relying on package.json version (decoupled from state schema). |
| **Atomic Temporary-File Replacement** | Writing to a `.tmp` file in the same directory, calling `fsyncSync` to flush to disk hardware, and renaming prevents 0-byte corrupted files during power loss or abrupt exit. A 5-attempt retry loop resolves Windows `EPERM`/`EBUSY` contention. | Direct `fs.writeFileSync` in place (truncates file immediately; leaves empty file if interrupted); Writing to OS temp dir (cross-device link errors during rename). |
| **Serialized Write Queue (Mutex)** | Concurrent calls to save state are enqueued sequentially through a promise chain. Each write increments a monotonic `revision` counter, guaranteeing commits execute in order without race conditions. | Fire-and-forget asynchronous writes (causes lost updates); Global sync lock blocking the event loop indefinitely. |
| **Last-Known-Good Backup (`.bak`) & Quarantine** | Every successful save atomically updates `.bak`. If the primary file is corrupted or truncated, the store automatically recovers from `.bak` and preserves the corrupt file as `.corrupt.<timestamp>` for forensics, never deleting user bytes blindly. | Blindly resetting to empty default on parse error (causes catastrophic data loss); Retaining no backup (unrecoverable on disk corruption). |
| **Pre-Migration Snapshot & Idempotent Marker** | Before running migrations from unversioned legacy state, the store creates `.pre-migration.bak` and sets an explicit migration marker (`v1_desktop_state_migrated`). Repeated loads detect the marker and skip re-migration, preserving task and note IDs verbatim. | In-place migration without backup (risk of data destruction on failure); Re-migrating on every startup (duplicates records). |

---

## 5. Product & Behavioral Decisions (Approved Defaults)

### 2.1 Midnight Transition & Retention Policy (W03, W04)
- **Current Behavior:** `performDailyReset` wipes all tasks, completed minutes, and running timers at midnight.
- **Adopted Policy:**
  - **Unfinished Task Retention:** Incomplete tasks (`completed === false`) are never wiped. They are rolled forward to the new local calendar day.
  - **Completed Task Archival:** Completed tasks are retained in an immutable historical ledger (`taskHistory`) indexed by completion date, preserving titles, duration estimates, creation timestamps, and completion timestamps.
  - **Running Sessions Across Midnight:** A running focus session spanning midnight is NOT terminated or reset. It continues to run until natural expiry or user cancellation.
  - **Calendar-Day Bucket Allocation:** Focus minutes are attributed to the exact local calendar day (`YYYY-MM-DD`) during which the focus minutes elapsed. If a 30-minute session runs from 23:45 to 00:15, 15 minutes are credited to day 1 and 15 minutes to day 2.

### 2.2 Focus Session Ownership & Accounting (W04)
- **Authoritative Main Process Ownership:** The Electron main process (`sessionService.cjs`) is the single source of truth for timer countdown, task completion status, and focus minute credit. React renderers act purely as visual subscribers and send user commands via validated IPC.
- **Immutable Session Binding:** When a session is started, it is bound to `(sessionId, taskId, initialDurationSeconds)`.
- **Task Switching Policy:** While a session is `running` or `paused`, selecting a different task is prohibited without an explicit session cancellation / reset. Switching tasks requires resetting the current session first.
- **Idempotent Completion Ledger:** Every session generates a unique, deterministic `sessionId` (e.g. `sess_<startedAtMs>_<random>`). When a session completes (whether live or recovered upon startup after expiry), its completion is recorded in `completionLedger`. Any redundant completion requests for the same `sessionId` are no-ops.
- **Session Cancellation & Partial Credit:** When an active or paused session is canceled/reset before full completion, the elapsed focus minutes ($\ge 1$ minute) are credited to the user's daily focus minutes, but the active task is NOT completed.
- **Timezone, Sleep/Wake & Clock-Change Handling:**
  - **Local Calendar Day:** Day boundaries are computed using the user's local timezone (`Intl.DateTimeFormat` or `Date.getFullYear()`, `getMonth()`, `getDate()`).
  - **Clock Skew & Backward Clock Protection:** If the system clock is set backwards (`now < session.lastTickMs`), elapsed delta is clamped to $0$. Under no circumstance can elapsed focus time be negative or reduce previously earned minutes.
  - **Sleep/Wake & Hibernation:** A wake event or timeout tick compares `now` against `targetEndTimeMs`. If `now >= targetEndTimeMs`, the session completes immediately, crediting exactly `initialDurationSeconds - previouslyCreditedSeconds`. If `now < targetEndTimeMs`, `remainingSeconds = Math.ceil((targetEndTimeMs - now) / 1000)`.
  - **Upper Bound Invariant:** Total credited minutes for any single session $S$ across all day buckets cannot exceed $\lceil S.\text{initialDurationSeconds} / 60 \rceil$. Double crediting is mathematically impossible because each second $[t, t+1]$ is attributed to at most one calendar day bucket and tracked by cumulative credited seconds.

### 2.3 Desktop Window Lifecycle & System Tray (W02, W05)
- **Close vs Quit:**
  - Closing the Manager Hub window hides it to the system tray if background widgets are open or if `closeToTray` is enabled.
  - Explicit Tray Quit (`app.isQuitting = true`) forces immediate termination of all Electron processes without interruption.
- **Window Restoration:**
  - Window restoration intent is saved separately from transient window liveness.
  - On app launch, only widgets that were intentionally left open are restored.
- **Always on Top (Pinning):**
  - Opening a widget and pinning it Always-on-Top are treated as separate states. Each widget maintains an independent pin state with a configurable global default.

### 2.4 Playz Game Match Rules (W07)
- **Series Rules:** A match consists of up to 5 rounds. Draws are tracked explicitly. First player to achieve a majority (or highest score after 5 rounds) wins. Ties at 5 rounds are declared a series draw.
- **Turn Cancellation:** All pending CPU timeout handles and animation frames must be cleanly aborted when resetting the match or switching game modes.

### 2.5 Storage Architecture & Migration (W03, W06)
- **Unified Main Store:** Primary application state is managed by the Electron main process with atomic file replacement (`temp file -> rename`) and last-known-good backup.
- **Stickk Note Storage:** Migrate away from raw base64 strings in monolithic localStorage. Implement chunked/blob storage with debounced persistence and undo history.
- **Pre-Migration Safety:** Legacy stores must be fully backed up before migrations are applied. Migrations must be version-tagged and idempotent.

---

## 6. Truthful Settings & Monitor-Safe Windows Decisions (W05)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Authoritative Main Process Settings Store** | Centralizing settings persistence in `electron/main.cjs` via `DurableStore` with IPC schema validation (`validateSettingPayload`) prevents divergent settings across windows and ensures live subscriptions via `settings:changed`. | Storing settings in window-local `localStorage` (causes cross-window state drift and desynchronization); Unvalidated settings assignment (vulnerable to prototype pollution). |
| **Separation of `startMinimized` vs `closeToTray` (Audit 10)** | In `ManagerSettings.tsx`, previously "Minimize to System Tray" saved to `startMinimized`. Splitting into two distinct preferences—"Close Manager to System Tray" (`closeToTray`) and "Start Minimized to System Tray" (`startMinimized`)—provides truthful, accurate control over window close behavior and boot behavior. | Combining both into a single toggle (confuses user intent between closing manager vs booting silently). |
| **Global Pin Default & Per-Widget Pin Precedence (Audit 11)** | Widget creation resolves `isPinned = appState.pinned?.[widgetId] !== undefined ? Boolean(appState.pinned[widgetId]) : (appState.alwaysOnTopDefault !== undefined ? Boolean(appState.alwaysOnTopDefault) : true)`. Modifying `alwaysOnTopDefault` updates active widgets lacking explicit overrides, ensuring consistent behavior. | Ignoring `alwaysOnTopDefault` entirely (Audit 11 bug); Overriding explicit user pins blindly when global setting changes. |
| **Immediate Pin-State Multi-Window Sync (Audit 14)** | `broadcastStateChange()` sends `widget:state-changed` with `{ open, pinned, restoreOnStartup }` to both `mainWindow` AND all active `widgetWindows`. `WidgetChrome` and `UwidgetsManager` subscribe to `onWidgetStateChange` to immediately update chrome pin icons, cards, and modal states. | Broadcasting only to manager window (Audit 14 bug; left widget chrome pin out of sync); Polling pin state via `setInterval` (high overhead, latency). |
| **Global Sound Controls & Audio Controller Coupling (Audit 15)** | `FlipAudioController` and `UwidgetsAudioController` implement `setGlobalMuted(boolean)` and evaluate `isEffectivelyMuted() = isGlobalMuted \|\| isMuted`. `App.tsx` listens to `onSettingsChange`, immediately muting/unmuting all mechanical clicks, page flips, and fanfares across all windows while preserving local per-widget preferences. | Reading settings inside audio controllers on every tick (unnecessary IPC spam); Relying solely on `localStorage` (disconnected from global settings). |
| **Persistent Accent & Scale Applied Before Show (Audits 12, 16)** | In `electron/main.cjs`, `setZoomFactor(scaleFactor)` is applied on `ready-to-show` and `did-finish-load` before `.show()` is called on new windows, eliminating visual flash. In `App.tsx`, CSS variables `--color-accent` and `--flowcus-accent` are synchronized across all windows on `settings:changed`. `ManagerCustomize.tsx` persists `accentColor` via `saveSetting('accentColor', col)`. | Applying zoom only after window is shown (causes visible resize jump); Applying accent color only to manager window (leaves floating widgets with stale accents). |
| **Multi-Monitor Work Area Clamping & Negative Coordinate Spaces (Audit 13)** | `clampBoundsToDisplays` evaluates window coordinates across all connected displays (`screen.getAllDisplays()`). Negative coordinates (monitors placed to left or above primary) are preserved and clamped to their respective display work areas. Off-screen windows are repositioned to safe primary display bounds with titlebars accessible (min 80px width, 40px height visible). | Clamping only to primary `[0, width]` (breaks multi-monitor and negative coordinates); Allowing windows to spawn off-screen (leaves windows permanently lost). |
| **Screen Metrics Recovery & Reset Widget Positions Action (Audit 13 & AC 8)** | Hooking `screen.on('display-removed')` and `screen.on('display-metrics-changed')` automatically clamps stranded windows if an external monitor is disconnected. The "Reset Widget Positions" action (`widget:reset-positions`) repositions all widgets to default staggered coordinates on the primary display. | Doing nothing on monitor disconnect (leaves windows inaccessible); Requiring manual app restart. |
| **Pending States & Actionable Error Handling (Audit 18)** | All settings toggles, scale adjustments, desktop widget launches, and position resets are asynchronous. The UI disables inputs and shows pending indicators during IPC calls, displays actionable error banners (`role="alert"`) upon failure, and reports success pills only after confirmation. | Optimistic updates without error recovery (displays false success on failed saves); Silent failures without user feedback. |

---

## 7. Reliable Notes & Recoverable Edits Decisions (W06)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Stable Page ID Selection (`activePageId`) (Audit 19)** | In `StickkWidget.tsx`, replacing volatile array index `currentPageIdx` with stable `activePageId: string` ensures that when a new page is created (`id: page-${Date.now()}-${random}`), it is navigated to and selected immediately without closure race conditions or index boundary rejections. | Relying on array indices (fails due to closure length checks and index shifting); Storing active page index in local state. |
| **Pointer Capture on Canvas Drawing (`setPointerCapture`) (Audit 20)** | Invoking `canvas.setPointerCapture(e.pointerId)` on `pointerdown` and releasing on `pointerup`, `pointercancel`, and `lostpointercapture` ensures that dragging and releasing the cursor outside the canvas boundaries reliably finalizes and commits the stroke, preventing stuck drawing states or dropped strokes. | Window-level mouse listeners (fragile, leaks event listeners if unmounted); Ignoring pointer release outside bounding box (Audit 20 defect). |
| **Normalized Vector Stroke Model & DPI Scaling (Audit 21)** | Migrating from lossy bitmap snapshots to normalized $[0, 1]$ vector points (`StickkStroke`) scaled by `devicePixelRatio` and canvas dimensions enables crisp, high-DPI rendering and eliminates pixel truncation/distortion when resizing or shrinking/expanding the widget. | Storing raw canvas pixel data URLs (exceeds localStorage quota, blurry on high-DPI displays, crops on resize); SVG paths (higher parsing overhead). |
| **Monotonic Render Token Guard for Stale Async Images (Audit 21)** | Incrementing a monotonic integer `renderTokenRef.current` on every note navigation or canvas resize and checking `if (token !== renderTokenRef.current) return;` inside image load callbacks guarantees that rapid note switching never paints a previous note's doodle onto the newly selected note. | Canceling image loads via `img.src = ''` (unreliable across browser engines); Allowing stale loads (Audit 21 race condition). |
| **Dual-Layer Persistence & Schema Validation (Audit 22)** | Integrating Stickk persistence into Electron's `DurableStore` with atomic write and `.bak` backup, complemented by local backup migration and IPC schema validation (`validateStickkPagesPayload`), protects notes from storage quota crashes and corruption. | Storing 5MB+ base64 strings in `localStorage` alone (crashes browser storage quota); Blind JSON writes without schema validation. |
| **Soft-Delete Trash Stack & Undo Mechanism (Audit 23)** | Marking torn or discarded notes with `deletedAt: string` and pushing to a soft-delete trash stack (`trash: StickkPage[]`) provides instant recovery via a floating Undo toast (`Ctrl+Z` shortcut) and implements a 30-day retention pruning policy capped at 50 items. | Immediate destructive deletion without recovery (Audit 23 defect); Storing full note copies on every keystroke (excessive memory). |
| **Docked Bottom Action Buttons & Layout Sizing** | Setting `stickk: { width: 312, height: 510 }` in `electron/displayBounds.cjs` and enforcing `flex-shrink: 0`, `margin-top: auto` on `.controls-row` with elastic flexbox in `.sketchpad-content-box` guarantees that the "Flip Next Page ➔", Tear, Ruled, and Clear buttons are 100% visible with zero clipping on any monitor. | Keeping window height at 480px (cuts off bottom buttons when toolbars and font selectors are open); Fixed-height content boxes (causes scrollbars or clipping). |

---

## 8. Deterministic Game Turns & Series Reset Decisions (W07)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Pure Game Logic & Minimax Extraction (`playzLogic.ts`)** | Extracting board evaluation, win condition detection, Minimax AI, and 5-round series calculations into a pure module with zero DOM/React dependencies allows deterministic unit testing and guarantees that Hard AI is mathematically unbeatable. | Leaving game logic coupled inside React component (difficult to test race conditions and Minimax across hundreds of game permutations). |
| **Monotonic Game Generation Token (`gameGenRef`) (Audit 24)** | Incrementing a monotonic integer token whenever a game is reset, round changes, or mode switches ensures that any in-flight asynchronous timer callbacks (`setTimeout`, `requestAnimationFrame`) verify `if (token !== gameGenRef.current) return;` and immediately drop stale actions. | Relying solely on `clearTimeout` handles (prone to missed handles during unmount or rapid multi-clicks); Allowing stale moves (Audit 24 defect). |
| **Explicit Async Handle Cancellation (Audit 24)** | Centralizing `abortAllPendingAsync()` to explicitly clear `cpuTimerRef`, `resultTimerRef`, `confettiAnimRef`, and `brushFrameRef` on reset, mode change, new round, and component unmount prevents background CPU moves, audio fanfares, and memory leaks. | Fire-and-forget timeouts (Audit 24 defect); Ignoring unmount cleanup. |
| **State-Driven CPU Turn & Input Lock (Audit 24)** | Adding `isCpuThinking` state and disabling cell buttons during CPU thinking locks the board so the user cannot click cells while the CPU is calculating, preventing double moves and race conditions. | Leaving cells interactive during CPU thinking; Unsynchronized state flags. |
| **Authoritative 5-Round Series Rules & Draw Accounting (Audit 25)** | Codifying 5-round series rules: max 5 rounds; draws tracked explicitly; first to majority (3 wins) clinches early; ties after 5 rounds declared an even series. Synchronizing UI text to "5-Round Series · First to 3 or most wins!". | Ambiguous draw rules (Audit 25 defect); Endless rounds until 3 wins. |
| **Clean CPU Opening Moves on Even Rounds** | In rounds 2 and 4 (where starting player alternates to 'O'), scheduling CPU move on a clean, empty board with generation token validation ensures exactly one legal opening move is made. | Stale closures referencing previous board state (Audit 24 defect); Always letting human player start first. |

---

## 9. Accessibility & Visual Consistency Decisions (W08)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Single Source of Widget Dimensions (`widgetDimensions.json`) (Audit 33)** | Extracting `BASE_WIDGET_DIMS` to `src/utils/widgetDimensions.json` shared directly by `electron/displayBounds.cjs` and `src/utils/widgetsCatalog.ts` eliminates dimension discrepancies between the manager catalog metadata and the native Electron window defaults. | Maintaining separate duplicate dimension definitions (causes drift, e.g. 340x515 vs 312x505); Hardcoding dimensions in multiple places. |
| **Locally Bundled Handwriting Fonts & Offline Support (Audit 34)** | Downloading all 5 handwriting fonts (`caveat.woff2`, `comic-neue.woff2`, `gloria-hallelujah.woff2`, `pacifico.woff2`, `permanent-marker.woff2`) into `public/fonts/`, documenting open-source licenses in `public/fonts/LICENSE.txt`, adding local `@font-face` rules in `src/index.css`, and removing remote Google Fonts links from `index.html` eliminates external font requests and allows cold-cache offline launch. | Loading Google Fonts over CDN (violates offline and privacy requirements, causes layout shifts on slow connections); System font fallbacks only (degrades handwritten note aesthetic). |
| **Accessible Dialog Semantics, Focus Trap & Focus Restoration (Audit 31)** | In `WidgetDetailModal.tsx`, moving `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-widget-title"`, and `aria-describedby="modal-widget-desc"` onto the modal dialog itself, capturing initial focus, cycling focus within interactive controls via Tab/Shift+Tab, closing on Escape, and restoring focus to the triggering element upon close ensures WCAG AA compliance and smooth screen reader navigation. | Dialog attributes on backdrop (incorrect ARIA tree); Trapping focus without restoring to trigger button (disorients keyboard/screen reader users). |
| **Semantic Interactive Cards & Visible Keyboard Focus (Audit 31)** | Adding `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` (Enter/Space) to `.bento-card` and `.catalog-card`, combined with distinct 2px `:focus-visible` outlines and inner button event stop-propagation, allows full keyboard navigation of the manager catalog. | Clickable `<div>` without keyboard handlers or roles (inaccessible to keyboard and assistive technology users); Native `<button>` wrapping whole cards (nested buttons violate HTML specification). |
| **Respecting System Reduced-Motion Preference in JS & CSS (Audit 32)** | Checking `isReducedMotion()` (`prefers-reduced-motion: reduce`) before initiating multi-second canvas particle physics in Playz confetti, and skipping multi-frame 3D flip/tear delays in Stickk ensures that users with vestibular sensitivities or reduced-motion preferences experience immediate, non-disruptive transitions without breaking interactions. CSS animations and transitions are clamped to 0.01ms. | CSS-only reduced motion (fails to suppress JavaScript canvas particle loops and requestAnimationFrame updates); Disabling interactions or features entirely in reduced-motion mode. |
| **Removal of Fake Social Proof & Character Mojibake (Audit 33)** | Replacing fake star ratings (`4.9 ★`) and user numbers (`12.4k users`) in catalog cards and modal dialogs with authentic desktop dimensions (`312×505px`) and live desktop running status (`Running on Desktop` / `Ready to Pin`), while cleaning up corrupted UTF-8 characters (`FLOWCUS â€” ...` to `FLOWCUS — ...`), restores credibility and typographic clarity. | Retaining unverified marketing figures (misleading to users); Leaving corrupted characters in stylesheet headers. |

---

## 10. CI, Strict Typing & Resource Framework Decisions (W09)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Script Separation in `package.json` (Audit 30)** | Providing dedicated scripts for `"typecheck": "tsc --noEmit"`, `"lint": "node scripts/lint.cjs"`, `"test": "tsx --test tests/**/*.test.ts"`, `"build": "vite build"`, and `"package:win": "npm run build && electron-builder --win --x64 --dir"` allows deterministic, granular CI validation and prevents test/build masking. | Combining type checking into build script only (masks type errors during fast iteration); Omitting dedicated lint step. |
| **Reproducible Windows CI Workflow (`.github/workflows/ci.yml`) (Audit 30)** | Pinning CI to `windows-latest`, `node-version: 22`, and `npm ci` with `package-lock.json` ensures that every commit is tested in an environment matching target Windows desktop users with zero dependency drift. Steps execute sequentially: `typecheck` -> `lint` -> `test` -> `build` -> `package:win`. | Ubuntu runners (fails to validate Windows-specific Electron packaging, paths, and atomic replacement); `npm install` without lockfile (causes silent dependency drift). |
| **TypeScript Strict Mode & Explicit Bridge Contracts (`src/types.ts`) (Audit 30)** | Enabling `"strict": true` in `tsconfig.json` across both `src` and `tests` directories, defining explicit typed contracts (`ElectronAPI`, `AppSettings`, `StoredTimerData`, `SessionSnapshot`), and augmenting the global `Window` interface permanently eliminates untyped `(window as any).electronAPI` calls and exposes return-type mismatches (`{ success: boolean }` vs boolean). | Retaining `(window as any)` bridge calls (Audit 30 defect, prevents compiler verification of IPC boundaries); Adding blanket `@ts-ignore` suppressions (prohibited). |
| **Zero-Dependency Project Linter (`scripts/lint.cjs`) (Audit 30 & 36)** | Creating a standalone Node.js linter enforcing UTF-8 character integrity (no mojibake `\uFFFD`), absence of unaudited `@ts-ignore`/`@ts-nocheck`, typed IPC bridge usage, absence of `debugger;` statements, and valid JSON structure across configuration and metadata files guarantees code hygiene without adding heavy external linter packages. | Bulky ESLint installation with dozens of transitive peer dependencies (risk of lockfile conflicts or registry network failures); Manual code review only (error-prone). |
| **Diagnostic Leak Hook in Electron Main (`--perf-leak-test`) (Audit 36)** | Implementing a non-intrusive diagnostic switch in `electron/main.cjs` that programmatically opens and closes widgets across 10 rapid cycles and guards against premature application exit (`process.argv.includes('--perf-leak-test')`) allows automated leak investigation against the actual packaged production binary (`Uwidgets.exe`). | In-memory synthetic simulation (fails to exercise Chromium renderer, GPU process, or window handle destruction); Relying on manual clicking only. |
| **Empirical Resource Measurement Suite (`scripts/measure-performance.cjs`) (Audit 36)** | Measuring launch latency, child process count, working set memory (summing all main, renderer, and GPU processes via PowerShell `Get-Process`), private memory bytes, and CPU utilization across 10 distinct runtime scenarios produces a reproducible, auditable performance profile (`docs/implementation/performance-report.json`) without invented figures. | Estimating numbers theoretically; Profiling only the main process (ignores multi-process Chromium architecture); Disregarding background tray states. |
| **Provisional Performance Budgets Based on Measured Baselines (Audit 36)** | Establishing provisional budgets reflecting real-world Electron 44 / Chromium multi-process baselines: Cold launch latency < 3500ms; Single widget working set < 380 MB; All widgets concurrent < 750 MB; Idle CPU < 1.0%; Active ticking / drawing CPU < 3.0%; 10-cycle open/close net memory drift < 25 MB. | Arbitrary mobile-web targets (unrealistic for multi-process desktop Electron); Having no performance budgets. |

---

## 11. Release Candidate, Governance & Delivery Decisions (W10)

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **Authoritative NSIS User Data Retention (`deleteAppDataOnUninstall: false`) (Audit 35 & 29)** | Configuring `deleteAppDataOnUninstall: false` in `package.json` NSIS block guarantees that running the Windows uninstaller removes executable binaries from `%LOCALAPPDATA%\Programs\uwidgets` while preserving user state in `%APPDATA%\uwidgets`. Users upgrading or reinstalling retain all tasks, notes, vector doodles, and custom settings. | Destructive uninstallation wiping `%APPDATA%` (causes irreversible data loss for users updating versions); Silent in-place overwriting without retention guarantees. |
| **Documented Manual Upgrade Process & Rejection of Fake Auto-Updater (Audit 29)** | In the absence of an active code signing certificate and certified update server, claiming an automated updater path based solely on `latest.yml` is false. Documenting a manual upgrade workflow (quit -> installer replace -> relaunch with automatic migration) provides an honest, reliable path for release candidate testing. | Faking an auto-update server or leaving update behavior unspecified (Audit 29 defect); Purchasing external commercial signing credentials during development (prohibited). |
| **Lockfile-Preserved Dependency Alignment & Triage (Audit 35)** | Online dependency audit revealed 7 CVEs confined strictly to devDependencies (`wait-on`, `electron-builder`). Forced upgrades (`audit fix --force`) would downgrade `electron-builder` to v25.1.0, breaking Electron 44 compatibility. Dormant AI Studio dependencies (`@google/genai`, `dotenv`, `express`) are retained in `package.json` to maintain 100% offline sync with `package-lock.json` while tree-shaking ensures 0 bytes enter the bundle. | Blindly executing `npm audit fix --force` (breaks build pipeline); Deleting lockfile entries without network access to npm registry (fails `npm ci`). |
| **Factual Licensing & Explicit Ownership Disclosure (Audit 35)** | Providing standard MIT License text for open-source project code while explicitly noting that formal corporate entity ownership and commercial trademark registration remain open decisions for stakeholders avoids inventing fictional corporate owners. | Inventing a fictitious publisher company; Leaving the repository without root license and documentation. |
| **Dual Release Packaging Outputs (`package:win` & `dist:win`)** | Maintaining both unpacked directory output (`win-unpacked/Uwidgets.exe`) for rapid developer testing and monolithic NSIS setup installer (`Uwidgets-Setup.exe`) for end-user installation ensures flexibility across CI, portable testing, and desktop distribution. | Providing only unpacked directory (no desktop shortcut/uninstaller support); Providing only NSIS installer (slower developer iteration). |





