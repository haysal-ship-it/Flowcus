import React from 'react';
import { FlipDigit } from './FlipDigit';

interface FlipClockProps {
  remainingSeconds: number;
  animate?: boolean;
}

export const FlipClock: React.FC<FlipClockProps> = ({
  remainingSeconds,
  animate = true,
}) => {
  const clampedSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;

  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  const m1 = minutesStr[0];
  const m2 = minutesStr[1];
  const s1 = secondsStr[0];
  const s2 = secondsStr[1];

  return (
    <div
      className="flowcus-flip-clock-container"
      role="timer"
      aria-live="off"
      aria-label={`Focus timer: ${minutes} minutes, ${seconds} seconds`}
    >
      {/* Minutes Flap Pair */}
      <div className="flowcus-flip-group minutes" aria-label={`Minutes: ${minutesStr}`}>
        <FlipDigit value={m1} animate={animate} width={58} height={84} fontSize={60} />
        <FlipDigit value={m2} animate={animate} width={58} height={84} fontSize={60} />
      </div>

      {/* Optical Split Colon Separator */}
      <div className="flowcus-flip-colon" aria-hidden="true">
        <div className="flowcus-flip-dot top" />
        <div className="flowcus-flip-dot bottom" />
      </div>

      {/* Seconds Flap Pair */}
      <div className="flowcus-flip-group seconds" aria-label={`Seconds: ${secondsStr}`}>
        <FlipDigit value={s1} animate={animate} width={58} height={84} fontSize={60} />
        <FlipDigit value={s2} animate={animate} width={58} height={84} fontSize={60} />
      </div>
    </div>
  );
};
