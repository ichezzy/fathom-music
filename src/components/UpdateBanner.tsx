import { useEffect, useState } from "react";
import { desktop } from "../lib/desktop";
import { useT } from "../lib/i18n";

export function UpdateBanner() {
  const t = useT();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    return desktop.onUpdateDownloaded(({ version }) => setVersion(version));
  }, []);

  if (!desktop || version === null) return null;
  const bridge = desktop;

  return (
    <div className="update-banner">
      <span>{t("update.ready", { version: version ?? "" })}</span>
      <button className="btn btn--small" onClick={() => void bridge.installUpdate()}>
        {t("update.restart")}
      </button>
    </div>
  );
}
