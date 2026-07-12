import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/store";
import { useT } from "../lib/i18n";
import { getFileUrl } from "../lib/db";
import type { Campaign } from "../types";
import logo from "../assets/logo.png";

/**
 * Cinematic transition between the menu and a campaign.
 *
 *  • "dive"    — opening a campaign from the menu: the card fills the screen,
 *                the name surfaces, then the image plunges into dark water and
 *                the player fades in from the deep.
 *  • "surface" — leaving a campaign: the player sinks into the dark, the
 *                campaign image rises back toward the light, and the menu
 *                dissolves in.
 *
 * Mounted permanently in <App>; renders nothing unless a transition is active.
 * Honours prefers-reduced-motion by skipping the plunge.
 */
export function CampaignTransition() {
  const mode = useStore((s) => s.transitionMode);
  const id = useStore((s) => s.transitionCampaignId);
  const campaigns = useStore((s) => s.campaigns);
  const endDive = useStore((s) => s.endCampaignTransition);
  const endExit = useStore((s) => s.endExitTransition);
  const enterMenuBehind = useStore((s) => s.enterMenuBehind);

  const campaign = id ? campaigns.find((c) => c.id === id) ?? null : null;
  if (!mode || !campaign) return null;

  // Keyed by mode+id so the animation restarts cleanly for each run.
  return (
    <TransitionOverlay
      key={`${mode}-${campaign.id}`}
      campaign={campaign}
      direction={mode}
      onDone={mode === "dive" ? endDive : endExit}
      onEnterMenu={enterMenuBehind}
    />
  );
}

type Direction = "dive" | "surface";
type Phase =
  | "expanding"
  | "title"
  | "diving"
  | "dark"
  | "rising"
  | "surface"
  | "contracting";

// Playback speed of the whole sequence. 1 = original Figma pace; 2 roughly
// doubles the runtime for a slower, more cinematic descent/ascent.
const SPEED = 2;
const secs = (base: number) => `${(base * SPEED).toFixed(2)}s`;
const ms = (base: number) => base * SPEED;

const ACCENT = "#00c4d4";

