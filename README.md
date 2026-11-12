# Uwidgets

> **A calm, minimal desktop widget suite for Windows.**  
> Featuring **Flowcus** (focus timer & daily tasks), **Playz** (mindful mini-game), and **Stickk** (quick sketchpad notes & doodles).

---

## Overview

Uwidgets is an independent desktop application built with Electron, React 19, and Tailwind CSS. It is designed to sit quietly on your Windows desktop, providing focused productivity and quick notes without visual clutter, heavy background resource consumption, or cloud lock-in.

### Core Desktop Widgets
- **Flowcus (Focus Timer & Daily Tasks):** Customizable Pomodoro-style focus timer with pure domain session state transitions, persistent midnight task retention, local calendar-day focus tracking, and task completion records.
- **Playz (Short-Break Mini-Game):** A refined, deterministic 5-round Tic-Tac-Toe series with an unbeatable Minimax Hard AI, accessible keyboard controls, and motion-respecting game effects.
- **Stickk (Sticky Notes & Sketchpad):** Instant sticky notes supporting high-DPI vector doodles, pointer-capture drawing, dual-layer persistent storage, recoverable deletion with an Undo trash stack, and JSON export/import.
- **Uwidgets Manager (Dashboard):** Central command window to launch, customize, pin, and reset widgets, configure global scale factors and accent colors, and manage desktop preferences.

---

## System Requirements & Supported Windows Versions

- **Supported Operating Systems:**
  - **Windows 11** (64-bit, all editions: Home, Pro, Enterprise)
  - **Windows 10** (64-bit, Version 1903 / Build 18362 or later)
- **Architecture:** x86_64 (`x64`)
- **Hardware Minimums:**
  - Processor: 1.6 GHz Dual-Core 64-bit CPU
  - Memory: 4 GB RAM (App uses ~320 MB for single widget, ~620 MB for all 4 surfaces concurrently)
  - Storage: 300 MB free disk space for installation and local durable storage
  - Display: 1024×768 minimum display resolution; per-monitor DPI scaling (100%–200%) fully supported

---

## Local Development & Setup

### Prerequisites
- **Node.js:** v22.x or later (LTS recommended)
- **Package Manager:** `npm` (v10+ or v11+)
- **OS:** Windows 10/11 (PowerShell 5.1 or PowerShell 7)

### Installation
```powershell
# Clone the repository
git clone https://github.com/your-org/Flowcus-main.git
cd Flowcus-main

# Install dependencies using authoritative lockfile
npm ci
```

### Running the Application

```powershell
# Run the Vite web development server (browser-only preview mode)
npm run dev

# Run full desktop application with Vite live-reload and Electron
npm run electron:dev
```

---

## Testing & Code Quality

The repository includes discrete, automated scripts enforcing strict TypeScript types, code hygiene, and 100+ automated regression tests covering W01 through W09:

```powershell
# 1. Strict TypeScript type check (strict mode enabled across src and tests)
npm run typecheck

# 2. Standalone code quality linter (UTF-8 character integrity, no @ts-ignore, typed IPC)
npm run lint

# 3. Full automated regression test suite (100 tests across 32 suites)
npm test

# 4. Measure performance and leak detection on packaged binary
node scripts/measure-performance.cjs
```

---

## Building & Packaging

```powershell
# Compile the production Vite client bundle to dist/
npm run build

# Package unpacked Windows binary to release/win-unpacked/Uwidgets.exe
npm run package:win

# Build Windows NSIS setup installer to release/Uwidgets-Setup.exe
npm run dist:win
```

---

## Data Architecture, Storage & Recovery

Uwidgets enforces durable local persistence without cloud dependencies:

- **Storage Location:** `%APPDATA%\uwidgets\uwidgets_desktop_state.json` (mapped to `app.getPath('userData')`).
- **Atomic File Replacement:** Every write creates a temporary file in the same directory (`.tmp`), flushes buffers via `fsync`, and atomically replaces the primary file with automatic retry handling for Windows file locks.
- **Last-Known-Good Backup:** A `.bak` backup file is updated on every verified save. If the primary state file is ever corrupted, truncated, or unreadable, Uwidgets automatically recovers from `.bak` and quarantines the corrupted file.
- **Safe Pre-Migration Backup:** Before executing any schema migration on legacy stores, Uwidgets creates `uwidgets_desktop_state.json.pre-migration.bak`.
- **Stickk Notes Export/Import:** Sticky notes and vector drawings can be exported to standalone JSON files and imported at any time via the widget controls.

---

## Desktop Lifecycle, Startup & Tray Integration

