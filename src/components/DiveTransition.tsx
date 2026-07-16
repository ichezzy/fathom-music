import { useEffect, useRef } from "react";
import { useStore } from "../store/store";
import d20 from "../assets/d20.png";
import diveInSound from "../assets/dive_in.mp3";
import diveOutSound from "../assets/dive_out.mp3";

/**
 * Cinematic dive transitions between the menu and a campaign, ported from the
 * design handoff prototype (Redesign / "Dive Transition.dc.html") — the
 * timeline math and ocean rendering follow that reference nearly verbatim.
 *
 *  • Dive In (~5s):  menu → player. The Fathom d20 leaps from the menu header
 *    to screen center (hitting it at ~0.49s, synced to the splash in the
 *    audio), sinks through darkening water into the abyss, then flies down and
 *    lands in the transport bar as the play button.
 *  • Dive Out (~4.5s): player → menu. The d20 rises from the play button to
 *    center, ascends through brightening water with light pulses, surfaces in
 *    a fast rush with a bright flash, and lands back in the menu header.
 *
 * Architecture: a full-viewport <canvas> (ocean scene, doubles as a click
 * shield) plus one absolutely-positioned d20 <img> "flyer" moved per frame,
 * driven by a single requestAnimationFrame loop. Anchor positions are measured
 * live from the DOM via [data-d20-anchor] (menu-logo, play-button) — never
 * hardcoded — and the real anchor element is hidden while the flyer is aloft.
 *
 * Mounted permanently in <App>; renders nothing unless a transition runs.
 * Honours prefers-reduced-motion (instant switch, audio still plays). The
 * settings toggle that disables the animation entirely is handled in the
 * store's begin* actions, so this never even mounts then.
 */
export function DiveTransition() {
  const mode = useStore((s) => s.transitionMode);
  const id = useStore((s) => s.transitionCampaignId);
  if (!mode) return null;
  return <Overlay key={`${mode}-${id ?? ""}`} mode={mode} />;
}

// --- easing helpers (verbatim from the prototype) ---
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) =>
  k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const easeInQuad = (k: number) => k * k;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k: number) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
const smoothstep = (a: number, b: number, v: number) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

type Anchor = { x: number; y: number; s: number; el: HTMLElement | null };

