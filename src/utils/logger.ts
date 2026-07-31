/**
 * Production Console Logger Sanitizer & Optimizer
 * Automatically suppresses verbose console logs, debug statements, and warnings in production mode
 * to optimize memory usage, main thread CPU cycles, and UI rendering performance.
 */

const isProd = typeof import.meta !== 'undefined' && (import.meta as any).env
  ? Boolean((import.meta as any).env.PROD)
  : process.env.NODE_ENV === 'production';

if (isProd) {
  const noop = () => {};
  // Override console output methods in production to save CPU cycles
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
  // Note: console.error is kept intact or silenced as needed. We allow fatal errors to log or quiet them.
}

export function devLog(...args: any[]) {
  if (!isProd) {
    console.log(...args);
  }
}

export function devWarn(...args: any[]) {
  if (!isProd) {
    console.warn(...args);
  }
}
