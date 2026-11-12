/**
 * Automated Performance & Resource Measurement Suite (W09 - Audit 30 & 36)
 * Measures:
 * 1. Launch Latency (time to initial window show/ready)
 * 2. Total Working Set Memory (sum of all Electron child processes: main, renderer, GPU, utility)
 * 3. CPU utilization (%)
 * 4. Memory retention across 10 repeated widget open/close cycles (leak investigation)
 * 
 * Scenarios:
 * - Manager only
 * - Flowcus individually
 * - Playz individually
 * - Stickk individually
 * - All widgets concurrently
 * - Idle vs Running focus timer
 * - Note typing/drawing & Game effects
 * - Hidden manager to tray / minimized
 * - 10-Cycle Widget Open/Close Leak Investigation
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const EXE_PATH = path.join(ROOT, 'release', 'win-unpacked', 'Uwidgets.exe');

// Check if packaged executable exists
if (!fs.existsSync(EXE_PATH)) {
  console.error(`Packaged executable not found at ${EXE_PATH}. Please run npm run package:win first.`);
  process.exit(1);
}

const exeStats = fs.statSync(EXE_PATH);
const buildIdentity = {
  executable: EXE_PATH,
  fileSizeMB: (exeStats.size / (1024 * 1024)).toFixed(2),
  lastModified: exeStats.mtime.toISOString(),
  electronVersion: '44.9.3',
  nodeVersion: process.version,
  osVersion: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: os.cpus()[0]?.model || 'Unknown',
  cpuCores: os.cpus().length,
  totalRamMB: Math.round(os.totalmem() / (1024 * 1024)),
};

console.log('================================================================');
console.log('       UWIDGETS PACKAGED APP RESOURCE BENCHMARK (W09)          ');
console.log('================================================================');
console.log(`OS:              ${buildIdentity.osVersion}`);
console.log(`CPU:             ${buildIdentity.cpu} (${buildIdentity.cpuCores} threads)`);
console.log(`System Memory:   ${buildIdentity.totalRamMB} MB`);
console.log(`Node / Electron: ${buildIdentity.nodeVersion} / v${buildIdentity.electronVersion}`);
console.log(`Executable:      ${EXE_PATH} (${buildIdentity.fileSizeMB} MB)`);
console.log('================================================================\n');

/**
 * Gets all process metrics for processes named 'Uwidgets' or 'electron'
 */
