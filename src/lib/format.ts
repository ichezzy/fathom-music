export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const AMBIENT_ICONS = [
  "🕳️", "🏙️", "🍺", "🌲", "🌧️", "🔥", "🌊", "⛏️", "⚓", "🏰", "🌙", "🐎",
];

export const SFX_ICONS = [
  "⚔️", "🛡️", "🐉", "💥", "🔔", "🎲", "💀", "🏹", "✨", "🚪", "👹", "🪙",
];

export const SFX_COLORS = [
  "#b4452f", "#b8862f", "#3f7d54", "#36657f", "#6c4f8a", "#a3476b",
];
