# Uwidgets Baseline Environment & Verification Record

**Document Date:** 11 November 2026  
**Work Package:** W00 — Reproducible Baseline  
**Project:** Flowcus-main / Uwidgets  

---

## 1. System & Runtime Environment

| Property | Value |
|---|---|
| **Operating System** | Windows 11 Home / Windows NT 10.0.22000 (x64) |
| **Shell** | PowerShell 5.1 (`System.Management.Automation`) |
| **Node.js** | `v24.15.0` |
| **npm** | `11.12.1` |
| **bun** | Not installed / Not in `PATH` |
| **Electron Runtime** | `v44.9.3` (packaged) / `^44.9.0` (dependency) |
| **Vite** | `v8.3.5` |
| **TypeScript** | `7.0.2` |
| **Windows Console Code Page** | Active: `437` (IBM437 input, UTF-8 console output) |
| **File System Permissions** | NTFS ACL: `SAL\Sal` (FullControl), `Administrators` (FullControl), `SYSTEM` (FullControl) |

---

## 2. Package Manager & Lockfile Diagnosis

### 2.1 Lockfile Assessment
The repository currently contains two lockfiles:
1. `bun.lock` (145,890 bytes, modified Oct 24, 2026):
   - Package name in lockfile: `"react-example"`
   - Origin: Upstream template / Google AI Studio export boilerplate.
   - Status: Inactive. Bun is not installed in the Windows environment, and no npm scripts invoke bun.
2. `package-lock.json` (290,294 bytes, modified Oct 24, 2026):
   - Lockfile format: `lockfileVersion: 3`
   - Active: Detected and resolved by `electron-builder` (`resolvedPackageManager=npm detected=C:\Users\Sal\Downloads\Flowcus-main`).
   - Authority: Identified as the **sole authoritative lockfile** for the project.

### 2.2 Unused Dependency Assessment (Audit ID 35)
Inspection of `package.json` revealed several dependencies inherited from AI Studio templates:
- `@google/genai` (`^2.4.0`)
- `express` (`^4.21.2`)
- `@types/express` (`^4.17.21`)
- `dotenv` (`^17.2.3`)

**Verification:** A recursive search across `src/` and `electron/` confirmed **0 imports** of `@google/genai`, `express`, or `dotenv`. These dependencies are non-functional remnants of the AI Studio export. Per W00 constraints (avoiding broad upgrades/destructive changes), they remain in `package.json` for now and are slated for clean removal in Work Package W10.

---

## 3. Configuration & Native Dependency Diagnosis (Audit ID 28)

### 3.1 Tailwind Oxide Native Addon
- Native module location: `node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node` (3,190,272 bytes).
- Native load check: Direct execution of `require('./node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node')` under Node.js `v24.15.0` loaded successfully and exported `[ 'Scanner' ]`.
- Conclusion: The native binary is fully functional and compatible with Node 24 on Windows x64.

### 3.2 Configuration Loading Failure Reproduction & Root Cause
- Under Vite 8, the default configuration loader is `bundle` (via Rolldown/esbuild).
- `vite.config.ts` was authored with `path.resolve(__dirname, '.')`.
- In pure ESM projects (`"type": "module"`), `__dirname` is not defined in the global scope.
- When running `vite build`, Vite warned that `__dirname` is unsupported in native loaders.
- When running `npx vite build --configLoader native` or `npx vite build --configLoader runner`, the build failed with:
  `ReferenceError: __dirname is not defined at vite.config.ts:12:27`.
- **Fix applied:** Replaced `__dirname` with `import.meta.dirname` (with `fileURLToPath(new URL('.', import.meta.url))` fallback).
- **Result:** Vite builds cleanly across all three loaders: `bundle` (0.85s), `native` (0.94s), and `runner` (0.81s) without warnings.

### 3.3 Windows Permissions Diagnosis
- NTFS file system permissions on `C:\Users\Sal\Downloads\Flowcus-main` allow Full Control.
- The `spawn EPERM` / `Access is denied` errors reported in the audit stem from:
  1. Windows console codepage mismatch (CP437 vs UTF-8) during child process stdio piping.
  2. Recursive PowerShell directory scanning where directory objects are treated as files (e.g. `Select-String -Path "src\**\*"` attempting to open subfolders like `src/components/common` as file handles).
  3. No genuine OS security or permission restriction blocks execution.

---

## 4. Git Working Tree State

Existing uncommitted Git changes were strictly preserved:
- Modified files:
  - `electron/main.cjs` (window dimensions, transparency)
  - `electron/preload.cjs` (IPC bridge)
  - `index.html` (root layout)
  - `package.json` (product metadata)
  - `src/App.tsx` (window routing, body classes)
  - `src/components/FlowcusWidget.tsx` (timer / view sizing)
  - `src/index.css` (design system tokens, transparency, flex layout)
  - `src/types.ts` (suite types)
  - `vite.config.ts` (ESM config loader fix)
- Untracked files:
  - `Uwidgets-antigravity-implementation-plan.md`
  - `Uwidgets-audit-and-plan.md`
  - `package-lock.json`
  - `preview.html`
  - `public/`
  - `release/`
  - `src/components/common/`, `hub/`, `manager/`, `playz/`, `stickk/`
  - `src/utils/`
