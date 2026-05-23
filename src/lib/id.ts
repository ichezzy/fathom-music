export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand}` : rand;
}

/**
 * Extract the 11-character video id from the common YouTube URL shapes,
 * or accept a bare id.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      // /embed/<id> or /shorts/<id>
      const m = url.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}