function TransitionOverlay({
  campaign,
  direction,
  onDone,
  onEnterMenu,
}: {
  campaign: Campaign;
  direction: Direction;
  onDone: () => void;
  onEnterMenu: () => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>(
    direction === "dive" ? "expanding" : "dark",
  );
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  // "surface" fades its container in over the player; "dive" uses a keyframe.
  const [entered, setEntered] = useState(direction === "dive");
  const doneRef = useRef(false);

  // Load the campaign's background image (stored as a blob), if any.
  useEffect(() => {
    let active = true;
    if (campaign.imageFileId) {
      void getFileUrl(campaign.imageFileId).then((u) => {
        if (active) setImgUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [campaign.imageFileId]);

  // Trigger the surface container's fade-in on the frame after mount.
  useEffect(() => {
    if (direction !== "surface") return;
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, [direction]);

  // Drive the phase timeline.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (delay: number, fn: () => void) =>
      timers.push(setTimeout(fn, delay));
    const finish = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };

    if (direction === "dive") {
      if (reduce) {
        setPhase("title");
        at(ms(500), finish);
      } else {
        at(ms(520), () => setPhase("title"));
        at(ms(2000), () => setPhase("diving"));
        at(ms(3150), () => setPhase("dark"));
        at(ms(3800), finish);
      }
    } else {
      // surface
      if (reduce) {
        onEnterMenu();
        at(ms(350), finish);
      } else {
        // A quick ascent: cover the player, swap the menu in behind the
        // opaque water, then let the water recede upward to reveal it.
        at(ms(450), () => {
          onEnterMenu();
          setPhase("rising");
        });
        at(ms(1500), finish);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [direction, onDone, onEnterMenu]);

  const color = campaign.color ?? "#0a1e38";

  const waterMoving =
    (direction === "dive" && phase === "diving") ||
    (direction === "surface" && phase === "rising");
  const showBubbles =
    (direction === "dive" && (phase === "diving" || phase === "dark")) ||
    (direction === "surface" && (phase === "dark" || phase === "rising"));
  // The centered mark is only the "dive" arrival beat; surfacing stays clean.
  const showDarkMark = direction === "dive" && phase === "dark";
  // The campaign name is a "dive"-only beat; surfacing just rises, no title.
  const showTitle = direction === "dive" && phase === "title";
  const titleLeaving = direction === "dive" && phase === "diving";

  const img = imageAnim(direction, phase);
  const water = waterAnim(direction, phase);

  // Deterministic pseudo-random bubbles rising through the water.
  const bubbles = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        x: 1 + ((i * 7.31) % 97),
        size: 4 + ((i * 3.77) % 13),
        duration: 1.1 + ((i * 0.43) % 1.9),
        delay: (i * 0.19) % 2.0,
        opacity: 0.1 + ((i * 0.08) % 0.32),
        startY: (i * 13) % 40,
      })),
    [],
  );

  // Slanted light rays cutting through the water.
  const rays = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        x: 5 + i * 10.5,
        angle: -20 + i * 4.5,
        duration: 1.8 + i * 0.3,
        delay: i * 0.18,
      })),
    [],
  );

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1001,
    overflow: "hidden",
    ...(direction === "dive"
      ? {
          animation: `overlayIn ${secs(
            0.45,
          )} cubic-bezier(0.2,0,0.4,1) forwards`,
        }
      : {
          opacity: entered ? 1 : 0,
          transition: `opacity ${secs(0.3)} ease`,
        }),
  };

  return (
    <div className="campaign-transition" style={containerStyle}>
      {/* Background campaign artwork — "dive" only. Surfacing is a quick rise
          from the player to the menu and never shows the campaign image; the
          dark water simply recedes upward to reveal the menu behind it. */}
      {direction === "dive" && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transition: img.transition,
              transform: img.transform,
              filter: img.filter,
            }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `radial-gradient(ellipse at 50% 35%, ${color} 0%, #030d18 100%)`,
                }}
              >
                <img
                  src={logo}
                  alt=""
                  aria-hidden
                  style={{ width: "34%", maxWidth: 260, opacity: 0.5 }}
                />
              </div>
            )}
          </div>

          {/* base vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(3,13,24,0.55) 100%)",
            }}
          />
        </>
      )}

      {/* campaign title block */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: showTitle ? 1 : 0,
          transform: titleLeaving
            ? "translateY(-40px) scale(0.95)"
            : "translateY(0) scale(1)",
          transition: `opacity ${secs(0.7)} ease, transform ${secs(
            1.3,
          )} cubic-bezier(0.4,0,1,1)`,
        }}
      >
        {(campaign.tags?.length ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {campaign.tags!.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  padding: "3px 11px",
                  borderRadius: 20,
                  background: "rgba(0,196,212,0.15)",
                  border: "1px solid rgba(0,196,212,0.3)",
                  color: ACCENT,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 52,
            fontWeight: 600,
            color: "#edf6fb",
            letterSpacing: "0.06em",
            textShadow:
              "0 0 60px rgba(0,196,212,0.35), 0 4px 24px rgba(0,0,0,0.9)",
            margin: 0,
            padding: "0 24px",
            textAlign: "center",
            animation: showTitle
              ? `titleIn ${secs(0.6)} cubic-bezier(0.2,0,0.4,1) forwards`
              : "none",
          }}
        >
          {campaign.name}
        </h1>
        {campaign.description && (
          <p
            style={{
              color: "rgba(196,228,242,0)",
              marginTop: 16,
              fontSize: 14,
              textAlign: "center",
              maxWidth: 520,
              padding: "0 24px",
              lineHeight: 1.6,
              animation: showTitle
                ? `subtitleIn ${secs(0.7)} ease ${secs(0.2)} forwards`
                : "none",
            }}
          >
            {campaign.description}
          </p>
        )}
        {direction === "dive" && (
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(0,196,212,0.45)",
              animation: showTitle
                ? `fadeIn ${secs(0.5)} ease ${secs(
                    0.6,
                  )} both, depthPulse 2s ease-in-out ${secs(1.1)} infinite`
                : "none",
            }}
          >
            {t("menu.preparingDive")}
          </div>
        )}
      </div>

      {/* dark water: descends from the top (dive) or recedes upward (surface) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          overflow: "visible",
          pointerEvents: "none",
          height: water.height,
          background:
            "linear-gradient(180deg, #000810 0%, #000d1a 35%, #001428 70%, rgba(0,18,38,0.98) 100%)",
          transition: water.transition,
        }}
      >
        {/* wavy leading edge — only while the water is moving */}
        {waterMoving && (
          <div
            style={{
              position: "absolute",
              bottom: -34,
              left: 0,
              right: 0,
              height: 70,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <svg
              viewBox="0 0 2880 70"
              preserveAspectRatio="none"
              style={{
                width: "200%",
                height: "100%",
                position: "absolute",
                left: 0,
                bottom: 0,
                animation: "waveShift 1.8s linear infinite",
              }}
            >
              <path
                d="M0,38 C240,62 480,14 720,38 C960,62 1200,14 1440,38 C1680,62 1920,14 2160,38 C2400,62 2640,14 2880,38 L2880,0 L0,0 Z"
                fill="#000810"
              />
            </svg>
            <svg
              viewBox="0 0 2880 70"
              preserveAspectRatio="none"
              style={{
                width: "200%",
                height: "100%",
                position: "absolute",
                left: 0,
                bottom: 0,
                animation: "waveShift 2.8s linear infinite reverse",
                opacity: 0.5,
              }}
            >
              <path
                d="M0,22 C240,6 480,46 720,22 C960,6 1200,46 1440,22 C1680,6 1920,46 2160,22 C2400,6 2640,46 2880,22 L2880,0 L0,0 Z"
                fill="rgba(0,80,130,0.55)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                bottom: 34,
                left: 0,
                right: 0,
                height: 2,
                background: "rgba(0,196,212,0.3)",
                boxShadow:
                  "0 0 12px rgba(0,196,212,0.5), 0 0 30px rgba(0,196,212,0.2)",
              }}
            />
          </div>
        )}

        {/* light rays */}
        {waterMoving && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {rays.map((r) => (
              <div
                key={r.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${r.x}%`,
                  width: 1,
                  height: "55%",
                  background:
                    "linear-gradient(to bottom, rgba(0,196,212,0.25), transparent)",
                  transform: `rotate(${r.angle}deg)`,
                  transformOrigin: "top center",
                  animation: `lightRay ${r.duration}s ease-in-out ${r.delay}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* (no depth/ascent text — the animation speaks for itself) */}
      </div>

      {/* rising bubbles */}
      {showBubbles &&
        bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              pointerEvents: "none",
              bottom: `${b.startY}%`,
              left: `${b.x}%`,
              width: b.size,
              height: b.size,
              borderRadius: "50%",
              border: `1px solid rgba(0,196,212,${b.opacity * 2.8})`,
              background: `rgba(0,196,212,${b.opacity * 0.35})`,
              animation: `bubbleRise ${b.duration}s ease-out ${b.delay}s infinite`,
            }}
          />
        ))}

      {/* Fathom mark pulsing in the dark */}
      {showDarkMark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            pointerEvents: "none",
            animation: `fadeIn ${secs(0.5)} ease ${secs(0.15)} both`,
          }}
        >
          <img
            src={logo}
            alt=""
            aria-hidden
            style={{
              width: 46,
              height: 46,
              opacity: 0.35,
              animation: "depthPulse 1.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              color: "rgba(0,196,212,0.2)",
              letterSpacing: "0.55em",
              textTransform: "uppercase",
            }}
          >
            Fathom
          </span>
        </div>
      )}

      {/* corner loading indicator — the mark bobbing on the water */}
      <div
        style={{
          position: "absolute",
          right: 30,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 9,
          pointerEvents: "none",
        }}
      >
        <img
          src={logo}
          alt=""
          aria-hidden
          style={{
            width: 40,
            height: 40,
            opacity: 0.9,
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.55))",
            animation: "floatBob 2.6s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(0,196,212,0.65)",
            animation: "depthPulse 2s ease-in-out infinite",
          }}
        >
          {t("common.loading")}
        </span>
      </div>
    </div>
  );
}

