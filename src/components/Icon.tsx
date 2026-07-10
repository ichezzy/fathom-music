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
  | "check";

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
  queue: (
    <path d="M4 6h11M4 12h11M4 18h7M17 14v6M20 15l-3-1 3-1" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" />
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
