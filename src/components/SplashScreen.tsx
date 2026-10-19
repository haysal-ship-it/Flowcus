import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 1600,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener?.('change', handleMediaChange);

    // If reduced motion, use a very short display duration
    const displayTime = mediaQuery.matches ? 600 : durationMs;

    const timer = window.setTimeout(() => {
      setIsExiting(true);
    }, displayTime);

    return () => {
      window.clearTimeout(timer);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, [durationMs]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Only respond to opacity transition on the top container
    if (e.target === e.currentTarget && e.propertyName === 'opacity' && isExiting) {
      onFinish();
    }
  };

  // Fallback safety timeout in case transitionend does not fire
  useEffect(() => {
    if (isExiting) {
      const fallbackMs = prefersReducedMotion ? 200 : 450;
      const fallbackTimer = window.setTimeout(() => {
        onFinish();
      }, fallbackMs);
      return () => window.clearTimeout(fallbackTimer);
    }
  }, [isExiting, prefersReducedMotion, onFinish]);

  return (
    <div
      className={`flowcus-splash-screen ${isExiting ? 'exiting' : ''} ${prefersReducedMotion ? 'reduced-motion' : ''}`}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={isExiting}
      role="presentation"
    >
      {/* Background Ambient Bottom Glow (Matches Figma Splash screen.png) */}
      <div className="flowcus-splash-ambient-glow" aria-hidden="true" />

      {/* Centered Wordmark with subtle illumination */}
      <div className="flowcus-splash-center">
        <h1 className="flowcus-splash-wordmark">Flowcus</h1>
      </div>
    </div>
  );
};
