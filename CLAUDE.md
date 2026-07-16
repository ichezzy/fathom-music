# CLAUDE.md – Fathom Music

> Kurzleitfaden + Code-Index. Lies gezielt nur die Dateien, die du laut Index
> brauchst — kein freies Durchsuchen des Repos. Andere .md-Dateien nur bei
> Bedarf öffnen: `ROADMAP.md` hält Stand, Patch-Notes und Pläne (nach jeder
> Etappe aktualisieren, sonst nicht lesen).

## Arbeitsweise

- **95%-Regel: Keine Änderungen, bevor du nicht ≥95 % sicher bist, was gebaut
  werden soll. Stelle so lange Rückfragen, bis du diese Sicherheit hast.**
- Deutsch mit dem Nutzer (Anfänger — Entscheidungen kurz begründen); Code und
  Kommentare Englisch.
- UI-Texte NUR über i18n (`src/lib/i18n.ts`), immer in allen 5 Sprachen
  (EN/DE/FR/ES/IT). Nie hart codieren.
- Lauffähige Etappen; der Nutzer testet mit `start-fathom.bat`, erst dann Release.
- `npm run typecheck` muss vor jedem Etappenende sauber durchlaufen.
- Commits klein und thematisch, Imperativ; nur committen/pushen/taggen, wenn
  der Nutzer es möchte (oder am Etappenende anbieten).
- Abhängigkeiten sparsam, jede neue Lib kurz begründen. Kein Backend/Server —
  alles lokal und kostenlos (GitHub Free).
- Projektort ist `E:\Claude\Fathom Music` (lokal, NICHT Google Drive — Sync
  bricht npm/Electron).

## Was ist die App?

Windows-Desktop-App (Electron) für Spielleiter von Tabletop-Rollenspielen:
Musik (Playlists, Crossfade, Queue), Ambient-Loops und Soundboard-Effekte
mischen — lokale Dateien + YouTube. Kampagnen = Profile mit eigener Bibliothek;
Mixer/Settings global. Repo: https://github.com/ichezzy/fathom-music

## Tech-Stack

Electron 33 · React 18 + TypeScript · Vite 5 (Dev-Port 5173) · Zustand ·
IndexedDB via `idb` (State UND Audio-Blobs) · electron-builder (NSIS) ·
electron-updater (Auto-Update aus GitHub Releases).

## Befehle

```bash
npm run electron:dev   # Dev-Modus (= start-fathom.bat)
npm run typecheck      # TypeScript prüfen
npm run dist           # Installer lokal bauen (release/, ohne Publish)
```

Release: Version in `package.json` erhöhen → `ROADMAP.md`-Patch-Notes →
commit → `git tag vX.Y.Z && git push origin main vX.Y.Z` → CI
(`.github/workflows/release.yml`) baut und veröffentlicht den Installer.

## ⚠️ Invarianten (nie ändern)

- **Port 47615** (`electron/staticServer.cjs`): Die gepackte App läuft über
  einen lokalen HTTP-Server auf festem Port — IndexedDB hängt am Origin
  `http://127.0.0.1:47615`. Portwechsel = alle Nutzerdaten weg.
- **`appId: com.ichezzy.tavernloops`** (`package.json`): Registry-Identität —
  sorgt dafür, dass Updates die alte Installation ersetzen. (Die App hieß bis
  v0.3 TavernLoops.)
- **IndexedDB-Name `tavernloops`** (`src/lib/db.ts`).
- **`migrateLegacyUserData()`** (`electron/main.cjs`): zieht alte
  `%APPDATA%\TavernLoops`-Daten um — nicht entfernen.
- **`contextIsolation: true`** bleibt an; keine Secrets im Repo.

## Code-Index — wo finde ich was?

| Bereich | Datei | Was liegt dort |
|---|---|---|
| Datenmodell | `src/types.ts` | `Campaign`, `Track`, `Playlist`, `MixerState`, `AppSettings` |
| State | `src/store/store.ts` | Zustand-Store: gesamter App-State + Aktionen; `hydrate()` lädt aus DB, danach wird jede Änderung persistiert |
| DB-Schicht | `src/lib/db.ts` | IndexedDB (State + Audio-Blobs) |
| i18n | `src/lib/i18n.ts` | 5 Wörterbücher + `useT()` |
| Hotkeys | `src/lib/hotkeys.ts` | Aktionen, Default-Bindings, Umbelegung |
| Musik-Engine | `src/audio/MusicEngine.ts`, `Deck.ts` | 2 Decks für Crossfade; lokale Blobs + YouTube-IFrame |
| Ambient-Engine | `src/audio/AmbientEngine.ts` | parallele Loop-Kanäle |
| Soundboard | `src/audio/SoundboardEngine.ts` | One-Shots + Intervall-Trigger |
| App-Shell | `src/App.tsx` | View-Routing (`menu`/`campaign`/`void`), Engine-Init, Hotkey-Wiring |
| Hauptmenü | `src/components/MainMenu.tsx` | Kampagnen-Grid, Neu/Einstellungen-Modals; d20-Anker `menu-logo` |
| Sidebar | `src/components/Sidebar.tsx` | Mixer, Nav, Zurück-Button (startet Dive Out) |
| Transport | `src/components/NowPlayingBar.tsx` | Play-Orb (d20, Anker `play-button`), Seek, Queue |
| Dive-Transition | `src/components/DiveTransition.tsx` | Canvas-Ozean + d20-Flug zwischen Menü/Player (5 s / 4,5 s), Sound, Anker-Messung |
| Einstellungen | `src/components/SettingsModal.tsx` | Tabs: general/audio/hotkeys/backup/about |
| Mini-Player | `src/components/MiniPlayer.tsx` | Always-on-top-Kompaktansicht |
| Styles | `src/index.css` | globale Styles, Keyframes, Titlebar-Höhe 34px (muss zu `TitleBar.tsx` passen) |
| Main-Prozess | `electron/main.cjs` | Fenster, Tray, Mini-Player, Auto-Update, Migration, Single-Instance |
| Static Server | `electron/staticServer.cjs` | fester Port 47615 (s. Invarianten) |
| IPC-Brücke | `electron/preload.cjs` | schmale `window.…`-API |
| Assets | `src/assets/` | `d20.png` (Mark), `logo.png` (Karten-Backdrop), `dive_in/out.mp3` |
| App-Icon | `build/icon-1024.png` → `icon.ico`/`icon.png` | 256er PNG-in-ICO; aus der 1024er Quelle generieren |

## Design-Sprache (Kurzfassung)

Tiefsee-Thema: BG `#030d18`, Akzent-Cyan `#00c4d4` (Alphas als
`rgba(0,196,212,…)`), Hairlines `rgba(0,196,212,0.12)`. Fonts über CSS-Vars
(`--font-display/-data/-body`). Der d20 ist das Markenzeichen (Menü-Header,
Sidebar, Play-Button, Transition).
