// Pure gesture logic for slide to bid (DESIGN.md › Slide to bid).
// Progress is 0 at the start of the track and 1 at the end.

export const SLOP_PX = 10;
export const ARM_AT = 0.85;
/** How far past either end the thumb may stretch, as a fraction of the track. */
const RUBBER_MAX = 0.18;
/** UIScrollView "normal" deceleration: how far a flick would carry on its own. */
const DECELERATION = 0.998;

/** The thumb only starts tracking once the finger has moved 10px. */
export function isDragging(dx: number): boolean {
  return Math.abs(dx) >= SLOP_PX;
}

function rubber(overshoot: number): number {
  return RUBBER_MAX * (1 - 1 / (overshoot * 3 + 1));
}

/** 1:1 inside the track, rubber-banded past the ends. */
export function slideProgress(dx: number, trackWidth: number): number {
  const raw = trackWidth > 0 ? dx / trackWidth : 0;
  if (raw > 1) return 1 + rubber(raw - 1);
  if (raw < 0) return -rubber(-raw);
  return raw;
}

export function isArmed(progress: number): boolean {
  return progress >= ARM_AT;
}

/** Where a release at this velocity (px/ms) would coast to, in progress units. */
export function projectedProgress(progress: number, velocity: number, trackWidth: number): number {
  if (trackWidth <= 0) return progress;
  return progress + (velocity * DECELERATION) / (1 - DECELERATION) / trackWidth;
}

/** Release past 85% bids; so does a flick that would carry past the end. Otherwise spring home. */
export function releaseOutcome(o: { progress: number; velocity: number; trackWidth: number }): 'bid' | 'home' {
  if (o.velocity < 0) return 'home';
  if (isArmed(o.progress)) return 'bid';
  return projectedProgress(o.progress, o.velocity, o.trackWidth) >= 1 ? 'bid' : 'home';
}
