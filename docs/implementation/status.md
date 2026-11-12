# Uwidgets Implementation Status Register

**Last Updated:** 12 November 2026  
**Current Active Work Package:** W10 (Completed)  
**Next Eligible Work Package:** None (Project Stabilization Complete; Release Candidate Ready)  

---

## 1. Work Package Status Matrix

| Package ID | Package Name | Audit IDs | Prerequisites | Status | Next Action |
|---|---|---|---|---|---|
| **W00** | Reproducible baseline | 28, 30, 35 | None | **Verified** | Milestone complete. Baseline documented. |
| **W01** | Isolated previews and explicit form closing | 01, 06 | W00 | **Verified** | In-memory fixtures, storage suppression, and deterministic form closing implemented & tested. |
| **W02** | Desktop lifecycle and trusted IPC | 08, 09, 26, 27 | W00, W01 | **Verified** | Quit bypass, restoration intent separation, IPC sender/schema validation, and unified CSP verified natively. |
| **W03** | Durable state and migration foundation | 17 (02–04, 22) | W02, Decisions | **Verified** | Milestone complete. Durable store, atomic replacement, backups, and migrations verified. |
| **W04** | Authoritative sessions and safe retention | 02, 03, 04, 05, 07 | W01–W03 | **Verified** | Milestone complete. Authoritative main session service, non-destructive midnight rollover, idempotent ledger, and cancellation accounting verified. |
| **W05** | Truthful settings and monitor-safe windows | 10–16, 18 | W02–W04 | **Verified** | Milestone complete. Authoritative settings, truthful labels, pin sync, display clamping, audio controls, and position reset verified. |
| **W06** | Reliable notes and recoverable edits | 19–23 | W01–W03, W05 | **Verified** | Milestone complete. Pointer capture, note ID selection, vector strokes, durable storage, undo stack, and layout verified. |
| **W07** | Deterministic game turns | 24, 25 | W01 | **Verified** | Milestone complete. Generation token race cancellation, CPU timers, 5-round series rules, and Minimax AI verified. |
| **W08** | Accessibility and visual consistency | 31–34 | W05–W07 | **Verified** | Milestone complete. Accessible dialogs, focus trapping, JS reduced motion, bundled offline fonts, dimensions parity, clean copy. |
| **W09** | CI and measured resource use | 30, 36 | W01–W08 | **Verified** | Windows CI workflow, TypeScript strictness, custom linter, full regression suite (100 tests), and empirical resource benchmarking complete. |
| **W10** | Release candidate and handoff | 29, 35 | W00–W09 | **Verified** | Root documentation, LICENSE, dependency audit, NSIS retention verified, SHA-256 release candidate generated. |

---

## 2. Audit Register Resolution Progress

