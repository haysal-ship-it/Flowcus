# Uwidgets audit and implementation plan

11 November 2026 | Project: Flowcus-main / Uwidgets

## Assessment and scope

Uwidgets has a substantial implementation: React/TypeScript manager, Flowcus timer/tasks, Playz game, Stickk notes/drawing, Electron floating windows, tray integration and Windows packaging. It needs reliability work before public release.

This audit covers source, configuration, storage, desktop lifecycle, security boundaries and delivery, plus official-source competitor research. It includes TypeScript checking and a build attempt. It does not certify the installed app: native interaction, accessibility, performance, installation and upgrade scenarios remain untested. Confirmed means visible in code; risk means runtime reproduction is needed; gap means no implementation was found. Existing uncommitted changes were preserved; no fixes were applied.

## Check results

- npm run lint: TypeScript checking passed. This command is tsc --noEmit, not a behavioral or ESLint check.
- npm run build: failed loading vite.config.ts. Errors include spawn EPERM in Vite resolution and an unloadable Tailwind Oxide native module / invalid UTF-8. Investigate both Windows environment restrictions and config bundling; root cause is unresolved.
- npm audit --offline --json: returned zero advisories. This is not a current online vulnerability assessment.
- No test suite or CI workflow was found. Existing release binaries do not establish that current source builds correctly.

## Issue register

P0 blocks release; P1 should be fixed before public beta; P2 is polish or maintainability. These are delivery priorities, not security severity scores. File references are relative to the project root.

