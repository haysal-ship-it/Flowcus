# Uwidgets: Google Antigravity implementation playbook
Version 2 • 11 November 2026 • Companion to Uwidgets-audit-and-plan.md

## Outcome
Stabilize the existing Flowcus, Stickk and Playz suite before expanding the catalog. Preserve its visual direction. Deliver durable local data, consistent settings, predictable desktop behavior and a reproducible Windows release.

This is a refined implementation plan, not an implementation. Revalidate audit evidence against current source before making changes. Audit IDs below map to the 36-item original report.

## 1. Set up Antigravity
1. Open C:\Users\Sal\Downloads\Flowcus-main as the workspace. Keep both this document and the original audit locally available.
2. Use Planning mode for architecture, migrations, IPC, lifecycle and build diagnosis. Use Fast mode only for narrow corrections with established requirements.
3. Use one conversation per work package. Save decisions/status in repository Markdown so a new conversation can resume accurately.
4. Use implementation-plan artifacts before substantial changes and walkthrough artifacts afterward. Review state/schema and release plans before applying them. For ordinary packages, explicitly request implementation and verification after planning, subject to the configured review policy.
5. Work sequentially on shared state, main/preload and migrations. Avoid simultaneous writers to these files.
6. Use browser checks for React behavior and native Electron checks for tray, startup, pinning, display scaling and restoration. Never claim a browser check proves desktop behavior.
7. Do not rely on custom slash workflows being installed. The prompts below work as ordinary messages.

Official documentation checked 11 November 2026:
- Rules: https://antigravity.google/docs/rules
- Planning/review: https://antigravity.google/docs/artifact-review
- Plan artifacts: https://antigravity.google/docs/implementation-plan

Antigravity supports plain AGENTS.md/GEMINI.md instructions. Modular .agents/rules Markdown needs valid activation frontmatter under current documentation. Merge instructions after inspecting existing files; do not overwrite them. Review policy and UI vary by installed surface. A /plan request can pause for approval even with Always Proceed; explicitly request execution when that is intended.

## 2. Proposed project instructions
Copy this into Antigravity's project instructions, or merge into existing workspace instructions when implementation begins. No active rules were installed by this deliverable.

> Read the current work package, audit and status before editing. Inspect Git status and preserve existing user changes. Do not reset, clean, delete user data, or replace lockfiles as a troubleshooting shortcut.
>
> Execute only the current package and required prerequisites. Keep diffs small and reviewable. Preserve the current visual direction. Defer new widgets, accounts, cloud, AI and framework rewrites.
>
> Use Windows/PowerShell-safe commands. Record exact commands, exit codes and errors. Do not disable security or suppress checks to obtain a green result. Distinguish environmental blockers from source defects.
>
> Previews must have no access to production data or native controls. IPC must validate sender, role and payload. Session completion must be idempotent. Back up legacy data before migration.
>
> Add targeted regression coverage for behavior changes. Browser checks do not establish native Electron correctness. Mark unavailable checks blocked rather than passed.
>
> Complete a walkthrough with changed files, evidence, audit IDs resolved and remaining risks. Update persistent status. Do not publish, purchase services, sign releases or change real Windows login settings without explicit authorization.

## 3. Persistent handoff and completion contract
Create these during implementation:

| File | Contents |
|---|---|
| docs/implementation/baseline.md | Runtime versions, Git state summary, commands/results and initial visual evidence. |
| docs/implementation/decisions.md | Behavior decisions, architecture, schema ownership, migration and rollback rules. |
| docs/implementation/status.md | Each package: not started, in progress, blocked, implemented/unverified or verified; audit mapping and next action. |
| docs/implementation/verification.md | Reproduction steps, regression assertions, commands/exit codes and native/manual evidence. |

A package is verified only when scoped behavior, meaningful regressions and relevant type/build checks pass. If a required native check cannot run, mark it unverified. Keep a focused patch/commit checkpoint without mixing unrelated existing user edits.

