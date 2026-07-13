/**
 * Line-style icon set for UI controls (transport, navigation, list actions).
 * Emoji are kept only where they're *content* — section headers, campaign
 * marks, ambient/soundboard tiles. Stroke-based so they inherit currentColor.
 */
export type IconName =
  | "play"
  | "pause"
  | "prev"
  | "next"
  | "repeat"
  | "repeatOne"
  | "repeatInfinite"
  | "queue"
  | "settings"
  | "back"
  | "mini"
  | "expand"
  | "trash"
  | "close"
  | "plus"
  | "chevronUp"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "more"
  | "check"
  | "music"
  | "library"
  | "shuffle";

const P: Record<IconName, JSX.Element> = {
  // Filled shapes for the primary transport controls.
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: (
    <path
      d="M7 5h3v14H7zM14 5h3v14h-3z"
      fill="currentColor"
      stroke="none"
    />
  ),
  prev: (
    <path
      d="M7 6v12M18 6L9 12l9 6z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  next: (
    <path
      d="M17 6v12M6 6l9 6-9 6z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  repeat: (
    <path d="M17 2l3 3-3 3M7 22l-3-3 3-3M20 5H8a4 4 0 00-4 4v1M4 19h12a4 4 0 004-4v-1" />
  ),
  repeatOne: (
    <>
      <path d="M17 2l3 3-3 3M7 22l-3-3 3-3M20 5H8a4 4 0 00-4 4v1M4 19h12a4 4 0 004-4v-1" />
      <text
        x="12"
        y="15"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        1
      </text>
    </>
  ),
  // Loop arrows with an ∞ mark — repeat the current track forever.
  repeatInfinite: (
    <>
      <path d="M17 2l3 3-3 3M7 22l-3-3 3-3M20 5H8a4 4 0 00-4 4v1M4 19h12a4 4 0 004-4v-1" />
      <text
        x="12"
        y="15.5"
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        ∞
      </text>
    </>
  ),
  queue: (
    <path d="M4 6h11M4 12h11M4 18h7M17 14v6M20 15l-3-1 3-1" />
  ),
  // A proper cog: notched outer ring + center hub (the old version read as a
  // sun because it was just a circle with radial spokes).
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  mini: <rect x="4" y="8" width="16" height="8" rx="1.5" />,
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  trash: (
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  more: (
    <path
      d="M5 12h.01M12 12h.01M19 12h.01"
      strokeWidth="3"
      strokeLinecap="round"
    />
  ),
  check: <path d="M5 12l5 5 9-10" />,
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="20" cy="16" r="3" />
    </>
  ),
  library: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