| ID | Priority / evidence | Problem and location | Proposed solution |
|---|---|---|---|
| 01 | P0 confirmed | manager/WidgetDetailModal.tsx mounts real widgets as previews, with actual storage and WidgetChrome desktop controls. Preview actions can alter real notes/tasks and close or pin desktop widgets. | Explicit preview mode using in-memory fixtures, no production storage, timer side effects or desktop APIs. |
| 02 | P0 risk | FlowcusWidget.tsx can run in preview and desktop windows concurrently. Instances independently persist timers; timer state is not synchronized through storage events. Duplicate completion credit and competing writes are possible. | One authoritative session/task service; renderers subscribe. Use unique session IDs and exactly-once completion. |
| 03 | P0 confirmed behavior | utils/taskStorage.ts performDailyReset clears all tasks, focus totals and timer at midnight, including unfinished work. This is intentional in comments but destructive for a general task tool. | Define retention policy; archive history and carry unfinished tasks. Preserve running sessions across midnight. Make discard behavior explicit if retained. |
| 04 | P1 confirmed | loadTimerFromStorage credits elapsed sessions on recovery but does not complete the task as the live timer does. Task, minutes and timer writes are separate. | One idempotent completion transaction for live and recovered sessions. |
| 05 | P1 confirmed | FlowcusWidget handleToggleFocus changes task/initial duration during a session without replacing its old deadline. Completion uses the new duration for credit. | Bind sessions to their starting task/duration or require an explicit restart/transfer. |
| 06 | P1 confirmed | TasksView handleAddSubmit invokes parent add, which closes the form, then schedules a delayed toggle that can reopen it. | Explicit close callback; one owner of form closing and transition timing. |
| 07 | P1 risk | Flowcus state updater functions contain other setters and storage writes. Timer completion assigns nextCandidateId inside a task updater and consumes it outside. | Pure reducer returning a complete task/session snapshot, followed by persistence. |
| 08 | P0 confirmed | electron/main.cjs manager close handler prevents closing while widgets exist, even after app.isQuitting is set. Tray Quit can be interrupted. | Bypass hide-to-tray on explicit app shutdown; verify every process exits. |
| 09 | P1 risk | Widget closed callbacks set saved open state false during teardown, potentially erasing the startup restore set. | Separate desired restore state from current window liveness; preserve restore intent on app quit. |
| 10 | P1 confirmed | ManagerSettings labels a toggle Minimize to System Tray but writes startMinimized; main uses it for startup visibility. Close behavior ignores the toggle. | Separate closeToTray and startMinimized settings with correct labels and behavior. |
| 11 | P1 confirmed | alwaysOnTopDefault is saved but never consulted in widget creation. | Resolve explicit per-widget pin override, otherwise global default. |
| 12 | P1 confirmed | Saved scale is only applied to windows already open. New windows never apply it; Customize initializes its control to 100%. | Shared settings source; apply zoom before showing every new window; synchronize both settings screens. |
| 13 | P1 confirmed | Saved coordinates are restored without monitor/work-area checks; resized dimensions are not saved. | Persist validated bounds, clamp to available monitors, handle display changes and provide Reset positions. |
| 14 | P1 confirmed | WidgetChrome loads pin state once; state broadcasts reach only the manager. Pin icon can become stale. | Broadcast authoritative state to all windows and subscribe in widget chrome. |
| 15 | P1 confirmed | Global soundEffects preference is disconnected from audio controllers, which use separate localStorage mute keys. | One global sound preference with explicit per-widget overrides and live propagation. |
| 16 | P1 confirmed | ManagerCustomize accent updates CSS variables only in its own document and is not persisted. | Persist theme tokens and broadcast them to all windows on change and launch. |
| 17 | P1 risk | Electron state JSON has no schema validation/default merge; saveState overwrites the only copy directly. | Versioned schema, migration, atomic replacement and last-good backup. |
| 18 | P1 confirmed | Manager launch/pin/settings actions display optimistic success without awaiting IPC results; errors are swallowed. | Pending states, awaited outcomes, reconciliation and actionable failure messages. |
| 19 | P1 confirmed | Stickk handleAddNewPage calls goToPage(pages.length), but its old closure rejects that index. New note is not selected. | Update page list and active page ID together or navigate after commit. |
| 20 | P1 confirmed gap | Stickk canvas lacks pointer capture, cancel and lost-capture handling. Release outside canvas may skip saving and leave drawing active. | Capture pointer and finish/save strokes for all termination paths. |
| 21 | P1 risk | Canvas resizing copies pixels without scaling, so shrinking can crop; backing resolution ignores devicePixelRatio. Asynchronous image loads lack stale-page guards. | Stable logical drawing representation, DPI-aware rendering and guarded restore operations. |
| 22 | P1 confirmed gap | Stickk accepts any nonempty array as notes; base64 drawings share localStorage with text and full arrays save on edits. Failures only log. | Validate schemas, use blob/IndexedDB or managed file storage, debounce writes, show save status and support export/backup. |
| 23 | P1 confirmed gap | Tearing notes permanently deletes content with no undo/trash. | Undo plus recoverable deletion retention. |
| 24 | P1 risk | Playz CPU timers, result timers and animation callbacks are not canceled on reset/mode change/unmount. CPU-started rounds use closures from the old inactive round. | Cancel handles, use a game-generation token and schedule CPU turns from current authoritative state. |
| 25 | P2 inconsistency | Playz says first to three wins but also ends at round five, including draws. Game state is not retained on close. | Define series/draw rules and persistence expectations; align copy and logic. |
| 26 | P0 confirmed security gap | IPC has no sender validation or payload schema. settings:set accepts arbitrary keys; IDs, height and scale are unchecked. No exploit is asserted. | Validate trusted sender/window roles, allowlisted keys/IDs, types and finite numeric ranges. |
| 27 | P1 confirmed security gap | Navigation/popup protections apply only to manager. CSP allows inline scripts and any HTTPS script. Manager URL checks use loose prefixes and allow file navigation. | Shared strict navigation policy, parsed origins/exact packaged content, external-scheme allowlist and tighter CSP. |
| 28 | P1 observed blocker | Production build failed during configuration loading. | Reproduce on clean Windows using chosen lockfile; inspect process restrictions, native binding handling and supported Vite config-loading modes. |
| 29 | P1 delivery gap | Windows signing is disabled. No app updater implementation found; latest.yml is not proof of an update path. | Signed releases plus tested updates or documented manual upgrades; verify data retention and rollback. |
| 30 | P1 confirmed gap | No CI/tests; lint is only tsc; strict mode absent; desktop API frequently typed any. | Focused domain/IPC tests, Windows CI, actual linting and incremental strict typing with a typed bridge. |
| 31 | P1 confirmed gap | Detail dialog has Escape and dialog roles but no accessible name, focus trapping, initial focus or restoration. Catalog cards use div click handlers. | Complete dialog keyboard behavior and semantic interactive elements; verify with Narrator. |
| 32 | P1 confirmed gap | Reduced-motion CSS exists but JS confetti and note flip delays do not consult the preference. | Apply motion preference to JS effects and state timing too. |
| 33 | P2 confirmed | Catalog ratings/downloads are hardcoded; native/catalog dimensions differ. UI strings include literal question marks and damaged characters. | Remove unsupported social proof, use one dimensions registry and deliberate copy/SVG icons. |
| 34 | P2 confirmed | Handwriting fonts depend on Google Fonts network requests. | Bundle licensed assets and verify first launch offline with cold cache. |
| 35 | P2 confirmed gap | No root README/license/support documentation; multiple lockfiles; AI Studio boilerplate and unused-looking dependencies; generated releases appear in Git status. | Document setup/data/lifecycle/release policy, clarify licensing, choose package manager, verify dependency use and move release outputs to release pipeline. Preserve current local changes. |
| 36 | P2 maintainability gap | Large CSS and widget components mix domain logic, storage and rendering; all widget routes share static imports. No measured resource budget. | Extract logic/shared tokens, scope styles, consider lazy routes and profile packaged app before optimizing. |

## Research: Windows widget applications

Research checked 11 November 2026; documentation comparison, not hands-on benchmarks.