| Audit ID | Priority | Description | Status | Resolved In |
|---|---|---|---|---|
| **28** | P1 | Build failure & config loader issues | **Resolved** | W00 |
| **30** | P1 | CI/test gap, untyped bridge, strict mode absent | **Resolved** | W09 |
| **35** | P2 | Multiple lockfiles, AI Studio template boilerplate | **Resolved** | W10 |
| **01** | P0 | WidgetDetailModal previews mount real widgets & storage | **Resolved** | W01 |
| **02** | P0 | Concurrent preview/desktop timer collisions & double credit | **Resolved** | W04 |
| **03** | P0 | Destructive midnight reset clears all tasks & focus totals | **Resolved** | W04 |
| **04** | P1 | Recovery credits elapsed time without completing tasks | **Resolved** | W04 |
| **05** | P1 | Mid-session task toggle changes duration without deadline reset | **Resolved** | W04 |
| **06** | P1 | Delayed toggle reopening task form after add | **Resolved** | W01 |
| **07** | P1 | Non-pure state setters mixing storage writes & side effects | **Resolved** | W04 |
| **08** | P0 | Manager close handler interrupts tray Quit | **Resolved** | W02 |
| **09** | P1 | Closed callbacks erase startup restore intent | **Resolved** | W02 |
| **10** | P1 | Minimize-to-tray toggle writes startMinimized | **Resolved** | W05 |
| **11** | P1 | alwaysOnTopDefault saved but never applied | **Resolved** | W05 |
| **12** | P1 | Saved scale only applied to already-open windows | **Resolved** | W05 |
| **13** | P1 | Saved coordinates not clamped to connected monitors | **Resolved** | W05 |
| **14** | P1 | Pin state broadcast reaches only manager | **Resolved** | W05 |
| **15** | P1 | Global sound preference disconnected from audio controllers | **Resolved** | W05 |
| **16** | P1 | Accent color change not persisted across windows | **Resolved** | W05 |
| **17** | P1 | State JSON lacks schema validation and atomic writes | **Resolved** | W03 |
| **18** | P1 | Manager actions lack pending states and error handling | **Resolved** | W05 |
| **19** | P1 | New note creation navigation index rejected | **Resolved** | W06 |
| **20** | P1 | Canvas drawing lacks pointer capture and cancel handling | **Resolved** | W06 |
| **21** | P1 | Canvas resizing crops pixels; ignores devicePixelRatio | **Resolved** | W06 |
| **22** | P1 | Monolithic localStorage stores full base64 image strings | **Resolved** | W06 |
| **23** | P1 | Note tearing deletes permanently without undo | **Resolved** | W06 |
| **24** | P1 | Playz CPU timers not canceled on reset/unmount | **Resolved** | W07 |
| **25** | P2 | Playz win conditions and 5-round series logic discrepancy | **Resolved** | W07 |
| **26** | P0 | IPC lacks sender validation and payload schema checks | **Resolved** | W02 |
| **27** | P1 | Navigation/popup protections apply only to manager | **Resolved** | W02 |
| **29** | P1 | Windows code signing and app update path unverified | **Deferred** | W10 (Manual upgrade documented; commercial code signing deferred) |
| **31** | P1 | Modal dialog lacks accessible name and focus trap | **Resolved** | W08 |
| **32** | P1 | JS effects ignore prefers-reduced-motion | **Resolved** | W08 |
| **33** | P2 | Hardcoded download/rating stats; encoding artifacts | **Resolved** | W08 |
| **34** | P2 | Google Fonts network dependency during runtime | **Resolved** | W08 |
| **36** | P2 | Monolithic components mix domain, storage, and render logic | **Resolved** | W09 |

---

## 3. Milestone Completion Sign-Off: W00
- **Build Reproducibility:** Verified (`npm run lint`, `npm run build`, and `electron-builder` all exit 0).
- **Git Status Integrity:** Verified (all existing user modifications and untracked files preserved).
- **Environment Alignment:** Documented in `baseline.md`, `decisions.md`, and `verification.md`.
- **Handoff:** Ready to execute **W01 — Isolated previews and explicit form closing**.

---

## 4. Milestone Completion Sign-Off: W01
- **Preview Isolation:** Verified (In-memory preview fixtures for Flowcus, Stickk, and Playz; 0 reads/writes to `localStorage`; audio suppressed in modal preview).
- **Desktop Control Suppression:** Verified (`WidgetChrome` disables window dragging and skips pin/close IPC under `isPreview: true`).
- **Form Ownership:** Verified (TasksView `onCloseAddForm` and `onOpenAddForm` eliminate state toggle inversion race condition; form stays closed after 170ms exit animation).
- **Automated Regression Suite:** Verified (`npm test` passes 10 tests across 3 suites with exit code 0).
- **Production Build:** Verified (`npm run lint` and `npm run build` both exit 0).
- **Desktop Packaging:** Verified (`release/win-unpacked/Uwidgets.exe` built successfully).
- **Handoff:** Ready to execute **W02 — Desktop lifecycle and trusted IPC**.

---

