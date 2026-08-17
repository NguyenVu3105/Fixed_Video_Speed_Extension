import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react';
import { DIAL_STEP, DIAL_TICKS, SPEED_MAX, SPEED_MIN } from '../constants';
import { useI18n } from '../i18n';

// ─── Geometry ────────────────────────────────────────────────────────────────
// The gauge sweeps 270° with the gap centered at the bottom. Angles (φ) are
// measured clockwise from 12 o'clock: the arc runs from φ=225° (bottom-left)
// through the top to φ=135° (bottom-right).
//
// The scale is LINEAR from SPEED_MIN to SPEED_MAX. Dragging never teleports:
// the pointer only sets a target, and the value walks toward it one uniform
// DIAL_STEP (0.25x) increment per animation frame — dragging from 8x to 16x
// passes through 8.25, 8.5, 8.75, … instead of jumping straight to 16.
//
// While the user is dragging — and while the value is still walking toward
// the drag target after release — the dial is the single source of truth. It
// keeps its own `value` state and ignores the `speed` prop. This avoids a
// feedback race: every step is saved to storage, the subscription re-derives
// `speed` and feeds it back, and React batches those updates so the prop lags
// behind the value we just emitted. Adopting the lagged echo mid-walk would
// cancel the walk and snap the pointer (the "8x jumps to 16x" bug). After the
// last emission we also ignore the prop for a short grace window so trailing
// echoes settle harmlessly before external changes are accepted again.

const VIEW_W = 220;
const VIEW_H = 170;
const CX = 110;
const CY = 96;
const R = 68;
const START_ANGLE = 225;
const SWEEP = 270;

/** Ignore the `speed` prop this long after our own last emission. */
const ECHO_GRACE_MS = 250;

function clampSpeed(value: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

/** Maps a speed onto the 0..1 arc position (linear scale). */
function speedToT(speed: number): number {
  return (clampSpeed(speed) - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
}

/** Inverse of speedToT: snaps to uniform DIAL_STEP increments. */
function tToSpeed(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const speed = SPEED_MIN + clamped * (SPEED_MAX - SPEED_MIN);
  const stepped = Math.round(speed / DIAL_STEP) * DIAL_STEP;
  // Round away float noise (e.g. 7 * 0.25 = 1.7500000000000002).
  return clampSpeed(Math.round(stepped * 100) / 100);
}

/** Point on the dial at angle φ (degrees clockwise from 12 o'clock). */
function polar(radius: number, phiDeg: number): { x: number; y: number } {
  const phi = (phiDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(phi), y: CY - radius * Math.cos(phi) };
}

/** SVG arc path between two arc positions t0 < t1 (both in 0..1). */
function describeArc(radius: number, t0: number, t1: number): string {
  const a0 = START_ANGLE + SWEEP * t0;
  const a1 = START_ANGLE + SWEEP * t1;
  const start = polar(radius, a0);
  const end = polar(radius, a1);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

// Tick label geometry is a pure function of fixed constants — computed once.
const TICKS = DIAL_TICKS.map((speed) => {
  const t = speedToT(speed);
  const phi = START_ANGLE + SWEEP * t;
  const label = polar(R + 20, phi);
  return { speed, label };
});

// ─── Component ───────────────────────────────────────────────────────────────

interface SpeedDialProps {
  readonly speed: number;
  readonly onChange: (speed: number) => void;
}

export function SpeedDial({ speed, onChange }: SpeedDialProps): ReactElement {
  const { t: tr } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  // `value` is what we render; `valueRef` mirrors it so the rAF stepping loop
  // always reads the latest value without going stale between renders.
  const [value, setValue] = useState(speed);
  const valueRef = useRef(speed);
  const draggingRef = useRef(false);
  const targetRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEmitTimeRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Adopt an externally-driven speed (presets, profile, custom input, another
  // extension context) — but only when fully idle and outside the echo grace
  // window. While dragging/walking, or right after we emitted, the incoming
  // prop is our own save echoing back (possibly lagged) and must be ignored.
  useEffect(() => {
    if (draggingRef.current || targetRef.current !== null) return;
    if (Date.now() - lastEmitTimeRef.current < ECHO_GRACE_MS) return;
    valueRef.current = speed;
    setValue(speed);
  }, [speed]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /** Publishes a stepped value to local state and to the parent. */
  const commit = useCallback((next: number): void => {
    valueRef.current = next;
    setValue(next);
    lastEmitTimeRef.current = Date.now();
    onChangeRef.current(next);
  }, []);

  /** Advances the value one DIAL_STEP toward the target, each frame. */
  const stepTowardTarget = useCallback((): void => {
    rafRef.current = null;
    const target = targetRef.current;
    if (target === null) return;
    const current = valueRef.current;
    if (Math.abs(target - current) < DIAL_STEP / 2) {
      targetRef.current = null;
      if (target !== current) commit(target);
      return;
    }
    const next =
      target > current ? current + DIAL_STEP : current - DIAL_STEP;
    commit(clampSpeed(Math.round(next * 100) / 100));
    rafRef.current = window.requestAnimationFrame(stepTowardTarget);
  }, [commit]);

  /** Sets the drag target; the stepping loop walks the value toward it. */
  const moveTo = useCallback(
    (target: number): void => {
      targetRef.current = target;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(stepTowardTarget);
      }
    },
    [stepTowardTarget],
  );

  /** Converts a pointer position into a target speed. */
  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (svg === null) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * VIEW_W - CX;
      const y = ((clientY - rect.top) / rect.height) * VIEW_H - CY;
      // φ clockwise from 12 o'clock, normalized into [0, 360).
      let phi = (Math.atan2(x, -y) * 180) / Math.PI;
      if (phi < 0) phi += 360;
      // Position along the arc, wrapped past the 360° seam. The arc starts at
      // φ=225° and sweeps 270°, so positions on the right half of the dial
      // (φ < 135°, i.e. speeds above ~8x) come out negative before wrapping —
      // they must wrap to the 0.5..1 range, NOT snap to an arc end.
      let arcT = (phi - START_ANGLE) / SWEEP;
      if (arcT < 0) arcT += 360 / SWEEP;
      // arcT > 1 means the pointer is inside the bottom gap: snap to the
      // nearer arc end (gap midpoint at φ=180° ↔ arcT = 1.1667).
      if (arcT > 1) arcT = arcT > 1 + (360 / SWEEP - 1) / 2 ? 0 : 1;
      moveTo(tToSpeed(arcT));
    },
    [moveTo],
  );

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!draggingRef.current) return;
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (): void => {
    draggingRef.current = false;
  };

  const t = speedToT(value);
  const pointer = polar(R, START_ANGLE + SWEEP * t);

  return (
    <div className="speed-dial">
      <svg
        ref={svgRef}
        className="speed-dial__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="slider"
        aria-label={tr('speed.dial')}
        aria-valuemin={SPEED_MIN}
        aria-valuemax={SPEED_MAX}
        aria-valuenow={value}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <linearGradient id="dial-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={describeArc(R, 0, 1)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress */}
        {t > 0.004 && (
          <path
            d={describeArc(R, 0, t)}
            fill="none"
            stroke="url(#dial-gradient)"
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}

        {/* Tick labels */}
        {TICKS.map((tick) => (
          <text
            key={tick.speed}
            className="speed-dial__tick-label"
            x={tick.label.x}
            y={tick.label.y}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {`${tick.speed}x`}
          </text>
        ))}

        {/* Pointer */}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r="7"
          fill="#fff"
          stroke="#8b5cf6"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.8))' }}
        />
      </svg>
    </div>
  );
}
