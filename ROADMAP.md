# Fathom Music – Roadmap

> Gepflegtes Roadmap-Board als Datei (Quelle der Wahrheit). Wird **nach jedem
> Update** aktualisiert: neue Version als Patch-Notes unter „Done" eintragen,
> Pläne unter To-Do/Planning nachziehen. Der Gesamtplan steht in `CLAUDE.md`.
>
> Kategorien: **Done (Patch-Notes) · In Arbeit · To-Do · Planning · Bugs/Known Issues**.
> Letzte Aktualisierung: 2026-07-10 · Aktuelle Version: **v0.4.0**

---

## ✅ Done (Patch-Notes, neueste zuerst)

### v0.4.0 – 2026-07-10
- **Vollständiges Rebranding zu Fathom Music:** `package.json`-Name und
  `productName` umgestellt (Installer, Startmenü, Taskleiste und Datenordner
  heißen jetzt „Fathom Music"). Die `appId` bleibt bewusst
  `com.ichezzy.tavernloops`, damit der Installer die bestehende
  TavernLoops-Installation ersetzt und die Update-Kette intakt bleibt.
  **Datenmigration:** `migrateLegacyUserData()` zieht die Bibliothek beim
  ersten Start automatisch von `%APPDATA%\TavernLoops` nach
  `%APPDATA%\Fathom Music` um.
- **Neues App-Logo** (W20 über Wasserringen, provisorisch): als Fenster-/
  Taskbar-Icon (`build/icon.ico`/`icon.png`, aus `Logo_Entwurf.png`
  freigestellt), Tray-Icon, und in der UI (Titelleiste, Sidebar, Hauptmenü)
  statt des 🌊-Emojis (`src/assets/logo.png`).
- **Redesign Schritt 7 – restliche Prototyp-Features:**
  - **Track-Kontextmenü** („…"-Button oder Rechtsklick auf einen Track):
    „Add to playlist…" (Checkbox-Mehrfachauswahl über alle Playlists) und
    „Add to queue" mit animiertem **Toast** „Zur Warteschlange hinzugefügt".
  - **Kampagnen-Hintergrundbild:** Upload in den Kampagnen-Einstellungen
    (als Blob im Dateispeicher, wird bei Ersetzen/Löschen aufgeräumt);
    Karte zeigt das Bild mit Farbverlauf-Abdunklung — ohne Bild den
    **Fathom-W20** auf Tiefen-Gradient (statt Emoji-Icon).
- **Fixes:** Sidebar-Mixer-Slider liefen ins Musik-Panel hinein
  (intrinsische Mindestbreite von Range-Inputs → `min-width: 0`);
  Ambient/Soundboard-Restore-Buttons liegen jetzt **in der Player-Leiste**
  (statt darüber zu schweben — bewusste Abweichung vom Figma-Prototyp).
- **Redesign Schritt 6 – 1:1-Layout nach Figma-Prototyp:**
  randloses Spalten-Layout (Musik links ~55 %, rechts Ambient
  über Soundboard, getrennt durch Hairlines statt schwebender Karten; jede
  Spalte scrollt für sich); Playlist-Leiste als flache Liste mit Cyan-Kante;
  Loop/Transition/Shuffle als Leiste über der Track-Liste; Track-Zeilen mit
  Nummern-Spalte und **Wave-Equalizer-Animation** am laufenden Track;
  Ambient als **kompakte Zeilenliste** (Puls-Punkt, Regler nur bei aktivem
  Sound); Soundboard-Pads kompakter; **Player-Leiste** neu: Trackinfo links,
  Controls + Fortschritt mittig gestapelt, Warteschlange rechts.
- **Neu: Ambient/Soundboard minimieren** — Chevron im Panel-Header blendet
  das Panel aus, das andere streckt sich; schwebende Restore-Buttons unten
  rechts; beide minimiert = Musik über die volle Breite.
- **Neu: Kampagnen-Einstellungen** (Zahnrad auf der Karte bei Hover):
  Name, **Beschreibung**, **Tags** (Chips), Icon und Farbe bearbeiten;
  Karte zeigt Beschreibung + Tag-Chips. Datenmodell um
  `Campaign.description`/`Campaign.tags` erweitert (abwärtskompatibel),
  neue Store-Action `updateCampaignMeta`, neue i18n-Schlüssel (5 Sprachen).
- **Redesign Schritt 5 – Abyss-Theme aus dem Figma-Prototyp:**
  Farbpalette auf Tiefsee-Schwarzblau (`#030d18`) mit einem
  einzigen Biolumineszenz-Cyan-Akzent (`#00c4d4`) umgestellt; neue Schriften
  **Cinzel** (Überschriften/Marke), **DM Sans** (Text), **DM Mono**
  (Labels/Zeiten) – als npm-Pakete gebündelt (offline-fähig, kein Google-CDN);
  Slider im Prototyp-Stil (3-px-Spur, glühender Daumen); Panel-Header als
  Cinzel-Versalien mit Hairline; Buttons (Cyan-Glow + Ghost), Pads, Ambient-
  Kacheln, Player-Bar, Queue, Modals und Einstellungen restylt; **Hauptmenü
  als Kampagnen-Karten-Grid** (Farbverlauf + Icon, Hover-Glow, Löschen bei
  Hover) statt vertikaler Liste; neuer i18n-Schlüssel `menu.subtitleHint`
  (alle 5 Sprachen). Quelle: `Music Player UI Design` (Figma Make, Code-Export).
- **Projekt-Setup (2026-07-09):** `start-fathom.bat` (Doppelklick-Start im
  Dev-Modus, getestet), `CLAUDE.md` (Projektleitfaden) und `ROADMAP.md`
  (dieses Board) angelegt.
- Lokaler Ordner mit dem GitHub-Repo verbunden (`git init` + `origin/main`).
- **README.md modernisiert:** Name Fathom Music, Feature-Liste, Download-Link,
  Feature-Wünsche → GitHub Issues, Dev-Anleitung.

### v0.3.4 – 2026-07-08
- Redesign Schritt 4: **Spotify-artiges Sidebar-Layout**.

### v0.3.3 – 2026-07-08
- **SVG-Icons** für die Steuerelemente, schlanke Scrollbalken.

### v0.3.2 – 2026-07-08
- **Frameless Titelleiste** (eigene Fensterknöpfe auf Windows), Farb-Aufräumen,
  **Play Queue** (Warteschlange im Spotify-Stil).

### v0.3.0 – 2026-07-08
- **Umbenennung TavernLoops → Fathom Music**, neue Ozean-Farbpalette,
  einheitliche Edit-Buttons. (Interne IDs/`appId` bleiben bewusst `tavernloops`,
  siehe CLAUDE.md §1.)

### v0.2.7 – 2026-07-08
- **Neuordnen (Reorder)** und **Gruppen** für Ambient & Soundboard.

### v0.2.6 – 2026-07-07
- Fix: ungültige Namens-Eingaben; Umbenennen in der Titelleiste.

### v0.2.5 – 2026-06-23
- Fix: Tray-Icon fehlte im Bundle; Mini-Player vergrößert; **Loop-Button**.

### v0.2.4 – 2026-06-23
- **Fenster-Gedächtnis** (Größe/Position), **Löschbestätigung**,
  **Mini-Player** (always-on-top), **System-Tray** (Schließen = Minimieren).

### v0.2.3 – 2026-06-23
- Einstellungen mit **Tabs**, Mehrsprachigkeit erweitert (**EN/DE/FR/ES/IT**),
  **Hotkeys umbelegbar**.

### v0.2.2 – 2026-06-22
- **Globale Hotkeys**, **Drag & Drop**, manueller **Update-Check**,
  **Audio-Ausgabegerät** wählbar.

### v0.2.0 / v0.2.1 – 2026-06-21
- **Kampagnen-Hauptmenü** (Profile mit eigener Bibliothek); vertikales Menü,
  Einstellung „letzte Kampagne direkt öffnen", Aktiv-Markierung.

### v0.1.x – 2026-06-20/21
- **v0.1.0:** Verpackung als **Electron-Desktop-App** mit auto-updatendem
  Windows-Installer (NSIS, GitHub Releases).
- **v0.1.1:** lokaler HTTP-Server (YouTube-Kompatibilität), Versionsanzeige.
- **v0.1.2:** YouTube-Wiedergabe in der App gefixt; Inline-Umbenennen für
  Tracks, Ambient und Effekte.
- **v0.1.3:** ⚠️ Datenverlust-Bug behoben – App lädt auf **festem Port 47615**
  (IndexedDB-Origin bleibt stabil); Single-Instance-Lock.
- **v0.1.4:** Settings-Tab (Sprache + Backup), Soundboard-**Intervall-Modus**.
- **v0.1.6:** diverse Verbesserungen.

---

## 🚧 In Arbeit
- Nichts – v0.4.0 (Redesign Schritte 5–7 + Rebranding) ist released.

---

## 📋 To-Do (als Nächstes geplant)
- **Nach dem v0.4.0-Update prüfen:** Auto-Update von TavernLoops 0.3.4 →
  Fathom Music 0.4.0 (alte Installation sollte ersetzt werden, Bibliothek
  automatisch migriert). Falls Windows noch einen „TavernLoops"-Eintrag
  unter „Apps" zeigt, diesen einmalig manuell deinstallieren.
- Finales Logo (das aktuelle ist laut Anthony provisorisch).

---

## 🧭 Planning (später / Ideen)
- **Räume/Mitspieler:** „invite your players to join your room" (im README
  angekündigt) – Spieler hören live mit; braucht ein Sync-Konzept (kostenlos!).
- **Backup/Export-Import** der Kampagnen-Bibliothek prüfen/ausbauen.
- Weitere Ideen des Nutzers hier sammeln.

---

## 🐞 Bugs / Known Issues
- Aktuell keine offenen Funktions-Bugs bekannt.
- Bekannte Grenze: Nutzerdaten (inkl. Audio-Blobs) liegen in IndexedDB unter
  dem Origin `http://127.0.0.1:47615` – Port/Origin nie ändern (CLAUDE.md §4).
