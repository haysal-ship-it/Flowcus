import React, { useState, useEffect, useRef } from 'react';
import { WidgetChrome } from '../common/WidgetChrome';
import { SystemMemoryStats } from '../../types';

export interface StatzWidgetProps {
  isPreview?: boolean;
}

const MOCK_MEMORY_STATS: SystemMemoryStats = {
  totalBytes: 34359738368,
  freeBytes: 14428489728,
  usedBytes: 19931248640,
  usedPercent: 58,
  totalFormatted: '32.0 GB',
  usedFormatted: '18.4 GB',
  freeFormatted: '13.6 GB',
  topProcesses: [
    { name: 'Google Chrome', pid: 14210, memoryBytes: 2537553920, memoryFormatted: '2,420 MB', percentOfTotal: 7.4 },
    { name: 'Visual Studio Code', pid: 8840, memoryBytes: 1761607680, memoryFormatted: '1,680 MB', percentOfTotal: 5.1 },
    { name: 'Electron (Uwidgets)', pid: 21900, memoryBytes: 430964736, memoryFormatted: '410 MB', percentOfTotal: 1.3 },
    { name: 'Docker Desktop', pid: 11044, memoryBytes: 403701760, memoryFormatted: '385 MB', percentOfTotal: 1.2 },
    { name: 'Slack', pid: 19230, memoryBytes: 335544320, memoryFormatted: '320 MB', percentOfTotal: 0.9 },
  ],
  totalProcesses: 182,
};

export const StatzWidget: React.FC<StatzWidgetProps> = ({ isPreview = false }) => {
  const [stats, setStats] = useState<SystemMemoryStats>(MOCK_MEMORY_STATS);
  const [intervalSec, setIntervalSec] = useState<number>(3);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const fetchStats = async () => {
    if (isPreview || !window.electronAPI?.getMemoryStats) {
      return;
    }
    try {
      setIsLoading(true);
      const res = await window.electronAPI.getMemoryStats();
      if (res && isMountedRef.current) {
        setStats(res);
      }
    } catch {
      // Keep previous stats on error
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchStats();

    const timer = setInterval(() => {
      fetchStats();
    }, intervalSec * 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [intervalSec, isPreview]);

  const handleOpenTaskManager = () => {
    if (window.electronAPI?.openTaskManager) {
      window.electronAPI.openTaskManager();
    }
  };

  const getPercentColor = (pct: number) => {
    if (pct >= 85) return '#EF4444'; // Red alert
    if (pct >= 70) return '#F59E0B'; // Amber caution
    return '#3B82F6'; // Electric Blue normal
  };

  return (
    <div className="uwidget-shell" id="statz-widget-root">
      <WidgetChrome title="Statz" tag="RAM Monitor" widgetId="statz" isPreview={isPreview} />

      {/* Surface 1: Total RAM Gauge */}
      <section className="uwidget-card-top" style={{ padding: '8px 12px', minHeight: 'auto', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '13px', margin: 0 }}>Memory Usage</h2>
            <p className="card-subtitle" style={{ fontSize: '11px', margin: 0, color: '#797979' }}>
              {stats.usedFormatted} of {stats.totalFormatted} used
            </p>
          </div>
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: getPercentColor(stats.usedPercent),
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: `1px solid ${getPercentColor(stats.usedPercent)}40`,
              borderRadius: '6px',
              padding: '2px 8px',
            }}
          >
            {stats.usedPercent}%
          </span>
        </div>

        {/* Dual-Tone RAM Bar */}
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#1E2024',
            borderRadius: '9999px',
            overflow: 'hidden',
            margin: '4px 0',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, stats.usedPercent))}%`,
              height: '100%',
              backgroundColor: getPercentColor(stats.usedPercent),
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Metrics Row & Refresh Rate Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#797979', fontFamily: 'monospace' }}>
          <span>Free: <strong style={{ color: '#E2E8F0' }}>{stats.freeFormatted}</strong></span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Refresh:</span>
            {[1, 3, 5].map(sec => (
              <button
                key={sec}
                type="button"
                onClick={() => setIntervalSec(sec)}
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: intervalSec === sec ? '1px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: intervalSec === sec ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: intervalSec === sec ? '#FFFFFF' : '#797979',
                  cursor: 'pointer',
                }}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Surface 2: Top 5 Apps */}
      <section className="uwidget-card-bottom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>Top 5 Memory Consumers</span>
          <span style={{ fontSize: '10px', color: '#797979', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isLoading ? '#3B82F6' : '#00C853',
                display: 'inline-block',
                boxShadow: isLoading ? '0 0 6px #3B82F6' : '0 0 6px #00C853',
              }}
            />
            {isLoading ? 'Updating…' : 'Live'}
          </span>
        </div>

        {/* 5 App Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {stats.topProcesses.map((app, index) => {
            // Relative bar size normalized to highest consumer or total
            const maxMem = stats.topProcesses[0]?.memoryBytes || 1;
            const relativeWidth = Math.min(100, Math.max(8, (app.memoryBytes / maxMem) * 100));

            return (
              <div key={`${app.name}-${app.pid || index}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                    {index + 1}. {app.name}
                  </span>
                  <span style={{ color: '#3B82F6', fontFamily: 'monospace', fontWeight: 600 }}>
                    {app.memoryFormatted}
                  </span>
                </div>

                {/* Micro Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '5px',
                    backgroundColor: '#141518',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${relativeWidth}%`,
                      height: '100%',
                      backgroundColor: index === 0 ? '#3B82F6' : index === 1 ? '#60A5FA' : '#94A3B8',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: '8px',
            marginTop: 'auto',
          }}
        >
          <span style={{ fontSize: '10px', color: '#797979', fontFamily: 'monospace' }}>
            System Physical RAM
          </span>

          <button
            type="button"
            onClick={handleOpenTaskManager}
            title="Open Windows Task Manager"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3B82F6',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 4px',
            }}
          >
            <span>Task Manager</span>
            <span>↗</span>
          </button>
        </div>
      </section>
    </div>
  );
};
