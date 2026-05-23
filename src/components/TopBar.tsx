import { useStore } from "../store/store";
import { Slider } from "./common";

export function TopBar() {
  const mixer = useStore((s) => s.mixer);
  const setMixer = useStore((s) => s.setMixer);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark">🍻</span>
        <div>
          <h1>TavernLoops</h1>
          <p>TTRPG Audio Console</p>
        </div>
      </div>

      <div className="mixer">
        <div className="mixer__channel mixer__channel--master">
          <Slider
            label="Master"
            value={mixer.master}
            onChange={(v) => setMixer({ master: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label="Musik"
            value={mixer.music}
            onChange={(v) => setMixer({ music: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label="Ambient"
            value={mixer.ambient}
            onChange={(v) => setMixer({ ambient: v })}
          />
        </div>
        <div className="mixer__channel">
          <Slider
            label="Effekte"
            value={mixer.soundboard}
            onChange={(v) => setMixer({ soundboard: v })}
          />
        </div>
      </div>
    </header>
  );
}
