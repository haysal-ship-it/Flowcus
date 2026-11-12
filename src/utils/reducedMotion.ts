/**
 * Reduced Motion Utility (W08 - Audit 32)
 * Autoritative check for user's system motion preference.
 * Honors `prefers-reduced-motion: reduce` in JavaScript animations.
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
