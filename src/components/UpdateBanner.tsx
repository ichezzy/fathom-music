import { useEffect, useState } from "react";
import { desktop } from "../lib/desktop";

export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    return desktop.onUpdateDownloaded(({ version }) => setVersion(version));
  }, []);

  if (!desktop || version === null) return null;
  const bridge = desktop;

  return (
    <div className="update-banner">
      <span>Update {version} ist bereit.</span>
      <button className="btn btn--small" onClick={() => void bridge.installUpdate()}>
        Neustarten &amp; aktualisieren
      </button>
    </div>
  );
}
