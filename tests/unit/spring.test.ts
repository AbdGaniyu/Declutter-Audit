import { describe, expect, it, vi } from 'vitest';
import { SPRINGS, animateSpring, simulate } from '@/lib/spring';

describe('spring (DESIGN.md › Motion)', () => {
  it('calm settles on the target within a second', () => {
    const samples = simulate({ from: 0, to: 100, velocity: 0, spring: SPRINGS.calm, duration: 1000 });
    const last = samples[samples.length - 1]!;
    expect(Math.abs(last.x - 100)).toBeLessThan(0.5);
    expect(Math.abs(last.v)).toBeLessThan(0.05);
  });

  it('calm (damping 1.0) never overshoots from rest', () => {
    const samples = simulate({ from: 0, to: 100, velocity: 0, spring: SPRINGS.calm, duration: 1000 });
    expect(Math.max(...samples.map((s) => s.x))).toBeLessThanOrEqual(100.0001);
  });

  it('flick (damping 0.77) overshoots a little, then settles', () => {
    const samples = simulate({ from: 0, to: 100, velocity: 0, spring: SPRINGS.flick, duration: 1500 });
    const peak = Math.max(...samples.map((s) => s.x));
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThan(110);
    expect(Math.abs(samples[samples.length - 1]!.x - 100)).toBeLessThan(0.5);
  });

  it('hands off release velocity: a moving start runs ahead of a still one', () => {
    const still = simulate({ from: 0, to: 100, velocity: 0, spring: SPRINGS.calm, duration: 32 });
    const moving = simulate({ from: 0, to: 100, velocity: 2, spring: SPRINGS.calm, duration: 32 });
    expect(moving[moving.length - 1]!.x).toBeGreaterThan(still[still.length - 1]!.x);
  });

  it('reduced motion jumps straight to the target', () => {
    const onUpdate = vi.fn();
    const onDone = vi.fn();
    animateSpring({ from: 0, to: 40, spring: SPRINGS.calm, onUpdate, onDone, reducedMotion: true });
    expect(onUpdate).toHaveBeenCalledWith(40, 0);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
