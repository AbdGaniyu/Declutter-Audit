'use client';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { iconProps } from '@/components/icons';
import { formatNaira } from '@/lib/money';
import { isArmed, isDragging, releaseOutcome, slideProgress } from '@/lib/slide';
import { SPRINGS, animateSpring, type SpringHandle } from '@/lib/spring';

export type SlideState = 'ready' | 'placing' | 'paused';

const INSET = 4;
const THUMB = 48;

/**
 * DESIGN.md › Slide to bid. One focusable button: slide past 85% and release,
 * flick, tap, or press Enter/Space to bid. Bids are final.
 */
export function SlideToBid({
  amount,
  state,
  pausedLabel = 'Bidding paused',
  onBid,
}: {
  amount: number;
  state: SlideState;
  /** Why bidding is paused (reconnecting, verify phone, own lot…). */
  pausedLabel?: string;
  onBid: () => void;
}) {
  const track = useRef<HTMLButtonElement>(null);
  const [travel, setTravel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const anim = useRef<SpringHandle | null>(null);
  const gesture = useRef<{ id: number; x0: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null);
  const armedRef = useRef(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setTravel(Math.max(0, el.clientWidth - THUMB - INSET * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const springTo = (to: number, velocity = 0, spring: typeof SPRINGS.calm | typeof SPRINGS.flick = SPRINGS.flick) => {
    const from = anim.current?.stop().x ?? progress;
    anim.current = animateSpring({ from, to, velocity, spring, onUpdate: (x) => setProgress(x) });
  };

  // Once a bid settles (placing → ready/paused), the thumb springs home.
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === 'placing' && state !== 'placing') springTo(0, 0, SPRINGS.calm);
    prevState.current = state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => () => void anim.current?.stop(), []);

  const bid = () => {
    // Paused mid-drag (connection dropped, lot ended): don't bid, and don't strand the thumb.
    if (state !== 'ready') return springTo(0);
    springTo(1, 0, SPRINGS.calm);
    onBid();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (state !== 'ready' || e.button !== 0) return;
    anim.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { id: e.pointerId, x0: e.clientX - progress * travel, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    if (!g.moved && !isDragging(dx)) return;
    if (!g.moved) {
      g.moved = true;
      setDragging(true);
    }
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.v = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    const p = slideProgress(dx, travel);
    const armed = isArmed(p);
    if (armed && !armedRef.current) navigator.vibrate?.(8); // one tick at 85%
    armedRef.current = armed;
    setProgress(p);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    armedRef.current = false;
    if (!g.moved) return bid(); // a tap bids too
    // Stale velocity if the finger paused before lifting.
    const v = e.timeStamp - g.lastT > 80 ? 0 : g.v;
    if (releaseOutcome({ progress, velocity: v, trackWidth: travel }) === 'bid') return bid();
    springTo(0, travel ? -v / travel : 0);
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setDragging(false);
    springTo(0);
  };

  const paused = state === 'paused';
  const armed = dragging && isArmed(progress);
  const money = formatNaira(amount);
  const label = paused ? pausedLabel : state === 'placing' ? 'Placing bid…' : armed ? `Release to bid ${money}` : `Slide to bid ${money}`;
  const x = Math.max(-0.2, Math.min(1.2, progress)) * travel;

  return (
    <button
      ref={track}
      type="button"
      aria-label={paused ? pausedLabel : `Bid ${money}`}
      aria-disabled={state !== 'ready'}
      aria-busy={state === 'placing' || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // Keyboard (Enter/Space) arrives as a click with detail 0; pointers are handled above.
      onClick={(e) => e.detail === 0 && bid()}
      className={`relative flex h-14 w-full touch-none select-none items-center overflow-hidden rounded-pill
        ${paused ? 'bg-fill text-secondary' : 'bg-accent text-white'} ${state === 'ready' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
    >
      <span className={`pointer-events-none flex-1 truncate px-16 text-center text-headline transition-opacity duration-200
        ${dragging && !armed ? 'opacity-70' : 'opacity-100'}`}>
        {label}
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-pill
          ${paused ? 'bg-surface text-secondary' : 'bg-white text-accent'} ${dragging ? 'shadow-float' : ''} transition-shadow duration-200`}
        // The thumb lifts on touch (scale) and snaps to the end once armed.
        style={{ transform: `translateX(${armed || state === 'placing' ? travel : x}px) scale(${dragging ? 1.06 : 1})` }}
      >
        {state === 'placing'
          ? <Loader2 {...iconProps} size={22} className="animate-spin motion-reduce:animate-none" />
          : <ArrowRight {...iconProps} size={22} strokeWidth={2.2} />}
      </span>
    </button>
  );
}
