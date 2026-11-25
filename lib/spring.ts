// Damped springs (DESIGN.md › Motion: springs), described as damping ratio · response.
// Closed-form, so they're exact, interruptible (start from any x and v) and cheap.
// Units: position in whatever you animate (px, progress), time in ms, velocity per ms.

export type Spring = { damping: number; response: number /* seconds */ };

export const SPRINGS = {
  /** Taps, filters, digit roll, card → lot. No bounce. */
  calm: { damping: 1, response: 0.35 },
  /** Only after momentum: gallery swipe, bid handle, dock drawer release. */
  flick: { damping: 0.77, response: 0.32 },
} as const satisfies Record<string, Spring>;

/** Offset from the target and velocity at time t for a spring starting at x0 (offset), v0. */
function solve(x0: number, v0: number, s: Spring, t: number): number {
  const w = (2 * Math.PI) / (s.response * 1000);
  const z = s.damping;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return Math.exp(-z * w * t) * (x0 * Math.cos(wd * t) + ((v0 + z * w * x0) / wd) * Math.sin(wd * t));
  }
  return Math.exp(-w * t) * (x0 + (v0 + w * x0) * t);
}

export function springAt(from: number, to: number, velocity: number, s: Spring, t: number) {
  const h = 0.5;
  const x = to + solve(from - to, velocity, s, t);
  const v = (solve(from - to, velocity, s, t + h) - solve(from - to, velocity, s, Math.max(0, t - h))) / (t < h ? t + h : 2 * h);
  return { x, v };
}

/** Sample a spring every `dt` ms. Used by tests and for precomputing. */
export function simulate(o: { from: number; to: number; velocity: number; spring: Spring; duration: number; dt?: number }) {
  const dt = o.dt ?? 1000 / 60;
  const out: { t: number; x: number; v: number }[] = [];
  for (let t = 0; t <= o.duration + 1e-9; t += dt) out.push({ t, ...springAt(o.from, o.to, o.velocity, o.spring, t) });
  return out;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export type SpringHandle = {
  /** Stop where it is and return the current position and velocity (to hand off to the next motion). */
  stop: () => { x: number; v: number };
};

/**
 * Run a spring on requestAnimationFrame. Interrupt with handle.stop() and start
 * a new one from the returned { x, v }: motion restarts from where it is.
 * Reduced motion: jumps to the target (drags should still track 1:1 in the caller).
 */
export function animateSpring(o: {
  from: number;
  to: number;
  velocity?: number;
  spring: Spring;
  onUpdate: (x: number, v: number) => void;
  onDone?: () => void;
  reducedMotion?: boolean;
}): SpringHandle {
  const reduced = o.reducedMotion ?? prefersReducedMotion();
  if (reduced || typeof requestAnimationFrame === 'undefined') {
    o.onUpdate(o.to, 0);
    o.onDone?.();
    return { stop: () => ({ x: o.to, v: 0 }) };
  }
  const v0 = o.velocity ?? 0;
  let start: number | null = null;
  let raf = 0;
  let current = { x: o.from, v: v0 };
  const frame = (now: number) => {
    start ??= now;
    current = springAt(o.from, o.to, v0, o.spring, now - start);
    if (Math.abs(current.x - o.to) < 0.01 && Math.abs(current.v) < 0.001) {
      current = { x: o.to, v: 0 };
      o.onUpdate(o.to, 0);
      o.onDone?.();
      return;
    }
    o.onUpdate(current.x, current.v);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop: () => {
      cancelAnimationFrame(raf);
      return current;
    },
  };
}