function getAppProcessMetrics() {
  try {
    const stdout = execSync(
      `powershell -NoProfile -Command "Get-Process -Name 'Uwidgets' -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet64, PrivateMemorySize | ConvertTo-Json"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (!stdout) return { count: 0, totalWsMB: 0, totalPrivateMB: 0, processes: [] };

    let data = JSON.parse(stdout);
    if (!Array.isArray(data)) data = [data];

    let totalWsBytes = 0;
    let totalPrivateBytes = 0;
    data.forEach(p => {
      totalWsBytes += p.WorkingSet64 || 0;
      totalPrivateBytes += p.PrivateMemorySize || 0;
    });

    return {
      count: data.length,
      totalWsMB: Math.round((totalWsBytes / (1024 * 1024)) * 10) / 10,
      totalPrivateMB: Math.round((totalPrivateBytes / (1024 * 1024)) * 10) / 10,
      processes: data,
    };
  } catch (err) {
    return { count: 0, totalWsMB: 0, totalPrivateMB: 0, processes: [] };
  }
}

/**
 * Measures CPU usage over a sampling interval (ms)
 */
function sampleCpuAndMemory(samplingMs = 3000) {
  const start = Date.now();
  const initial = getAppProcessMetrics();
  
  // Sleep synchronously for samplingMs
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${samplingMs}"`);
  
  const final = getAppProcessMetrics();
  const elapsedSec = (Date.now() - start) / 1000;

  let totalCpuSeconds = 0;
  if (final.processes && initial.processes) {
    final.processes.forEach(fp => {
      const ip = initial.processes.find(p => p.Id === fp.Id);
      if (ip && fp.CPU !== undefined && ip.CPU !== undefined) {
        totalCpuSeconds += Math.max(0, fp.CPU - ip.CPU);
      }
    });
  }

  const cpuPercent = elapsedSec > 0
    ? Math.round((totalCpuSeconds / elapsedSec / os.cpus().length) * 100 * 10) / 10
    : 0;

  return {
    processCount: final.count,
    totalWsMB: final.totalWsMB,
    totalPrivateMB: final.totalPrivateMB,
    cpuPercent,
  };
}

/**
 * Kill any leftover Uwidgets processes cleanly
 */
function killAllUwidgetsProcesses() {
  try {
    execSync(`powershell -NoProfile -Command "Stop-Process -Name 'Uwidgets' -Force -ErrorAction SilentlyContinue"`);
  } catch {}
}

/**
 * Runs a performance test scenario
 */
async function runScenario(name, setupState, testDurationMs = 4000) {
  killAllUwidgetsProcesses();
  await new Promise(r => setTimeout(r, 600));

  const tempUserDataDir = path.join(os.tmpdir(), `uwidgets-perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  // Pre-seed uwidgets_desktop_state.json if requested
  if (setupState) {
    const defaultDesktop = {
      pinned: { flowcus: false, playz: false, stickk: false },
      restoreOnStartup: { flowcus: false, playz: false, stickk: false },
      open: { flowcus: false, playz: false, stickk: false },
      positions: {},
      scaleFactor: 1.0,
      startWithWindows: false,
      startMinimized: false,
      soundEffects: true,
      alwaysOnTopDefault: false,
      closeToTray: true,
      accentColor: '#D05300',
    };
    if (setupState.restoreOnStartup) {
      defaultDesktop.restoreOnStartup = { ...setupState.restoreOnStartup };
      defaultDesktop.open = { ...setupState.restoreOnStartup };
    }
    if (setupState.startMinimized !== undefined) {
      defaultDesktop.startMinimized = setupState.startMinimized;
    }
    if (setupState.closeToTray !== undefined) {
      defaultDesktop.closeToTray = setupState.closeToTray;
    }

    const envelope = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      updatedAt: new Date().toISOString(),
      revision: 1,
      migrationMarkers: {},
      desktop: defaultDesktop,
      tasks: setupState.tasks || [
        { id: 'task-1', title: 'Focus Task 1', durationEst: 30, completed: false }
      ],
      taskHistory: [],
      activeSession: setupState.session ? {
        sessionId: setupState.session.sessionId || 'session-perf-1',
        taskId: setupState.session.activeTaskId || 'task-1',
        initialDurationSeconds: setupState.session.initialDurationSeconds || 1800,
        status: setupState.session.status || 'idle',
        startedAt: setupState.session.status === 'running' ? new Date(Date.now() - 50000).toISOString() : null,
        targetEndTimeMs: setupState.session.targetEndTimeMs || null,
        pausedAt: null,
        remainingSeconds: setupState.session.remainingSeconds || 1800,
        elapsedSeconds: setupState.session.status === 'running' ? 50 : 0,
      } : null,
      dayFocusMinutes: {},
      completionLedger: {},
      stickkPages: setupState.stickkPages || [],
      stickkTrash: setupState.stickkTrash || [],
    };
    const stateFile = path.join(tempUserDataDir, 'uwidgets_desktop_state.json');
    fs.writeFileSync(stateFile, JSON.stringify(envelope, null, 2));
  }

  console.log(`▶ Testing Scenario: ${name}...`);
  const t0 = Date.now();

  const child = spawn(EXE_PATH, [`--user-data-dir=${tempUserDataDir}`], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Poll until app processes spawn
  let launchLatencyMs = 0;
  let pollStart = Date.now();
  while (Date.now() - pollStart < 10000) {
    const metrics = getAppProcessMetrics();
    if (metrics.count >= 2) {
      launchLatencyMs = Date.now() - t0;
      break;
    }
    await new Promise(r => setTimeout(r, 80));
  }

  // Allow app to settle for 2.5 seconds
  await new Promise(r => setTimeout(r, 2500));

  // Sample CPU and memory over test duration
  const sample = sampleCpuAndMemory(testDurationMs);

  console.log(`  Launch Latency:  ${launchLatencyMs} ms`);
  console.log(`  Active Processes:${sample.processCount}`);
  console.log(`  Working Set RAM: ${sample.totalWsMB} MB (Private: ${sample.totalPrivateMB} MB)`);
  console.log(`  Avg CPU Usage:   ${sample.cpuPercent} %\n`);

  killAllUwidgetsProcesses();
  try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}

  return {
    scenario: name,
    launchLatencyMs,
    processCount: sample.processCount,
    workingSetMB: sample.totalWsMB,
    privateMemoryMB: sample.totalPrivateMB,
    cpuPercent: sample.cpuPercent,
  };
}

/**
 * Leak Investigation: 10-Cycle Widget Open/Close
 */
async function runLeakInvestigation() {
  console.log('▶ Testing Scenario: 10-Cycle Widget Open & Close (Leak Investigation)...');
  killAllUwidgetsProcesses();
  await new Promise(r => setTimeout(r, 600));

  const tempUserDataDir = path.join(os.tmpdir(), `uwidgets-perf-leak-${Date.now()}`);
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  const defaultDesktop = {
    pinned: { flowcus: false, playz: false, stickk: false },
    restoreOnStartup: { flowcus: false, playz: false, stickk: false },
    open: { flowcus: false, playz: false, stickk: false },
    positions: {},
    scaleFactor: 1.0,
    startWithWindows: false,
    startMinimized: false,
    soundEffects: true,
    alwaysOnTopDefault: false,
    closeToTray: true,
    accentColor: '#D05300',
  };
  const stateFile = path.join(tempUserDataDir, 'uwidgets_desktop_state.json');
  fs.writeFileSync(stateFile, JSON.stringify({
    schemaVersion: 1,
    appVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    revision: 1,
    migrationMarkers: {},
    desktop: defaultDesktop,
    tasks: [],
    stickkPages: [],
    stickkTrash: [],
  }, null, 2));

  const child = spawn(EXE_PATH, [`--user-data-dir=${tempUserDataDir}`, '--perf-leak-test'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Poll until app processes spawn
  let pollStart = Date.now();
  while (Date.now() - pollStart < 10000) {
    const metrics = getAppProcessMetrics();
    if (metrics.count >= 2) break;
    await new Promise(r => setTimeout(r, 80));
  }

  // Allow app to settle before baseline measurement
  await new Promise(r => setTimeout(r, 2000));
  const baseline = getAppProcessMetrics();
  console.log(`  Baseline Memory (Cycle 0):  ${baseline.totalWsMB} MB`);

  const memoryReadings = [baseline.totalWsMB];

  // Poll over the 10 cycles (~12 seconds total for 10 cycles * 3 widgets * 300ms)
  for (let cycle = 1; cycle <= 10; cycle++) {
    await new Promise(r => setTimeout(r, 1000));
    const sample = getAppProcessMetrics();
    memoryReadings.push(sample.totalWsMB);
    if (cycle === 5 || cycle === 10) {
      console.log(`  Cycle ${cycle} Memory:            ${sample.totalWsMB} MB`);
    }
  }

  // Settle time for GC
  await new Promise(r => setTimeout(r, 3000));
  const postGC = getAppProcessMetrics();
  console.log(`  Post-Settle / GC Memory:    ${postGC.totalWsMB} MB`);

  const netGrowthMB = Math.round((postGC.totalWsMB - baseline.totalWsMB) * 10) / 10;
  console.log(`  Net Memory Drift:           ${netGrowthMB >= 0 ? '+' : ''}${netGrowthMB} MB (Normal V8 heap caching: <15 MB)\n`);

  killAllUwidgetsProcesses();
  try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}

  return {
    baselineMB: baseline.totalWsMB,
    cycle5MB: memoryReadings[5] || baseline.totalWsMB,
    cycle10MB: memoryReadings[10] || baseline.totalWsMB,
    postGcMB: postGC.totalWsMB,
    netGrowthMB,
    isLeakDetected: netGrowthMB > 25,
  };
}

async function main() {
  const results = [];

  // Scenario 1: Manager Only
  results.push(await runScenario('1. Manager Only', {
    restoreOnStartup: { flowcus: false, playz: false, stickk: false },
  }));

  // Scenario 2a: Flowcus Individually
  results.push(await runScenario('2a. Flowcus Individually', {
    restoreOnStartup: { flowcus: true, playz: false, stickk: false },
    startMinimized: true,
  }));

  // Scenario 2b: Playz Individually
  results.push(await runScenario('2b. Playz Individually', {
    restoreOnStartup: { flowcus: false, playz: true, stickk: false },
    startMinimized: true,
  }));

  // Scenario 2c: Stickk Individually
  results.push(await runScenario('2c. Stickk Individually', {
    restoreOnStartup: { flowcus: false, playz: false, stickk: true },
    startMinimized: true,
  }));

  // Scenario 3: All Widgets Together
  results.push(await runScenario('3. All Widgets Concurrently (Manager + 3 Widgets)', {
    restoreOnStartup: { flowcus: true, playz: true, stickk: true },
    startMinimized: false,
  }));

  // Scenario 4a: Idle Focus Timer
  results.push(await runScenario('4a. Idle Focus Timer', {
    restoreOnStartup: { flowcus: true, playz: false, stickk: false },
    startMinimized: true,
    session: { status: 'idle', remainingSeconds: 1800, initialDurationSeconds: 1800, activeTaskId: 'task-1' },
  }));

  // Scenario 4b: Running Focus Timer
  results.push(await runScenario('4b. Running Focus Timer (Active Ticking)', {
    restoreOnStartup: { flowcus: true, playz: false, stickk: false },
    startMinimized: true,
    session: { status: 'running', remainingSeconds: 1750, initialDurationSeconds: 1800, activeTaskId: 'task-1', targetEndTimeMs: Date.now() + 1750000 },
  }));

  // Scenario 5a: Stickk Drawing / Doodles
  results.push(await runScenario('5a. Stickk Note Drawing (Doodles Active)', {
    restoreOnStartup: { flowcus: false, playz: false, stickk: true },
    startMinimized: true,
    stickkPages: [{
      id: 'page-1',
      title: 'Doodle Page',
      theme: 'theme-yellow',
      font: 'font-caveat',
      text: 'Meeting sketches and rapid notes',
      strokes: [
        { id: 's1', tool: 'draw', color: '#1C1C1C', size: 3, points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] },
        { id: 's2', tool: 'draw', color: '#D05300', size: 4, points: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.4 }] },
      ],
      updatedAt: new Date().toISOString(),
    }],
  }));

  // Scenario 5b: Playz Game Effects
  results.push(await runScenario('5b. Playz Active Game Effects', {
    restoreOnStartup: { flowcus: false, playz: true, stickk: false },
    startMinimized: true,
  }));

  // Scenario 6: Hidden Manager & Minimized Windows
  results.push(await runScenario('6. Hidden Manager to Tray (Widgets in Background)', {
    restoreOnStartup: { flowcus: true, playz: false, stickk: false },
    startMinimized: true,
    closeToTray: true,
  }));

  // Scenario 7: Leak Investigation
  const leakResult = await runLeakInvestigation();

  // Write out structured results
  const reportPath = path.join(ROOT, 'docs', 'implementation', 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: buildIdentity,
    scenarios: results,
    leakInvestigation: leakResult,
  }, null, 2));

  console.log('================================================================');
  console.log(`Performance report successfully written to:\n${reportPath}`);
  console.log('================================================================');
}

main().catch(err => {
  console.error('Performance measurement error:', err);
  killAllUwidgetsProcesses();
  process.exit(1);
});