- **Authoritative Window Restoration:** Desired widget layout (`appState.restoreOnStartup`) is preserved independently from active window instances. Closing the application via Tray Quit keeps your desktop layout intact so widgets reopen upon your next session. Explicitly clicking a widget's close button or choosing "Remove All Widgets" removes it from startup restoration.
- **System Tray:** Uwidgets lives in the Windows notification area (System Tray). Closing the main manager window hides it to the tray when "Close to Tray" is active. Double-clicking the tray icon or selecting "Open Uwidgets Dashboard" brings the manager back.
- **Explicit Tray Quit:** Selecting **"Quit Uwidgets"** from the tray context menu bypasses close interception and terminates all processes, worker threads, and windows cleanly.
- **Display Clamping & Multi-Monitor Recovery:** Floating widgets are automatically clamped within the visible work areas of connected displays. If a secondary monitor is unplugged, widgets safely reposition to the primary display. The manager also provides a **"Reset Widget Positions"** button to restore windows to default desktop coordinates.

---

## Uninstall & Data Retention Policy

Uwidgets respects your productivity data:

- **Installer Configuration (`package.json` NSIS):** `"deleteAppDataOnUninstall": false`.
- **Retention Behavior:** Uninstalling Uwidgets via Windows Settings (`Add or remove programs`) removes the application binaries from `%LOCALAPPDATA%\Programs\uwidgets`, but deliberately **retains** your local data directory in `%APPDATA%\uwidgets`.
- **Reinstallation / Upgrade:** Reinstalling or updating Uwidgets preserves all previously created tasks, timer statistics, notes, vector doodles, and custom settings.
- **Complete Removal:** To perform a complete uninstallation and erase all data, manually delete `%APPDATA%\uwidgets` after running the uninstaller.

---

## Manual Upgrade & Rollback Instructions (Audit 29)

Uwidgets v1.0.0 is distributed as an unsigned local release candidate for testing. Because automatic background updating is not enabled in this release, upgrades are performed manually:

### Upgrading to a New Version
1. Exit any running Uwidgets instances: Right-click the Uwidgets tray icon and select **"Quit Uwidgets"**.
2. Run the new `Uwidgets-Setup.exe` installer, or replace the contents of your unpacked folder with the new `release/win-unpacked` files.
3. Launch Uwidgets. The built-in `DurableStore` migration layer will detect existing data, preserve your layout, and migrate state seamlessly.

### Rolling Back to a Previous Version
1. Exit Uwidgets completely via Tray Quit.
2. If the newer version updated the schema, restore your pre-migration backup by copying `%APPDATA%\uwidgets\uwidgets_desktop_state.json.pre-migration.bak` over `uwidgets_desktop_state.json`.
3. Launch the previous binary.

---

## Privacy Policy & Offline Operation

- **100% Offline by Design:** Uwidgets makes **zero** outbound HTTP/HTTPS network connections during runtime.
- **No Analytics / Telemetry:** No tracking, usage statistics, or telemetry identifiers are collected or transmitted.
- **Locally Bundled Assets:** All fonts (Geist Sans, Geist Mono, and 5 handwriting fonts) and sound effects are bundled locally within the installation directory. Zero remote requests are made to Google Fonts or CDN servers.

---

## Ownership, Support & Third-Party Licenses

### Project Ownership
- **Project Name:** Uwidgets (Flowcus Desktop Suite)
- **Copyright:** Copyright © 2026 Uwidgets contributors.
- **License Status:** Distributed under the [MIT License](file:///c:/Users/Sal/Downloads/Flowcus-main/LICENSE). Note: Formal legal entity ownership and commercial trademark registration remain open decisions for future governance.
- **Support:** Technical issues, bug reports, and verification evidence are tracked in the local repository under [docs/implementation/](file:///c:/Users/Sal/Downloads/Flowcus-main/docs/implementation/).

### Third-Party Open Source Components
Uwidgets incorporates open-source libraries under permissive licenses:
- **Electron:** MIT License (Copyright © OpenJS Foundation and Electron contributors)
- **React & React DOM:** MIT License (Copyright © Meta Platforms, Inc.)
- **Tailwind CSS:** MIT License (Copyright © Tailwind Labs, Inc.)
- **Lucide Icons:** ISC License (Copyright © Lucide Contributors)
- **Motion:** MIT License (Copyright © Motion Software Ltd)
- **Geist Fonts:** SIL Open Font License 1.1 (Copyright © Vercel, Inc.)
- **Handwriting Fonts:**
  - *Caveat:* SIL Open Font License 1.1 (Copyright © Impallari Type)
  - *Comic Neue:* SIL Open Font License 1.1 (Copyright © Craig Hang)
  - *Gloria Hallelujah:* SIL Open Font License 1.1 (Copyright © Kimberly Geswein)
  - *Pacifico:* SIL Open Font License 1.1 (Copyright © Vernon Adams)
  - *Permanent Marker:* Apache License, Version 2.0 (Copyright © Font Diner, Inc.)
  *(Full font license texts available in `public/fonts/LICENSE.txt`)*.
