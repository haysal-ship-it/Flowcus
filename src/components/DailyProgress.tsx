import React from 'react';

interface DailyProgressProps {
  completedTasks: number;
  totalTasks: number;
  focusedMinutes: number;
}

const TOTAL_BARS = 48; // Crisp, narrow, angled vertical bars across 378px

export const DailyProgress: React.FC<DailyProgressProps> = ({
  completedTasks,
  totalTasks,
  focusedMinutes,
}) => {
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const activeBars = totalTasks === 0
    ? 0
    : completedTasks === totalTasks
      ? TOTAL_BARS
      : Math.max(completedTasks > 0 ? 1 : 0, Math.round((completedTasks / totalTasks) * TOTAL_BARS));

  return (
    <section className="flowcus-daily-progress-card" aria-labelledby="daily-progress-title">
      {/* Title block (approximately 41px in height) */}
      <div className="flowcus-progress-title-block">
        <h2 id="daily-progress-title" className="flowcus-card-title">Daily Progress</h2>
        <p className="flowcus-supporting-copy">Keep momentum with calm, steady focus.</p>
      </div>

      {/* Progress Strip (approximately 378px wide, 24px tall, angled vertical bars) */}
      <div
        className="flowcus-progress-strip"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Daily progress: ${completedTasks} of ${totalTasks} tasks completed`}
      >
        {Array.from({ length: TOTAL_BARS }).map((_, index) => (
          <div
            key={index}
            className={`flowcus-progress-bar ${index < activeBars ? 'active' : ''}`}
          />
        ))}
      </div>

      {/* Two compact metrics below the strip */}
      <div className="flowcus-progress-metrics">
        <span className="flowcus-metric-left tabular-nums">
          {completedTasks} / {totalTasks} completed
        </span>
        <span className="flowcus-metric-right tabular-nums">
          {focusedMinutes} min focused
        </span>
      </div>
    </section>
  );
};
