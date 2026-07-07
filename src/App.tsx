import { useEffect, useRef } from "react";
import { useStore } from "./store/store";
import { actionFor } from "./lib/hotkeys";
import type { HotkeyAction } from "./lib/hotkeys";
import { TopBar } from "./components/TopBar";
import { MainMenu } from "./components/MainMenu";
import { MusicSection } from "./components/MusicSection";
import { AmbientSection } from "./components/AmbientSection";
import { SoundboardSection } from "./components/SoundboardSection";
import { NowPlayingBar } from "./components/NowPlayingBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { MiniPlayer } from "./components/MiniPlayer";
import { ConfirmDialog } from "./components/ConfirmDialog";

export function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const mini = useStore((s) => s.miniPlayer);
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
      if (!s.ready || s.view !== "campaign" || s.confirmRequest) return;
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
      const action = actionFor(
        e.code,
        s.settings.hotkeys as Partial<Record<HotkeyAction, string>> | undefined,
      );
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case "togglePlay":
          s.togglePlay();
          break;
        case "next":
          s.next();
          break;
        case "previous":
          s.previous();
          break;
        case "stopLoops":
          s.soundboard_engine?.stopAllLoops();
          break;
        default: {
          // pad1..pad9
          const padIndex = Number(action.replace("pad", "")) - 1;
          const fx = s.soundboard[padIndex];
          if (fx) s.playEffect(fx.id);
        }
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
      ) : mini ? (
        <MiniPlayer />
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

      <ConfirmDialog />

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