| Reference | Verified context | Implication for Uwidgets |
|---|---|---|
| Rainmeter | Official site/manual describe customizable desktop skins, community extensions, notes/tasks, launching and media controls; low resource use is a stated product emphasis. | Placement reliability, customization and measured background resource use are core expectations. A small curated suite is a reasonable differentiation. |
| Rainmeter 5.0 changes | Official release-candidate notes describe per-monitor DPI, zoom and skipping drawing hidden skins. These are RC features, not a blanket claim about stable versions. | Include mixed-DPI and hidden-window resource checks in acceptance criteria. |
| BeWidgets | BeXCool's developer site confirms custom desktop widgets, color changes, Windows 11-inspired interface and Store availability. | Personalization must affect real widgets immediately and persist. |
| Widget Launcher | Microsoft Store listing resolves, but its description requires JavaScript and could not be verified in the text browser. | Include in follow-up hands-on comparison; no feature-level claims used here. |
| Microsoft Windows Widgets | Official documentation describes the Widgets Board host and focused, glanceable, predictable widgets with size options. | Uwidgets currently uses independent Electron windows. Widgets Board integration is a separate technical feature, not current behavior. |

Recommended positioning: a calm desktop suite for tasks, focus and quick notes, with an optional short-break game. Prioritize durable data, reliable desktop behavior and coherent settings. Add layout profiles, reset positions and global show/hide after stabilization. Defer marketplace, accounts, AI and additional widget categories until existing tools pass release gates.

Official sources:
- https://www.rainmeter.net/
- https://docs.rainmeter.net/manual/
- https://www.rainmeter.net/changes-5.0/
- https://bexcool.com/
- https://apps.microsoft.com/detail/9wzdncrdqfbt
- https://learn.microsoft.com/en-us/windows/apps/design/widgets/
- https://www.electronjs.org/docs/latest/tutorial/security (IPC/navigation security guidance)

## Phased implementation plan

Planning ranges assume one experienced developer and are not delivery commitments. Re-estimate after baseline/build investigation and state redesign.

| Phase | Work | Dependency | Effort | Exit gate |
|---|---|---|---|---|
| 0: Baseline | Preserve current changes, choose lockfile, reproduce clean Windows build/package, document environment and expected behavior. | None | 1–2 days | Fresh checkout can typecheck/build/package reproducibly. |
| 1: Data and lifecycle | Isolate previews; authoritative session service; idempotent completion; retention policy; Quit/restore; validated IPC and persisted state. | Phase 0; retention decision | 4–7 days | Previews cannot affect real data; exactly one session credit; Quit works; restart restores intended windows/data. |
| 2: Settings/windows | Correct tray/startup semantics, shared pin/scale/accent/sound, state broadcasts, awaited outcomes and monitor-safe bounds/reset. | Phase 1 foundation | 3–5 days | Settings agree across windows, apply immediately and survive reopen/restart. |
| 3: Widget workflows | Fix task form and session switching; note creation/pointers/canvas/saving; undo/export; game callback cancellation and series rules. | Phases 1–2 | 4–7 days | Focused automated checks and native edge-case scenarios pass. |
| 4: Accessibility/polish | Dialog/keyboard/Narrator, JS reduced motion, copy/fonts/metadata, shared tokens, performance profiling. | Phase 3 | 3–5 days | Offline launch, DPI/min-size and accessibility checks pass; measured performance budgets documented. |
| 5: Release | Shared navigation/CSP, online dependency review, Windows CI, signed distribution/update policy, upgrade/uninstall checks and support docs. | Previous gates | 2–4 days plus external setup | Versioned candidate builds from clean checkout and upgrades without data loss. |

Total planning range: 17–30 developer days plus signing/distribution setup. Implement in small reviewable changes. Begin with build baseline, isolated previews and explicit Quit/restore behavior; then session ownership and retention.

## Required verification matrix

1. Previews: open all previews with live widgets; modify preview data and controls; real storage/windows must remain unchanged.
2. Sessions: start/pause/resume/reset; change/delete/complete task; close/reopen after expiry; sleep/wake; midnight; concurrent views; credit exactly once.
3. Tasks: submit and wait past animation delay; cancel; empty day; corrupted/old state recovery.
4. Notes: create/select new page; draw/erase; release outside canvas; rapid page changes; shrink/grow; restart; save failure; undo/export/import.
5. Games: CPU-started rounds; reset/mode change while CPU thinks; unmount during effects; drawn series; check Hard AI across reachable board states.
6. Desktop: manager close with zero/one/all widgets; tray Quit; second instance; Windows login; start minimized; explicit removal versus quit restoration.
7. Displays: multi-monitor, unplug monitor, negative coordinates, Windows DPI 100/125/150/200%, app scale 85/100/115%, small work area.
8. Accessibility: keyboard, visible focus, Narrator names/status, dialog focus, contrast, text scaling and reduced motion.
9. Distribution: install/upgrade/uninstall/reinstall, offline cold launch, signature, supported Windows versions and data-retention policy.
10. Security: invalid IPC keys/IDs/types/nonfinite dimensions/scales, untrusted sender/navigation/popup requests and current registry-backed dependency audit.
11. Performance: packaged manager/each widget/all widgets; idle/active/hidden states; CPU/RAM, launch latency and repeated open/close leak trends on named hardware.