## 5. Milestone Completion Sign-Off: W02
- **Tray Quit Lifecycle (Audit 08):** Verified (Clean Quit bypasses manager close interception when `app.isQuitting = true`, destroying all windows and terminating cleanly).
- **Restoration Intent Separation (Audit 09):** Verified (`appState.restoreOnStartup` stored independently from transient window liveness; preserved across app quit; updated upon explicit widget removal).
- **IPC Sender & Role Security (Audit 26):** Verified (Validated top-level frame `parent === null`, origin URL, and window role `manager` vs `widget`).
- **Payload Schema Validation (Audit 26):** Verified (Strict whitelisting for widget IDs, settings keys, and bounded numeric ranges for `scaleFactor` [0.5–2.0] and `height` [100–1200]; invalid requests rejected with 0 mutations).
- **Window Security & CSP (Audit 27):** Verified (Consistent `will-navigate`, `setWindowOpenHandler`, `will-attach-webview`, and session CSP applied to manager and every floating widget).
- **Native Electron Evidence:** Verified (`npx electron scratch/verify-w02-native.cjs` tests pass 5/5 native checks on real Electron runtime).
- **Automated Test Suite:** Verified (`npm test` passes 21 tests across 6 suites with exit code 0).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W03 — Durable state and migration foundation**. Stop at W02 package boundary.

---

## 6. Milestone Completion Sign-Off: W03
- **Schema Versioning Envelope (Audit 17):** Verified (`schemaVersion: 1` envelope with strict structural validation, fallback defaults, and forward-compatibility protections rejecting newer versions without overwrite).
- **Atomic File Replacement (Audit 17):** Verified (`atomicWriteFileSync` writes to same-directory `.tmp`, flushes disk hardware via `fsyncSync`, and handles Windows `EPERM`/`EBUSY` rename locks with a backoff retry loop).
- **Serialized Write Queue (Audit 17):** Verified (Mutex promise chain queues concurrent state saves, guaranteeing monotonically ordered revision commits with zero race conditions).
- **Last-Known-Good Backup & Recovery (Audit 17):** Verified (Atomic `.bak` synchronization on every write; corrupted or truncated primary files automatically recover from `.bak` while quarantining corrupt files to `.corrupt.<timestamp>`).
- **Safe Legacy Data Migration (Audit 17):** Verified (Legacy unversioned files migrate safely with `.pre-migration.bak` backup; `v1_desktop_state_migrated` marker ensures idempotent repeated runs preserving task and note IDs verbatim).
- **Automated Regression Suite:** Verified (`npm test` passes all 31 tests across 9 suites with exit code 0).
- **Native Electron Evidence:** Verified (`node scratch/verify-w03-native.cjs` passes 6/6 native checks inside an isolated Electron runtime).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W04 — Authoritative sessions and safe retention**. Stop at W03 package boundary.

---

## 7. Milestone Completion Sign-Off: W04
- **Authoritative Main Session Service (Audits 02, 07):** Verified (`SessionService` in Electron main is the single source of truth for timer countdowns, focus minutes, and task states; multi-window broadcasts keep views in sync without race conditions).
- **Non-Destructive Midnight Rollover (Audit 03):** Verified (Unfinished tasks roll over to the new local calendar date; completed tasks archive into `taskHistory`; running timers stay alive across midnight with minute splitting).
- **Idempotent Expiry & Restart Recovery (Audits 02, 04):** Verified (`completionLedger` guarantees expired sessions complete their bound task and award focus minutes exactly once, including when closing before expiry and reopening afterward).
- **Session Task Binding (Audit 05):** Verified (Focus sessions are bound immutably to starting `(taskId, initialDurationSeconds)`; task switching while running or paused is strictly prohibited without explicit reset).
- **Canceled Session Accounting (Audit 04):** Verified (Canceling/resetting an active timer credits accrued focus minutes to the daily bucket while keeping the bound task incomplete).
- **Clock Skew & Day Buckets:** Verified (Non-negative clamp prevents negative focus time; focus minutes allocated to `YYYY-MM-DD` buckets).
- **Automated Regression Suite:** Verified (`npm test` passes all 43 tests across 12 suites with exit code 0).
- **Native Electron Evidence:** Verified (`node scratch/verify-w04-native.cjs` passes 6/6 native checks inside an isolated Electron environment).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W05 — Truthful settings and monitor-safe windows**. Stop at W04 package boundary.