/** Transform / filter / transition for the background image, per phase. */
function imageAnim(
  direction: Direction,
  phase: Phase,
): { transform: string; filter: string; transition: string } {
  if (direction === "dive") {
    if (phase === "diving")
      return {
        transform: "scale(1.8) translateY(-20%)",
        filter: "brightness(0.35) saturate(0.45) blur(2px)",
        transition: `transform ${secs(1.05)} cubic-bezier(0.55,0,0.9,1), filter ${secs(
          0.9,
        )} ease-in`,
      };
    if (phase === "dark")
      return {
        transform: "scale(2.2) translateY(-32%)",
        filter: "brightness(0) blur(10px)",
        transition: `transform ${secs(0.55)} ease, filter ${secs(0.45)} ease`,
      };
    // expanding / title
    return {
      transform: "scale(1.06)",
      filter: "brightness(0.72)",
      transition: `transform ${secs(0.5)} ease-out, filter ${secs(0.5)} ease`,
    };
  }

  // surface
  if (phase === "rising")
    return {
      transform: "scale(1.32) translateY(-6%)",
      filter: "brightness(0.5) saturate(0.65) blur(1px)",
      transition: `transform ${secs(1.6)} cubic-bezier(0.2,0,0.5,1), filter ${secs(
        1.5,
      )} ease-out`,
    };
  if (phase === "surface")
    return {
      transform: "scale(1.06) translateY(0)",
      filter: "brightness(0.82)",
      transition: `transform ${secs(1.1)} ease-out, filter ${secs(0.9)} ease`,
    };
  if (phase === "contracting")
    return {
      transform: "scale(0.99)",
      filter: "brightness(0.88)",
      transition: `transform ${secs(0.5)} ease, filter ${secs(0.5)} ease`,
    };
  // dark (starting point, deep down)
  return {
    transform: "scale(2.2) translateY(-30%)",
    filter: "brightness(0) blur(10px)",
    transition: "none",
  };
}

/** Height / transition for the dark water sheet, per phase. */
function waterAnim(
  direction: Direction,
  phase: Phase,
): { height: string; transition: string } {
  if (direction === "dive") {
    if (phase === "diving")
      return {
        height: "110%",
        transition: `height ${secs(1.0)} cubic-bezier(0.4,0,0.7,1)`,
      };
    if (phase === "dark")
      return { height: "110%", transition: `height ${secs(0.35)} ease-in` };
    return { height: "0%", transition: "none" };
  }
  // surface — a quick upward recede that uncovers the menu
  if (phase === "dark") return { height: "110%", transition: "none" };
  if (phase === "rising")
    return {
      height: "0%",
      transition: `height ${secs(0.85)} cubic-bezier(0.3,0,0.6,1)`,
    };
  return { height: "0%", transition: "none" };
}