Evidence template:

    Package / audit IDs:
    Status:
    Behavior before and after:
    Files changed:
    Commands and exit codes:
    Automated assertions:
    Native/manual evidence:
    Migration and rollback evidence:
    Blockers / remaining risks:
    Next eligible package:

## 4. Behavior decisions to review together
These are proposed defaults, not previously approved product changes. Record them before implementing retention/session changes.

| Topic | Proposed behavior |
|---|---|
| Midnight | Archive completed work, carry unfinished tasks and preserve active sessions. |
| Running session | Bind task ID and duration at start; task switching requires explicit stop/restart. |
| Overnight reporting | Allocate focus to local calendar-day buckets; document timezone and clock-change behavior. |
| Expiry while closed | Reconcile on reopen through the same exactly-once completion transition. |
| Cancellation | Keep elapsed focus as a partial session without completing the task; finalize this rule before implementation. |
| Manager close | Separate close-to-tray from startup-minimized. |
| Quit and restore | Quit exits all processes but preserves intended restore state. Explicit removal changes restore intent. |
| Pin meaning | Opening a widget and Always on Top remain distinct actions. |
| Playz series | Five total rounds, draws count, highest score wins; ties allowed. Align copy. |
| Distribution | Manual upgrades initially unless an updater is actually implemented and tested. |

## 5. Minimum necessary architecture
Keep React, Vite, TypeScript and Electron; introduce no backend service.

- Pure domain transitions define task/session behavior, validation and stable IDs.
- Electron main owns desktop commands, authoritative session state and serialized durable commits. Reconcile deadlines at startup/wake and relevant commands; renderer intervals must not award credit.
- Persist session state, task completion and completion ledger as one coherent transaction. Use a versioned validated snapshot, atomic replacement and a last-good backup.
- A typed preload bridge exposes narrow commands/subscriptions with sender-role and payload checks.
- React renders snapshots and sends commands. It may animate the countdown, but cannot independently credit sessions or overwrite authoritative snapshots.
- Browser development and previews use explicit in-memory adapters. Failed desktop storage must never silently fall back to demo data.
- Select Stickk blob/file/IndexedDB storage based on size and migration needs. Avoid a database rewrite solely for architectural uniformity.
- Adapt modules to the existing CommonJS Electron entry. New TypeScript main-process modules require an actual compilation/loading path.

Migration: export old values -> validate -> create candidate snapshot -> verify IDs/counts/content -> atomically activate -> record migration marker. Keep legacy data for recovery. Never delete the old store before validation. Rollback must restore matching application and schema versions; older binaries must not blindly read newer schemas.

## 6. Work packages

### W00 — Reproducible baseline
Audit 28, 30, 35. No prerequisites.
Inspect package.json, lockfiles, Vite/TS configuration and existing changes. Record Node/npm versions. Establish intended dependency graph before choosing a lockfile. Reproduce checks; investigate spawn EPERM separately from Tailwind native-module/config bundling errors. Use an isolated checkout/install for clean reproduction. Change one cause at a time; avoid broad upgrades.
Exit: clean Windows typecheck, bundle and unsigned local packaging succeed, or a precise environment blocker is documented. Native integration stays unverified until the build gate passes.

### W01 — Isolated previews and explicit form closing
Audit 01, 06. Requires W00 frontend build.
Targets: WidgetDetailModal, WidgetChrome, widget initialization/storage seams, TasksView and Flowcus add handlers.
Use injected in-memory fixtures/adapters; disable preview native controls, real persistence and session/audio side effects. Replace delayed toggles with explicit close actions.
Exit: before/after production-store snapshots remain identical across preview interactions. Pin/close cannot affect actual windows. Submit one task, wait past transition delays: one task and a closed form. Separate keys alone do not establish isolation.