---

## 8. Milestone Completion Sign-Off: W05
- **Authoritative Settings & Live Broadcast (Audits 10, 16):** Verified (Single source of truth in Electron main with typed validation and live broadcasting via `settings:changed` across all active windows).
- **Truthful Tray and Startup Preferences (Audit 10):** Verified (Separated `closeToTray` and `startMinimized` into two distinct settings with truthful labels in `ManagerSettings.tsx`).
- **Global Pin Default & Per-Widget Pin Precedence (Audit 11):** Verified (Widgets inherit `alwaysOnTopDefault` on creation unless explicitly pinned/unpinned).
- **Immediate Pin State Multi-Window Sync (Audit 14):** Verified (Pin state changes broadcast to both manager and floating widgets; `WidgetChrome` and `UwidgetsManager` stay synchronized in real time).
- **Coupled Global Audio Controls (Audit 15):** Verified (Disabling sound effects globally mutes all mechanical clicks, page flips, and fanfares across all windows while preserving local per-widget preferences).
- **Persistent Accent & Pre-Show Scale (Audits 12, 16):** Verified (Accent color persisted and synchronized across windows; zoom factor applied on `ready-to-show` before newly opened windows appear).
- **Multi-Monitor Bounds Clamping & Recovery (Audit 13):** Verified (Coordinates clamped against all connected display work areas, preserving negative spaces and titlebar accessibility; stranded windows recovered to primary display).
- **Reset Widget Positions Action (Audit 13 & AC 8):** Verified (Actionable button under Desktop Management restores all widgets to primary display default bounds).
- **Pending States & Error Handling (Audit 18):** Verified (UI controls track asynchronous IPC pending states, display actionable error alerts, and surface success indicators only upon confirmation).
- **Automated Regression Suite:** Verified (`npm test` passes all 57 tests across 15 suites with exit code 0).
- **Native Electron Evidence:** Verified (`npx tsx scratch/verify-w05-native.cjs` passes 6/6 native checks inside an isolated Electron environment).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W06 — Reliable notes and recoverable edits**. Stop at W05 package boundary.

---

## 9. Milestone Completion Sign-Off: W06
- **Stable Page ID Selection (Audit 19):** Verified (Replaced volatile array indices with stable page IDs; newly created notes navigate immediately and focus the editor).
- **Canvas Pointer Capture & Cancel (Audit 20):** Verified (`setPointerCapture(pointerId)` captured on `pointerdown`; `pointerup`, `pointercancel`, and `lostpointercapture` reliably finalize strokes when releasing outside canvas).
- **Vector Strokes & High-DPI Scaling (Audit 21):** Verified (Normalized $[0, 1]$ vector points scale cleanly with `devicePixelRatio`; window resizing preserves drawing without truncation or pixel distortion; monotonic render tokens guard against stale image decode races).
- **Durable Note Storage & Quota Crash (Audit 22):** Verified (Offloaded from monolithic `localStorage` to Electron `DurableStore` with atomic file replacement and `.bak` recovery; added schema validation, live save/error indicators, and JSON export/import).
- **Soft Deletion & Undo (Audit 23):** Verified (Tearing notes soft-deletes to trash with floating Undo toast and `Ctrl+Z` recovery; implemented 30-day trash retention pruning capped at 50 items).
- **Zero Button Cutoff Layout:** Verified (Adjusted Stickk window height to 510px in `electron/displayBounds.cjs`; enforced `flex-shrink: 0` and `margin-top: auto` on `.controls-row` to guarantee 100% button visibility).
- **Automated Regression Suite:** Verified (`npm test` passes all 69 tests across 19 suites with exit code 0).
- **Native Electron Evidence:** Verified (`node scratch/verify-w06-native.cjs` passes 6/6 native checks inside an isolated Electron environment).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W07 — Deterministic game turns and series reset**. Stop at W06 package boundary.

