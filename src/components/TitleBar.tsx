import { useEffect, useState } from "react";
import { desktop } from "../lib/desktop";

/**
 * Custom title bar for the frameless Windows window. The strip itself is the
 * OS drag handle; the three buttons on the right are marked no-drag and call
 * into the main process. Alt+F4 / taskbar close remain as a fallback.
 */
export function TitleBar() {
  const controls = desktop?.windowControls;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!controls) return;
    void controls.isMaximized().then(setMaximized);
    return controls.onMaximizeChange(setMaximized);
  }, [controls]);

  return (
    <div className="titlebar">
      <span className="titlebar__mark">🌊</span>
      <span className="titlebar__name">Fathom Music</span>
      <div className="titlebar__controls">
        <button
          className="titlebar__btn"
          aria-label="Minimize"
          onClick={() => void controls?.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="titlebar__btn"
          aria-label="Maximize"
          onClick={() => void controls?.maximizeToggle()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2.5" y="1" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="1" y="2.5" width="6" height="6" fill="var(--bg-2)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          aria-label="Close"
          onClick={() => void controls?.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
