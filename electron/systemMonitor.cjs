const os = require('os');
const { exec } = require('child_process');

/**
 * Gathers system RAM statistics and top 5 memory-consuming applications.
 * Uses native Node os module and non-blocking PowerShell Get-Process without external binary dependencies.
 */
function getMemoryStats() {
  return new Promise((resolve) => {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = Math.round((usedBytes / totalBytes) * 100);

    const baseResult = {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent,
      totalFormatted: (totalBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      usedFormatted: (usedBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      freeFormatted: (freeBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      topProcesses: [],
      totalProcesses: 0,
    };

    if (process.platform === 'win32') {
      const psCommand = 'Get-Process | Sort-Object -Descending WorkingSet | Select-Object -First 30 -Property ProcessName, Id, WorkingSet | ConvertTo-Json -Compress';
      exec(`powershell -NoProfile -Command "${psCommand}"`, { windowsHide: true, timeout: 4000 }, (error, stdout) => {
        if (error || !stdout) {
          return resolve(baseResult);
        }
        try {
          const raw = JSON.parse(stdout.trim());
          const list = Array.isArray(raw) ? raw : [raw];
          const appMap = new Map();
          for (const item of list) {
            if (!item || !item.ProcessName) continue;
            // Filter out idle / system pseudo processes if desired
            if (item.ProcessName === 'Idle') continue;

            const existing = appMap.get(item.ProcessName) || { name: item.ProcessName, pid: item.Id, memoryBytes: 0 };
            existing.memoryBytes += (item.WorkingSet || 0);
            appMap.set(item.ProcessName, existing);
          }

          const topProcesses = Array.from(appMap.values())
            .sort((a, b) => b.memoryBytes - a.memoryBytes)
            .slice(0, 5)
            .map((app) => ({
              name: app.name,
              pid: app.pid,
              memoryBytes: app.memoryBytes,
              memoryFormatted: app.memoryBytes >= 1024 * 1024 * 1024
                ? (app.memoryBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
                : (app.memoryBytes / (1024 * 1024)).toFixed(0) + ' MB',
              percentOfTotal: Number(((app.memoryBytes / totalBytes) * 100).toFixed(1)),
            }));

          baseResult.topProcesses = topProcesses;
          resolve(baseResult);
        } catch {
          resolve(baseResult);
        }
      });
    } else {
      resolve(baseResult);
    }
  });
}

module.exports = { getMemoryStats };