/** Center + size of a [data-d20-anchor] element, in viewport coordinates. */
function measure(name: string): Anchor | null {
  const el = document.querySelector<HTMLElement>(
    `[data-d20-anchor="${name}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    s: Math.max(r.width, r.height),
    el,
  };
}

type Particle = {
  x: number;
  y: number;
  z: number;
  r: number;
  rise: number;
  ph: number;
  kind: "snow" | "bubble" | "glow";
};

function initParticles(density = 1): Particle[] {
  const n = Math.round(150 * density);
  const parts: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    parts.push({
      x: Math.random(),
      y: Math.random(),
      z: 0.25 + 0.75 * Math.random(),
      r: 0.6 + 1.8 * Math.random(),
      rise: 0.03 + 0.07 * Math.random(),
      ph: Math.random() * Math.PI * 2,
      kind: r < 0.6 ? "snow" : r < 0.85 ? "bubble" : "glow",
    });
  }
  return parts;
}

// --- ocean colors: two-stage lerp keyed to depth, lightened by pulses/flash ---
type RGB = [number, number, number];
const mixC = (a: RGB, b: RGB, k: number): RGB =>
  [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], k))) as RGB;

function oceanColors(depth: number, light: number) {
  const surfT: RGB = [36, 122, 164],
    surfB: RGB = [10, 50, 84];
  const midT: RGB = [7, 34, 58],
    midB: RGB = [3, 18, 34];
  const abT: RGB = [2, 8, 16],
    abB: RGB = [0, 2, 5];
  let top: RGB, bot: RGB;
  if (depth < 0.5) {
    const k = depth / 0.5;
    top = mixC(surfT, midT, k);
    bot = mixC(surfB, midB, k);
  } else {
    const k = (depth - 0.5) / 0.5;
    top = mixC(midT, abT, k);
    bot = mixC(midB, abB, k);
  }
  if (light > 0) {
    const lightC: RGB = [214, 248, 255];
    top = mixC(top, lightC, light * 0.9);
    bot = mixC(bot, lightC, light * 0.55);
  }
  const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
  return { top: css(top), bot: css(bot) };
}

function drawOcean(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  t: number,
  depth: number,
  light: number,
  spd: number,
  scroll: number,
  parts: Particle[],
  W: number,
  H: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cols = oceanColors(depth, light);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, cols.top);
  g.addColorStop(1, cols.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // light shafts near the surface
  const shaftA = Math.max(0, 0.5 - depth) * (0.55 + light * 0.9);
  if (shaftA > 0.01) {
    for (let i = 0; i < 5; i++) {
      const bx = W * (0.12 + i * 0.19);
      const sway = Math.sin(t * 0.25 + i * 1.7) * 0.07 + (i - 2) * 0.1;
      ctx.save();
      ctx.translate(bx, -40);
      ctx.rotate(sway);
      const w = 50 + i * 26;
      const sg = ctx.createLinearGradient(0, 0, 0, H * 0.85);
      sg.addColorStop(0, `rgba(190,240,250,${(shaftA * 0.55).toFixed(3)})`);
      sg.addColorStop(1, "rgba(190,240,250,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-w * 0.25, 0);
      ctx.lineTo(w * 0.25, 0);
      ctx.lineTo(w, H * 0.85);
      ctx.lineTo(-w, H * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // particles: marine snow (streaking when fast), bubbles, biolum motes
  const speedMag = Math.abs(spd);
  const streaky = speedMag > 0.3;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let yy = p.y - scroll * p.z;
    if (p.kind === "bubble") yy -= t * p.rise * p.z;
    yy = ((yy % 1) + 1) % 1;
    const px = (p.x + Math.sin(t * 0.4 + p.ph) * 0.006) * W;
    const py = yy * H;
    if (p.kind === "snow") {
      const a = 0.28 * p.z * (0.45 + 0.55 * (1 - depth * 0.6)) + light * 0.15;
      if (streaky) {
        const len = clamp(speedMag * H * 0.09 * p.z, 4, 90);
        ctx.strokeStyle = `rgba(185,225,240,${(a * 0.8).toFixed(3)})`;
        ctx.lineWidth = p.r * p.z;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + (spd > 0 ? len : -len));
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(185,225,240,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r * p.z, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === "bubble") {
      ctx.strokeStyle = `rgba(170,230,245,${(0.3 * p.z + light * 0.2).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, (p.r + 0.8) * p.z * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // bioluminescent motes — only in the deep
      const vis = Math.max(0, depth - 0.35) / 0.65;
      if (vis > 0.01) {
        const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.ph * 5));
        const a = vis * blink * 0.8;
        const rg = ctx.createRadialGradient(px, py, 0, px, py, 7 * p.z);
        rg.addColorStop(0, `rgba(64,228,238,${a.toFixed(3)})`);
        rg.addColorStop(1, "rgba(64,228,238,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(px, py, 7 * p.z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // depth vignette
  if (depth > 0.15) {
    const v = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.3,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.75,
    );
    v.addColorStop(0, "rgba(0,2,6,0)");
    v.addColorStop(1, `rgba(0,2,6,${(depth * 0.55).toFixed(3)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // surface flash bloom from above
  if (light > 0.05) {
    const fg = ctx.createRadialGradient(
      W / 2,
      -H * 0.35,
      0,
      W / 2,
      -H * 0.35,
      H * 1.45,
    );
    fg.addColorStop(0, `rgba(235,252,255,${(light * 0.95).toFixed(3)})`);
    fg.addColorStop(1, "rgba(235,252,255,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
  }
}

function Overlay({ mode }: { mode: "dive" | "surface" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const d20Ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const store = () => useStore.getState();
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Audio starts at t=0 of the transition (triggered by a user click, so
    // autoplay is allowed); volume follows the master mixer level.
    const audio = new Audio(mode === "dive" ? diveInSound : diveOutSound);
    audio.volume = clamp(store().mixer.master, 0, 1);
    const playAudio = () => void audio.play().catch(() => {});

    if (reduce) {
      // Reduced motion: skip the animation entirely — instant view switch,
      // audio still plays (deliberately not stopped by the cleanup).
      playAudio();
      if (mode === "dive") {
        store().enterCampaignBehind();
        store().endCampaignTransition();
      } else {
        store().enterMenuBehind();
        store().endExitTransition();
      }
      return;
    }

    const canvas = canvasRef.current;
    const flyer = d20Ref.current;
    if (!canvas || !flyer) return;

    let dpr = 1;
    const sizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    window.addEventListener("resize", sizeCanvas);
    sizeCanvas();

    // Source anchor: measured live, then hidden while the flyer is aloft.
    const fallbackFrom: Anchor =
      mode === "dive"
        ? { x: 70, y: 34, s: 30, el: null }
        : {
            x: 208 + (canvas.clientWidth - 208) / 2,
            y: canvas.clientHeight - 44,
            s: 40,
            el: null,
          };
    const from =
      measure(mode === "dive" ? "menu-logo" : "play-button") ?? fallbackFrom;
    if (from.el) from.el.style.opacity = "0";

    const parts = initParticles();
    let scroll = 0;
    let raf = 0;
    let last: number | null = null;
    let done = false;
    // per-run one-shot flags + measured landing target
    const F: {
      srcGone?: boolean;
      dstShown?: boolean;
      target?: Anchor;
      flyStart?: { x: number; y: number; s: number; rot: number };
    } = {};

    const setD20 = (
      x: number,
      y: number,
      s: number,
      rot: number,
      opacity: number,
    ) => {
      flyer.style.width = `${s}px`;
      flyer.style.height = `${s}px`;
      flyer.style.transform = `translate3d(${x - s / 2}px,${y - s / 2}px,0) rotate(${rot}deg)`;
      flyer.style.opacity = String(opacity);
    };

    // ---------- DIVE IN (5s) ----------
    const frameIn = (t: number): boolean => {
      const W = canvas.clientWidth,
        H = canvas.clientHeight;
      const cx = W / 2,
        cy = H / 2;
      const dt = last == null ? 0 : Math.max(0, t - last);
      last = t;

      // view switches: menu unmounts under the opaque canvas; the player
      // mounts early (still hidden) so its play anchor can be measured
      if (t >= 1.5 && !F.srcGone) {
        F.srcGone = true;
        store().setView("void");
      }
      if (t >= 4.15 && !F.dstShown) {
        F.dstShown = true;
        store().enterCampaignBehind();
      }
      if (F.dstShown && !F.target) {
        const m = measure("play-button");
        if (m) {
          m.el!.style.opacity = "0";
          F.target = m;
        }
      }

      // depth 0.25 -> 1 across the descent
      let depth: number;
      if (t < 1.5) depth = 0.25 * clamp(t / 1.5, 0, 1);
      else depth = 0.25 + 0.75 * easeInOut(clamp((t - 1.5) / 2.8, 0, 1));

      // camera scroll (descending -> particles drift up)
      let spd = 0.05 + 0.14 * clamp((t - 1.1) / 1.2, 0, 1);
      spd *= 1 - 0.8 * clamp((t - 4.3) / 0.7, 0, 1);
      scroll += spd * dt;

      // canvas opacity: fade in over the leap, fade out to reveal the player
      let cop: number;
      if (t < 0.7) cop = 0;
      else if (t < 1.5) cop = (t - 0.7) / 0.8;
      else if (t < 4.35) cop = 1;
      else cop = 1 - (t - 4.35) / 0.65;
      canvas.style.opacity = String(clamp(cop, 0, 1));
      const ctx = canvas.getContext("2d");
      if (cop > 0 && ctx) drawOcean(ctx, dpr, t, depth, 0, spd, scroll, parts, W, H);

      // d20 choreography — leap hits center at ~0.59s (tuned to the splash)
      const bigS = clamp(Math.min(W, H) * 0.28, 140, 260);
      const B1 = 0.59;
      let x: number, y: number, s: number, rot: number;
      if (t < B1) {
        const kk = clamp(t / B1, 0, 1);
        const k = easeOutBack(kk);
        x = lerp(from.x, cx, k);
        y = lerp(from.y, cy, k);
        s = lerp(from.s, bigS, easeOutCubic(kk));
        rot = -30 + 30 * easeOutCubic(kk);
      } else if (t < 4.3) {
        // hover at center while sinking
        const sink = 30 * easeInOut(clamp((t - B1) / 0.6, 0, 1));
        x = cx + Math.sin(t * 0.7) * 8;
        y = cy + sink + Math.sin(t * 1.1) * 10;
        s = bigS + Math.sin(t * 0.9) * 5;
        rot = 12 * (t - B1);
      } else {
        // fly down into the transport bar and land as the play button
        if (!F.flyStart) {
          F.flyStart = {
            x: cx + Math.sin(4.3 * 0.7) * 8,
            y: cy + 30 + Math.sin(4.3 * 1.1) * 10,
            s: bigS + Math.sin(4.3 * 0.9) * 5,
            rot: 12 * (4.3 - B1),
          };
        }
        const tgt = F.target ?? { x: 208 + (W - 208) / 2, y: H - 44, s: 40, el: null };
        const k = easeInOut(clamp((t - 4.3) / 0.7, 0, 1));
        x = lerp(F.flyStart.x, tgt.x, k);
        y = lerp(F.flyStart.y, tgt.y, k);
        s = lerp(F.flyStart.s, tgt.s, k);
        rot = lerp(F.flyStart.rot, 360, k);
      }
      setD20(x, y, s, rot, 1);
      return t >= 5;
    };

    // ---------- DIVE OUT (4.5s) ----------
    const frameOut = (t: number): boolean => {
      const W = canvas.clientWidth,
        H = canvas.clientHeight;
      const cx = W / 2,
        cy = H / 2;
      const dt = last == null ? 0 : Math.max(0, t - last);
      last = t;

      if (t >= 1 && !F.srcGone) {
        F.srcGone = true;
        store().setView("void");
      }
      if (t >= 3.0 && !F.dstShown) {
        F.dstShown = true;
        store().enterMenuBehind();
      }
      if (F.dstShown && !F.target) {
        const m = measure("menu-logo");
        if (m) {
          m.el!.style.opacity = "0";
          F.target = m;
        }
      }

      // depth: abyss -> surface; slow 1..2, accelerating 2..4
      let depth: number;
      if (t < 1) depth = 1;
      else if (t < 2) depth = 1 - 0.45 * easeInOut(t - 1);
      else depth = 0.55 * (1 - easeInQuad(clamp((t - 2) / 2, 0, 1)));

      // brightness pulses on the slow ascent + final surface flash
      const pulse =
        t > 1 && t < 2.6
          ? Math.max(0, Math.sin((t - 1) * 2.6)) * 0.16 * clamp((t - 1) / 1.5, 0, 1)
          : 0;
      const flash = smoothstep(3.0, 3.7, t);
      const light = clamp(pulse + flash, 0, 1);

      // camera scroll (ascending -> particles drift down), ramping fast after t=2
      const spd = -(
        t < 1
          ? 0.03
          : 0.11 + 0.8 * (t > 2 ? easeInQuad(clamp((t - 2) / 2, 0, 1)) : 0)
      );
      scroll += spd * dt;

      let cop: number;
      if (t < 0.3) cop = 0;
      else if (t < 0.9) cop = (t - 0.3) / 0.6;
      else if (t < 3.9) cop = 1;
      else cop = 1 - (t - 3.9) / 0.6;
      canvas.style.opacity = String(clamp(cop, 0, 1));
      const ctx = canvas.getContext("2d");
      if (cop > 0 && ctx)
        drawOcean(ctx, dpr, t, depth, light, spd, scroll, parts, W, H);

      const bigS = clamp(Math.min(W, H) * 0.28, 140, 260);
      let x: number, y: number, s: number, rot: number;
      if (t < 1) {
        // rise from the play button to center
        const k = easeInOut(clamp(t, 0, 1));
        x = lerp(from.x, cx, k);
        y = lerp(from.y, cy, k);
        s = lerp(from.s, bigS, k);
        rot = -20 * k;
      } else if (t < 3.4) {
        // hover, drifting upward once the fast ascent starts (counter-spin);
        // the drift begins at 1.8s, slightly ahead of the ocean's fast phase
        x = cx + Math.sin(t * 0.7) * 8;
        y = cy + Math.sin(t * 1.1) * 10 - (t > 1.8 ? (t - 1.8) * 14 : 0);
        s = bigS + Math.sin(t * 0.9) * 5;
        rot = -20 - 12 * (t - 1);
      } else {
        // fly up into the menu header and land as the logo mark
        if (!F.flyStart) {
          F.flyStart = {
            x: cx + Math.sin(3.4 * 0.7) * 8,
            y: cy + Math.sin(3.4 * 1.1) * 10 - 1.6 * 14,
            s: bigS + Math.sin(3.4 * 0.9) * 5,
            rot: -20 - 12 * 2.4,
          };
        }
        const tgt = F.target ?? { x: 70, y: 34, s: 30, el: null };
        const k = easeInOut(clamp((t - 3.4) / 0.8, 0, 1));
        x = lerp(F.flyStart.x, tgt.x, k);
        y = lerp(F.flyStart.y, tgt.y, k);
        s = lerp(F.flyStart.s, tgt.s, k);
        rot = lerp(F.flyStart.rot, -360, k);
      }
      setD20(x, y, s, rot, 1);
      return t >= 4.5;
    };

    const restoreAnchors = () => {
      if (from.el) from.el.style.opacity = "";
      if (F.target?.el) F.target.el.style.opacity = "";
    };

    const end = () => {
      if (done) return;
      done = true;
      canvas.style.opacity = "0";
      flyer.style.opacity = "0";
      restoreAnchors();
      if (mode === "dive") store().endCampaignTransition();
      else store().endExitTransition();
    };

    playAudio();
    const t0 = performance.now();
    let fallback = 0;
    const step = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      const t = (performance.now() - t0) / 1000;
      let finished = false;
      try {
        finished = mode === "dive" ? frameIn(t) : frameOut(t);
      } catch (e) {
        console.error(e);
        finished = true;
      }
      if (finished) {
        end();
        return;
      }
      raf = requestAnimationFrame(step);
      // rAF is throttled/paused while the window is hidden or minimized; this
      // slow timer keeps the timeline progressing (and finishing) even then.
      fallback = window.setTimeout(step, 250);
    };
    step();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.removeEventListener("resize", sizeCanvas);
      audio.pause();
      restoreAnchors();
    };
  }, [mode]);

  return (
    <>
      {/* Ocean scene; also shields the UI from clicks while the dive runs. */}
      <canvas
        ref={canvasRef}
        className="dive-transition"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1001,
          opacity: 0,
          pointerEvents: "auto",
        }}
      />
      <img
        ref={d20Ref}
        src={d20}
        alt=""
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          zIndex: 1002,
          opacity: 0,
          pointerEvents: "none",
          willChange: "transform",
        }}
      />
    </>
  );
}
