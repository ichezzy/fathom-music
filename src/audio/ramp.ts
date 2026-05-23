export interface RampOptions {
  from: number;
  to: number;
  durationMs: number;
  onUpdate: (value: number) => void;
  onDone?: () => void;
}

/** Linearly ramp a value over time using rAF. Returns a cancel function. */
export function rampValue(opts: RampOptions): () => void {
  const { from, to, durationMs, onUpdate, onDone } = opts;
  if (durationMs <= 0) {
    onUpdate(to);
    onDone?.();
    return () => {};
  }

  let raf = 0;
  let cancelled = false;
  const start = performance.now();

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    onUpdate(from + (to - from) * t);
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };

  raf = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