### W02 — Desktop lifecycle and trusted IPC
Audit 08, 09, 26, 27. Requires W00.
Targets: electron/main.cjs, preload.cjs, contracts and CSP.
Add lifecycle states and Quit bypass; distinguish restore intent from current windows. Validate sender/frame/window role, IDs, keys, types and finite numeric ranges. Share strict navigation/popup handling across every window; retain only explicit development exceptions.
Exit: Quit with all widgets terminates every process; restart restores intended windows; explicit removals stay removed. Invalid/untrusted requests change nothing. External content cannot replace trusted widget content.

### W03 — Durable state and migration foundation
Audit 17; foundation for 02–04 and 22. Requires W02 and behavior decisions.
Add schema versions, defaults, serialized writes, atomic replacement and recovery backup. Prepare legacy import/export. Define one startup source of truth. Do not activate an incomplete replacement session service.
Exit: old/missing/corrupt/truncated/newer-version fixtures have documented outcomes. Interrupted writes retain last-good data. Repeated import is idempotent. IDs/content survive migration, and rollback is verified.

### W04 — Authoritative sessions and safe retention
Audit 02, 03, 04, 05, 07. Requires W01–W03.
Implement pure transitions and one main-process session owner; replace renderer persistence loops with commands/subscriptions. Bind task/duration at start. Record completion IDs, reconcile deadline recovery and replace destructive daily reset under the agreed policy.
Exit: simultaneous views, repeated expiry/recovery, close/reopen, pause/resume, active-task deletion/switching, overnight work and interrupted writes yield exact expected credits/task state. No renderer awards credit. Exercise migration in a disposable userData profile.

### W05 — Truthful settings and monitor-safe windows
Audit 10–16, 18. Requires W02–W04.
Unify snapshots/subscriptions for startup, tray, pin, mute, scale and accent. Apply saved preferences before new windows show. Validate/persist bounds, clamp to available monitors and add Reset positions. Await results and display failures.
Exit: each setting works immediately, agrees across surfaces and survives widget reopen and full restart. Test monitor removal, Windows DPI and app scale. Never automate changes to real login startup settings outside an isolated test profile.

### W06 — Reliable notes and recoverable edits
Audit 19–23. Requires W01–W03; W05 for display integration.
Fix active-page selection using stable IDs. Capture/cancel pointers. Preserve drawing through resize, use DPI-aware rendering and guard asynchronous restores. Add validated text/blob persistence, visible save status, export/import and Undo/trash. Choose drawing representation before migrating bitmaps.
Exit: add selects new note; release outside saves; rapid flips never mix drawings; shrink/grow preserves content; reopen restores data; save failures are visible; Undo and export/import work, including legacy doodleDataUrl migration.

### W07 — Deterministic game turns
Audit 24, 25. Requires W01; can follow W02 if shared files stay untouched.
Cancel CPU/result timers and animation frames on reset/mode change/unmount. Use a generation token and state-driven turns. Align series/draw rules with the decision record. Treat game persistence as optional unless adopted.
Exit: no old CPU move after reset; CPU-started rounds work; effects stop on unmount; ties/series finish correctly. Validate Hard AI across reachable board states.

### W08 — Accessibility and visual consistency
Audit 31–34. Requires W05–W07.
Complete dialog naming/focus trapping/restoration and semantic controls. Honor reduced motion in JS and CSS. Replace damaged text, remove unsupported social proof, consolidate dimensions and bundle licensed fonts. Add only necessary shared design tokens.
Exit: keyboard/Narrator checks, visible focus, reduced motion, minimum sizes, scaling and cold offline launch pass. Compare against baseline screenshots; do not introduce a visual redesign.

### W09 — CI and measured resource use
Audit 30, 36. Requires behavior packages being measured; earlier fixes already include targeted tests.
Add Windows CI, separate actual lint/typecheck, tighten types around bridge/domain. Profile packaged manager-only, individual/all widgets, active/idle/hidden states and repeated open/close. Set budgets from evidence on named hardware; optimize measured problems.
Exit: repeatable commands and meaningful scenario coverage; documented CPU/RAM/launch baseline; no unexplained idle activity or leak trend. Avoid broad CSS rewrites during stabilization.

