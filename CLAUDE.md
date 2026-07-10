# CLAUDE.md – Fathom Music

> Projektleitfaden für Claude. Diese Datei wird zu Beginn jeder Session gelesen.
> Sie ist die verbindliche Quelle für Ziel, Architektur, Konventionen und Arbeitsweise.
> **Diese Datei bleibt weitgehend unverändert** – der aktuelle Stand und die Pläne
> werden stattdessen in `ROADMAP.md` gepflegt (nach jedem Update aktualisieren).

> ⚠️ **Projektort: `E:\Claude\Fathom Music` (lokales Laufwerk).**
> NICHT auf Google Drive entwickeln – Drive-Sync sperrt Dateien und bricht
> npm/Electron-Installationen. Claude in diesem Ordner starten.

---

## 1. Was ist Fathom Music?

Eine **Windows-Desktop-App** für Spielleiter (DMs) von Tabletop-Rollenspielen:
Musik, Ambience und Soundeffekte für Sessions steuern – wie eine Streaming-App,
aber mit eigenen Dateien und YouTube-Quellen, alles mischbar.

Kernfunktionen:
- **Musik-Sektion:** Playlists mit Tracks (lokale Dateien oder YouTube),
  Crossfade zwischen Tracks, Shuffle, Repeat, Warteschlange (Play Queue).
- **Ambient-Sektion:** lang laufende Loop-Betten (Höhle, Regen, Taverne …),
  mehrere gleichzeitig, je eigener Lautstärkeregler, gruppierbar.
- **Soundboard:** kurze One-Shot-Effekte auf Pads (immer lokal, latenzarm),
  Einmal- oder Intervall-Modus (z. B. Wolfsheulen alle 30–60 s), gruppierbar,
  per Hotkey (Pad 1–9) auslösbar.