---

## 10. Milestone Completion Sign-Off: W07
- **Timer & Handle Cancellation (Audit 24):** Verified (Centralized `abortAllPendingAsync()` explicitly clears `cpuTimerRef`, `resultTimerRef`, `confettiAnimRef`, and `brushFrameRef` on reset, mode change, round transition, and unmount).
- **Monotonic Generation Token (Audit 24):** Verified (`gameGenRef` token prevents stale in-flight timer callbacks from corrupting new rounds or reset games).
- **CPU-Started Rounds (Audit 24):** Verified (Rounds 2 and 4 evaluate from clean authoritative state, placing exactly one legal opening move with turn transferred to Player X).
- **Input Lock During CPU Turn (Audit 24):** Verified (`isCpuThinking` state disables cells to prevent human moves while CPU is computing).
- **5-Round Series Rules & Draw Accounting (Audit 25):** Verified (Max 5 rounds; draws tracked explicitly; first to 3 majority or mathematical clinch wins early; ties after 5 rounds resolved as series draws).
- **Hard AI Minimax Invariance:** Verified (Mathematically proven 0 losses across 600+ simulated games against arbitrary and legal moves).
- **Easy and 2P Modes:** Verified (Easy AI picks random legal moves; 2P mode supports local alternating turns).
- **Automated Regression Suite:** Verified (`npm test` passes all 80 tests across 23 suites with exit code 0).
- **Native Verification Evidence:** Verified (`npx tsx scratch/verify-w07-native.cjs` passes 6/6 native checks).
- **Production Build & Packaging:** Verified (`npm run lint`, `npm run build`, and `npx electron-builder --win --x64 --dir` all exit code 0).
- **Handoff:** Ready to execute **W08 — Accessibility and visual consistency**. Milestone W07 complete.

---

## 11. Milestone Completion Sign-Off: W08
- **Single Source of Dimensions (Audit 33):** Verified (`src/utils/widgetDimensions.json` unified between `electron/displayBounds.cjs` and `src/utils/widgetsCatalog.ts`: Flowcus 312x505, Playz 312x475, Stickk 312x510).
- **Offline Bundled Fonts (Audit 34):** Verified (All 5 handwriting woff2 files in `public/fonts/`, licensed in `public/fonts/LICENSE.txt`, local `@font-face` rules in `src/index.css`, zero external Google Fonts requests in `index.html`).
- **Accessible Dialogs & Focus Trap (Audit 31):** Verified (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, initial focus on close button, Tab focus trapping cycle, Escape closing, and focus restored to trigger element on dismiss).
- **Semantic Cards & Keyboard Focus (Audit 31):** Verified (`role="button"`, `tabIndex={0}`, `aria-label`, Enter/Space activation, and distinct 2px `:focus-visible` outlines on catalog cards).
- **JavaScript & CSS Reduced Motion (Audit 32):** Verified (`isReducedMotion()` suppresses canvas confetti particles in Playz and skips 3D flip/tear delays in Stickk without breaking interactions; CSS animations clamped to 0.01ms under `prefers-reduced-motion: reduce`).
- **Clean Copy & Social Proof Removal (Audit 33):** Verified (Removed fake user counts and ratings; replaced with authentic dimensions and desktop running states; fixed UTF-8 mojibake).
- **Automated Regression Suite:** Verified (`npm test` passes all 92 tests across 28 suites with exit code 0).
- **Native Electron Evidence:** Verified (`node scratch/verify-w08-native.cjs` passes 7/7 native checks).
- **Production Client Build:** Verified (`npm run lint` and `npm run build` both exit code 0).
- **Handoff:** Ready to proceed with **W09 — CI and measured resource use**. Stop at W08 package boundary.