### W10 — Release candidate and handoff
Audit 29, 35 and all remaining gates. Requires W00–W09.
Finish setup/data/privacy/support docs. Run current online dependency review and triage findings. Remove unused dependencies only with usage evidence. Reconcile generated artifacts without deleting user work. Build unsigned local candidate before authorized signing/distribution. Verify manual upgrade or actual updater; document ownership/license decisions without inventing a license.
Exit: clean checkout builds/packages; native matrix passes; upgrade retains data; uninstall policy is tested; signing/update route verified where enabled. External certificates/distribution blockers stay visible.

## 7. Paste-ready Antigravity prompts

### Start here
    Read Uwidgets-antigravity-implementation-plan.md and Uwidgets-audit-and-plan.md. Revalidate audit findings against current source.
    Execute W00 only. Preserve existing Git changes. Record runtime/package-manager versions, identify intended lockfile and reproduce the current build/typecheck issues. Diagnose Windows permissions separately from native dependency/config loading. Avoid destructive cleanup and broad upgrades.
    Create a scoped implementation-plan artifact, then implement and verify within the configured review policy. Establish docs/implementation/baseline.md, decisions.md, verification.md and status.md. Record exact commands and exit codes. Finish with a walkthrough and next eligible package. Stop at W00.

### Run the next package
    Read this playbook plus docs/implementation/status.md, decisions.md and verification.md.
    Execute W[NUMBER] only. Confirm prerequisites and inspect current source. Plan files, behavior, tests and migration/rollback where relevant. Implement and verify within the configured review policy.
    Preserve existing user changes and visual direction. Add meaningful regression coverage. Use native Electron evidence for desktop claims. Record blocked checks accurately.
    Finish with a walkthrough: changes, evidence, audit IDs resolved, unresolved risks and next eligible package. Stop at this package boundary.

### Review completed work
    Review W[NUMBER] against its acceptance criteria and original audit IDs. Inspect the diff for data loss, duplicate ownership, stale callbacks, silent failure, scope creep and missing tests. Cite files and severity. Run relevant checks, fix scoped defects, and update status/evidence. Screenshots or descriptions alone cannot prove native behavior.

### Resume in a new conversation
    Read persistent status, decisions and verification. Inspect Git status. Identify the first package with satisfied prerequisites, summarize blockers and continue only that package. Reuse verified evidence unless source changes or new failures invalidate it.

## 8. Verification and release gates

| Layer | Verifies | Does not establish |
|---|---|---|
| Pure tests/fake clock | Session transitions, exactly-once accounting, dates/game rules. | Windows suspension/startup or disk durability. |
| Persistence/IPC integration | Migration, interrupted writes, authorization and schemas. | Real tray, placement or installer behavior. |
| Browser interaction | Forms, previews, focus and visuals. | Native pinning, Quit, IPC identity or Windows login. |
| Native Electron | Multi-window state, lifecycle, restart and packaged runtime. | Every display/hardware combination. |
| Windows acceptance | Install/upgrade, startup, sleep/wake, DPI, monitors and Narrator. | Untested environments. |

Mandatory scenarios: previews with live widgets; repeated completion/recovery; sessions crossing midnight; corrupt legacy data; quit/restore with zero/one/all widgets; failed settings saves; pointer release outside canvas; CPU reset races; monitor unplug; Windows scaling 100/125/150/200% and app zoom 85/100/115%; keyboard/Narrator; offline cold launch; upgrade/uninstall retention.

Hard release gates: isolated previews; no silent deletion of unfinished work; exactly-once completion; verified migration/backup/recovery; Quit/restore correct; settings truthful; IPC/navigation validated; clean build/package; dependency findings triaged; accessible primary flows; upgrade preserves data. Keep manual and unavailable checks visible.

## 9. Effort and scope
The original 17–30 developer-day range remains a rough staffing estimate, not an Antigravity runtime promise. Re-estimate after W00 and W03. Judge progress by verified packages and evidence, not number of files changed. Defer new widgets, marketplaces, cloud and AI until stabilization gates pass.
