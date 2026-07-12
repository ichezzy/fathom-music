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

export const CAMPAIGN_COLORS = [
  "#8a3b2a", "#9a6b22", "#356046", "#2d5468", "#5a4178", "#86405c",
];