- **Kampagnen:** benannte Profile (z. B. „Curse of Strahd") mit jeweils eigener
  Bibliothek; Mixer und Einstellungen sind global.
- **Komfort:** Mini-Player (always-on-top), System-Tray, Fenster-Gedächtnis,
  Hotkeys (umbelegbar), Audio-Ausgabegerät wählbar, Mehrsprachigkeit,
  Auto-Update über GitHub Releases.

Repo: https://github.com/ichezzy/fathom-music

**Namens-Historie:** Die App hieß bis v0.2.x **TavernLoops** (UI-Umbenennung
mit v0.3.0, vollständiges Rebranding mit v0.4.0: `name: fathom-music`,
`productName: Fathom Music`). ⚠️ **Zwei Dinge bleiben bewusst beim alten Wert:**
- `appId: com.ichezzy.tavernloops` – identifiziert die Installation in der
  Windows-Registry; derselbe Wert sorgt dafür, dass der Installer die alte
  TavernLoops-Installation ersetzt statt eine zweite App anzulegen. **Nie ändern.**
- IndexedDB-Name `tavernloops` in `src/lib/db.ts` (Legacy-Web-Storage).

Der `productName`-Wechsel verschob den Datenordner
(`%APPDATA%\TavernLoops` → `%APPDATA%\Fathom Music`); `migrateLegacyUserData()`
in `electron/main.cjs` zieht alte Bibliotheken beim ersten Start um –
diese Funktion nicht entfernen.

---

## 2. Rahmenbedingungen (vom Nutzer vorgegeben)

- **Claude entwickelt die App vollständig allein.** Der Nutzer ist Anfänger und folgt mit.
  → Code gut lesbar halten, Entscheidungen kurz begründen, in lauffähigen Etappen liefern.
- **Plattform:** Windows-Desktop (Electron). Releases als NSIS-Installer.
- **Kosten:** Muss **kostenlos** bleiben (privater Gebrauch, GitHub Free reicht).
- **Sprache mit dem Nutzer:** Deutsch.
- **Testen vor Release:** Der Nutzer testet lokal (per `start-fathom.bat`),
  erst danach wird ein GitHub-Release ausgelöst.

---

## 3. Technologie-Stack

| Bereich       | Wahl                          | Begründung |
|---------------|-------------------------------|------------|
| App-Hülle     | **Electron** (v33)            | Web-Technik als Desktop-App, Auto-Update, Tray, frameless Fenster. |
| UI            | **React 18 + TypeScript**     | Komponenten-Struktur für die komplexe Player-UI; Typsicherheit. |
| Build         | **Vite 5**                    | Schneller Dev-Server (Port 5173) + Production-Build nach `dist/`. |
| State         | **Zustand**                   | Ein zentraler Store (`src/store/store.ts`), einfach und ohne Boilerplate. |
| Persistenz    | **IndexedDB** via `idb`       | Kampagnen, Playlists, Einstellungen UND hochgeladene Audio-Dateien (Blobs) – alles lokal im Browser-Storage der App. |
| Audio         | **Web Audio / `<audio>`** + **YouTube IFrame API** | Eigene Engines (siehe Architektur); YouTube als kostenlose Musikquelle. |
| Updates       | `electron-updater`            | Auto-Update aus GitHub Releases (Check beim Start + alle 6 h). |
| Packaging     | `electron-builder` (NSIS)     | Windows-Installer; Publishing via GitHub Actions. |

**Bewusst NICHT:** eigenes Backend/Server (Kosten), Datenbank-Dienste – alles lokal.

---

## 4. Architektur

### Renderer (React, `src/`)
- **Drei Audio-Engines** (`src/audio/`), initialisiert in einem versteckten DOM-Host:
  - `MusicEngine.ts` + `Deck.ts` – Playlist-Wiedergabe mit **zwei Decks** für
    Crossfade; Quellen: lokale Blobs oder YouTube-IFrame.
  - `AmbientEngine.ts` – parallele Loop-Kanäle mit eigener Lautstärke.
  - `SoundboardEngine.ts` – One-Shots und Intervall-Trigger (immer lokal).
  - `ramp.ts` – sanfte Lautstärke-Rampen (kein Knacksen).
- **Store** (`src/store/store.ts`, Zustand): kompletter App-State inkl. Aktionen;
  `hydrate()` lädt aus IndexedDB, danach wird jede Änderung persistiert.
- **Datenmodell** (`src/types.ts`): `Campaign` (= Profil mit eigener Bibliothek:
  Tracks, Playlists, Ambient, Soundboard, Gruppen) + globale `MixerState`/`AppSettings`.
- **DB-Schicht** (`src/lib/db.ts`, `idb`): persistierter State + Audio-Dateien als Blobs.
- **i18n** (`src/lib/i18n.ts`): Sprachen **EN (Standard), DE, FR, ES, IT**.
  Neue UI-Strings IMMER über die i18n-Helfer anlegen, nie hart codieren,
  und in ALLEN fünf Sprachen ergänzen.
- **Hotkeys** (`src/lib/hotkeys.ts`): globale Tasten (Play/Pause, Next, Prev,
  Pads 1–9, Loops stoppen), vom Nutzer umbelegbar (`AppSettings.hotkeys`).

### Main-Prozess (Electron, `electron/`)
- `main.cjs` – Fenster, Tray, Mini-Player-Umschaltung, Auto-Update, IPC.
- `preload.cjs` – schmale, sichere Brücke (`contextIsolation: true`,
  `nodeIntegration: false`); Renderer spricht nur über `window.…`-API mit Node.
- `staticServer.cjs` – ⚠️ **Kernstück:** Die gepackte App wird über einen lokalen
  HTTP-Server auf **festem Port 47615** ausgeliefert. Grund: IndexedDB ist an den
  Origin (inkl. Port) gebunden – ein wechselnder Port würde **alle Nutzerdaten
  löschen**; außerdem braucht der YouTube-Player einen echten HTTP-Origin.
  **Diesen Port niemals ändern.**
- `storage.cjs`, `windowState.cjs` – IPC-Storage-Helfer, Fenster-Gedächtnis.
- Single-Instance-Lock (ein Besitzer von Port + Daten); zweiter Start fokussiert
  nur das bestehende Fenster.
- Windows: frameless Fenster, eigene Titelleiste im Renderer (`TitleBar.tsx`,
  Höhe 34 px – muss mit `.titlebar` im CSS übereinstimmen).

### Projektstruktur
```
fathom-music/
├─ CLAUDE.md             # dieser Leitfaden (stabil)
├─ ROADMAP.md            # Patch-Notes + Pläne (nach jedem Update pflegen!)
├─ start-fathom.bat      # Doppelklick-Starter für lokalen Test (Dev-Modus)
├─ package.json          # Scripts + electron-builder-Konfiguration
├─ index.html / vite.config.ts / tsconfig*.json
├─ .github/workflows/release.yml  # Tag vX.Y.Z → Installer-Build + Release
├─ build/                # Icons (icon.ico/png) für Installer & Tray
├─ scripts/make_icon.py  # Icon-Generierung
├─ electron/             # Main-Prozess (CommonJS, .cjs)
└─ src/
   ├─ audio/             # Music/Ambient/Soundboard-Engines + Deck
   ├─ components/        # React-Komponenten (Sections, Player, Dialoge …)
   ├─ lib/               # db, i18n, hotkeys, desktop-Brücke, Helfer
   ├─ store/store.ts     # Zustand-Store (zentraler App-State)
   └─ types.ts           # Datenmodell
```

---

## 5. Konventionen & Arbeitsweise

- **Code-Sprache:** Bezeichner und Code-Kommentare auf Englisch; Kommunikation
  mit dem Nutzer auf Deutsch. UI-Texte nur über i18n (alle 5 Sprachen pflegen).
- **Lauffähige Etappen:** Jede Änderung endet in einem testbaren Stand.
  Der Nutzer testet mit `start-fathom.bat`, bevor released wird.
- **Nach jeder Etappe:** `ROADMAP.md` aktualisieren (Patch-Notes-Stil: was ist
  neu/geändert/gefixt, was ist als Nächstes geplant).
- **Commits:** klein und thematisch, Imperativ. Nur committen/pushen/taggen,
  wenn der Nutzer es möchte (oder am Etappenende anbieten).
- **Abhängigkeiten:** sparsam; jede neue Lib kurz begründen.
- **Sicherheit:** `contextIsolation` bleibt an; keine Secrets im Repo.
- **Datensicherheit:** Alles Nutzerdaten liegen in IndexedDB unter dem Origin
  `http://127.0.0.1:47615` – Port und Origin-Logik nicht anfassen (siehe §4).
- **Typecheck vor Release:** `npm run typecheck` muss sauber durchlaufen.

---

## 6. Befehle & Release-Prozess

```bash
npm install            # Abhängigkeiten installieren
npm run electron:dev   # Dev-Modus: Vite + Electron mit Hot-Reload (= start-fathom.bat)
npm run typecheck      # TypeScript prüfen (ohne Build)
npm run build          # Production-Build nach dist/
npm run dist           # Installer LOKAL bauen (release/, ohne Publish) – für Installationstests
npm run release        # Build + Installer + auf GitHub veröffentlichen (macht die CI)
```

**Release-Ablauf** (erst nach erfolgreichem lokalen Test):
1. Version in `package.json` erhöhen (SemVer).
2. `ROADMAP.md` aktualisieren (Patch-Notes für die neue Version).
3. Committen, dann Tag pushen: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
4. GitHub Actions (`release.yml`) baut den NSIS-Installer auf einem
   Windows-Runner und veröffentlicht ihn samt `latest.yml` (Auto-Update-Feed)
   als GitHub Release. Installierte Apps updaten sich danach automatisch.

Windows-Komfort: Doppelklick auf `start-fathom.bat` startet den Dev-Modus.

---

## 7. Aktueller Status

→ Steht bewusst NICHT hier. Stand, Patch-Notes und Pläne: siehe **`ROADMAP.md`**.
