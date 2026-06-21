import { useEffect, useRef } from "react";
import { useStore } from "./store/store";
import { TopBar } from "./components/TopBar";
import { MainMenu } from "./components/MainMenu";
import { MusicSection } from "./components/MusicSection";
import { AmbientSection } from "./components/AmbientSection";
import { SoundboardSection } from "./components/SoundboardSection";
import { NowPlayingBar } from "./components/NowPlayingBar";
import { UpdateBanner } from "./components/UpdateBanner";

export function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const hydrate = useStore((s) => s.hydrate);
  const initEngines = useStore((s) => s.initEngines);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrate();
      if (!cancelled && hostRef.current) initEngines(hostRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate, initEngines]);

  // Global hotkeys (campaign view only; ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useStore.getState();
      if (!s.ready || s.view !== "campaign") return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        s.togglePlay();
      } else if (e.code === "ArrowRight") {
        s.next();
      } else if (e.code === "ArrowLeft") {
        s.previous();
      } else if (e.code === "Escape") {
        s.soundboard_engine?.stopAllLoops();
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const fx = s.soundboard[Number(e.code.slice(5)) - 1];
        if (fx) s.playEffect(fx.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <UpdateBanner />

      {!ready ? (
        <div className="boot">Lade…</div>
      ) : view === "menu" ? (
        <MainMenu />
      ) : (
        <>
          <TopBar />
          <main className="layout">
            <MusicSection />
            <div className="layout__side">
              <AmbientSection />
              <SoundboardSection />
            </div>
          </main>
          <NowPlayingBar />
        </>
      )}

      {/* Hidden host for <audio> + YouTube iframes */}
      <div
        ref={hostRef}
        aria-hidden
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
          bottom: 0,
          left: 0,
        }}
      />
    </div>
  );
}
