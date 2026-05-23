import { useEffect, useRef } from "react";
import { useStore } from "./store/store";
import { TopBar } from "./components/TopBar";
import { MusicSection } from "./components/MusicSection";
import { AmbientSection } from "./components/AmbientSection";
import { SoundboardSection } from "./components/SoundboardSection";
import { NowPlayingBar } from "./components/NowPlayingBar";
import { UpdateBanner } from "./components/UpdateBanner";

export function App() {
  const ready = useStore((s) => s.ready);
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

  return (
    <div className="app">
      <UpdateBanner />
      <TopBar />

      {ready ? (
        <main className="layout">
          <MusicSection />
          <div className="layout__side">
            <AmbientSection />
            <SoundboardSection />
          </div>
        </main>
      ) : (
        <div className="boot">Lade…</div>
      )}

      <NowPlayingBar />

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