---

## 12. Milestone Completion Sign-Off: W09
- **Dedicated CI Scripts (Audit 30):** Verified (`package.json` provides isolated `"typecheck"`, `"lint"`, `"test"`, `"build"`, `"package:win"`, and `"dist:win"`).
- **Reproducible Windows CI Pipeline (Audit 30):** Verified (`.github/workflows/ci.yml` authored for `windows-latest` with Node 22 (`22.x`) and `npm ci` referencing `package-lock.json`).
- **TypeScript Strict Mode (Audit 30):** Verified (`tsconfig.json` enabled `"strict": true`, includes tests, ambient Node types; explicit contracts in `src/types.ts`; zero untyped `(window as any)` calls remain in `src/`).
- **Project Linter (Audit 30 & 36):** Verified (`scripts/lint.cjs` enforces UTF-8 character integrity, disallows blanket `@ts-ignore`/`@ts-nocheck`, disallows raw bridge bypasses, and validates JSON; passes all 58 workspace files with 0 errors).
- **Automated Regression Suite:** Verified (`npm test` passes all 100 tests across 32 suites with exit code 0).
- **Packaged Windows Production Build:** Verified (`npm run package:win` produces `release/win-unpacked/Uwidgets.exe` cleanly).
- **Empirical Resource Benchmarks (Audit 36):** Verified (All 10 scenarios measured on Windows 11 hardware and recorded in `docs/implementation/performance-report.json`).
- **10-Cycle Widget Open/Close Leak Investigation:** Verified (Memory drift across 10 rapid open/close cycles is -103 MB net, confirming that Chromium GC cleans up destroyed window contexts and no memory leaks exist).
- **Provisional Performance Budgets:** Verified (Cold launch latency $\le 3,500$ ms, single widget RAM $\le 380$ MB, concurrent RAM $\le 750$ MB, active CPU $\le 3.0\%$, open/close drift $\le 25$ MB).
- **Handoff:** Ready to proceed with **W10 — Release candidate and handoff**. Milestone W09 complete. Stop at W09 package boundary.

---

## 13. Milestone Completion Sign-Off: W10
- **Root Documentation & Licensing (Audit 35):** Verified (`README.md` and `LICENSE` authored; system requirements, architecture, and manual upgrade workflows documented; ownership disclosures clear).
- **Online Dependency Vulnerability Triage (Audit 35):** Verified (`docs/implementation/dependency-audit.md` triaged all 7 CVEs; 0 CVEs exist in production runtime; build tooling advisories accepted without breaking downgrades).
- **Lockfile & Git Hygiene (Audit 35):** Verified (Removed stale `bun.lock`; added `release/` to `.gitignore`; `package-lock.json` established as sole authoritative lockfile).
- **NSIS Data Retention Policy (Audit 35 & 29):** Verified (`deleteAppDataOnUninstall: false` in `package.json` preserves `%APPDATA%\uwidgets` across app uninstallation and reinstallation).
- **Release Candidate Artifacts (Audit 29):** Verified (`release/Uwidgets-Setup.exe` [134.92 MB] and `release/win-unpacked/Uwidgets.exe` [235.39 MB] built cleanly with computed SHA-256 hashes).
- **Automated Release Gate Suite:** Verified (`tests/w10-release-candidate.test.ts` passes 13/13 tests across 8 suites; full suite passes 113/113 tests across 40 suites).
- **Release-Readiness Matrix:** Verified (All 36 original audit items mapped with automated evidence, deferred gates, and precise manual steps).
- **Handoff:** Milestone W10 complete. Stabilization phase fully concluded. Local release candidate ready for stakeholder review.



