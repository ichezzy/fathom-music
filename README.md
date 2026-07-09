# Fathom Music

**Music, ambience and sound-effects controller for tabletop RPG game masters.**

Music and sounds are very underrated at the gaming table. Think of any movie or
series: would you be as emotionally invested without the score? Would a fantasy
setting feel alive without ambience? Fathom Music lets you run all of it live —
like a familiar streaming app, but built for game masters.

> Fathom Music was formerly known as **TavernLoops**. Existing installations
> keep updating automatically.

## Features

- 🎵 **Music** — playlists with your own audio files or YouTube links,
  crossfade, shuffle, repeat and a play queue.
- 🌧️ **Ambience** — long looping background beds (rain, tavern crowd, cave …),
  several at once, each with its own volume, organizable in groups.
- 💥 **Soundboard** — one-shot effects on colored pads, triggered by click or
  hotkey, once or on a random interval (a wolf howl every 30–60 s).
- 🗂️ **Campaigns** — separate libraries per campaign, one click to switch.
- 🎚️ **Mixer** — master, music, ambience and soundboard volumes.
- 🖥️ **Desktop comfort** — mini player (always on top), system tray, global
  hotkeys, selectable audio output device, five languages (EN/DE/FR/ES/IT).
- 🔄 **Auto-updates** — install once, stay current automatically.

## Installation

Download the latest installer from the
[Releases page](https://github.com/ichezzy/fathom-music/releases/latest) and
run it (Windows). Future updates install automatically.

## Suggest features / report bugs

Missing something, or found a bug? Please open an
[issue](https://github.com/ichezzy/fathom-music/issues) — I'm happy to include
suggestions in future updates.

## Development

```bash
npm install            # install dependencies
npm run electron:dev   # dev mode: Vite + Electron with hot reload
npm run dist           # build the Windows installer locally (no publish)
```

On Windows you can also just double-click `start-fathom.bat`.

Built with Electron, React, TypeScript and Vite — created by
[ichezzy](https://github.com/ichezzy) together with Claude.

## License

[MIT](LICENSE)
