import React, { useState, useEffect, useRef } from 'react';
import { flipAudio } from '../utils/flipAudio';

interface FlipDigitProps {
  value: string;
  animate?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  ariaLabel?: string;
}

export const FlipDigit: React.FC<FlipDigitProps> = ({
  value,
  animate = true,
  width = 58,
  height = 84,
  fontSize = 62,
  ariaLabel,
}) => {
  const [displayedValue, setDisplayedValue] = useState<string>(value);
  const [flipping, setFlipping] = useState<boolean>(false);
  const [flipperOld, setFlipperOld] = useState<string>(value);
  const [flipperNew, setFlipperNew] = useState<string>(value);

  const prevValueRef = useRef<string>(value);
  const isInitialMount = useRef<boolean>(true);
  const animTimeoutRef = useRef<number | null>(null);
  const soundTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevValueRef.current = value;
      setDisplayedValue(value);
      return;
    }

    if (value !== prevValueRef.current) {
      const oldVal = prevValueRef.current;
      prevValueRef.current = value;

      if (!animate) {
        setDisplayedValue(value);
        setFlipping(false);
        return;
      }

      // Start flip animation
      setFlipperOld(oldVal);
      setFlipperNew(value);
      setFlipping(true);

      // Play mechanical sound
      flipAudio.playRelease();
      if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = window.setTimeout(() => {
        flipAudio.playLanding();
      }, 230);

      // Safety fallback to clean up flipping state after animation duration (480ms)
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = window.setTimeout(() => {
        setDisplayedValue(value);
        setFlipping(false);
      }, 500);
    }
  }, [value, animate]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
    };
  }, []);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    // When the bottom flap completes landing, finalize
    if (e.animationName.includes('flipDownBottom')) {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      setDisplayedValue(flipperNew);
      setFlipping(false);
    }
  };

  const halfHeight = height / 2;

  return (
    <div
      className="flowcus-flip-digit"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      aria-label={ariaLabel}
    >
      {/* 1. Static Upper Half Card: Reveals new value as top flipper drops */}
      <div
        className="flowcus-flip-card top static"
        style={{ height: `${halfHeight}px` }}
      >
        <span
          className="flowcus-flip-text"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${height}px`,
            height: `${height}px`,
            top: 0,
          }}
        >
          {flipping ? flipperNew : displayedValue}
        </span>
        <div className="flowcus-flip-notch left" />
        <div className="flowcus-flip-notch right" />
      </div>

      {/* 2. Static Lower Half Card: Displays previous value until covered by falling bottom flipper */}
      <div
        className="flowcus-flip-card bottom static"
        style={{ height: `${halfHeight}px` }}
      >
        <span
          className="flowcus-flip-text"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${height}px`,
            height: `${height}px`,
            top: `-${halfHeight}px`,
          }}
        >
          {flipping ? flipperOld : displayedValue}
        </span>
        <div className="flowcus-flip-notch left" />
        <div className="flowcus-flip-notch right" />
      </div>

      {/* 3. Dynamic Flipping Flaps */}
      {flipping && (
        <>
          {/* Top Flap: Rotates downward from 0deg to -90deg */}
          <div
            className="flowcus-flip-card top flipper-top"
            style={{ height: `${halfHeight}px` }}
          >
            <span
              className="flowcus-flip-text"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${height}px`,
                height: `${height}px`,
                top: 0,
              }}
            >
              {flipperOld}
            </span>
            <div className="flowcus-flip-shadow top" />
            <div className="flowcus-flip-notch left" />
            <div className="flowcus-flip-notch right" />
          </div>

          {/* Bottom Flap: Rotates into view from +90deg to 0deg */}
          <div
            className="flowcus-flip-card bottom flipper-bottom"
            style={{ height: `${halfHeight}px` }}
            onAnimationEnd={handleAnimationEnd}
          >
            <span
              className="flowcus-flip-text"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${height}px`,
                height: `${height}px`,
                top: `-${halfHeight}px`,
              }}
            >
              {flipperNew}
            </span>
            <div className="flowcus-flip-shadow bottom" />
            <div className="flowcus-flip-notch left" />
            <div className="flowcus-flip-notch right" />
          </div>
        </>
      )}

      {/* 4. Physical Center Seam & Lateral Hinges */}
      <div className="flowcus-flip-divider" />
      <div className="flowcus-flip-notch left" />
      <div className="flowcus-flip-notch right" />
    </div>
  );
};
