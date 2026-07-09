# Fathom Music – Roadmap

> Gepflegtes Roadmap-Board als Datei (Quelle der Wahrheit). Wird **nach jedem
> Update** aktualisiert: neue Version als Patch-Notes unter „Done" eintragen,
> Pläne unter To-Do/Planning nachziehen. Der Gesamtplan steht in `CLAUDE.md`.
>
> Kategorien: **Done (Patch-Notes) · In Arbeit · To-Do · Planning · Bugs/Known Issues**.
> Letzte Aktualisierung: 2026-07-09 · Aktuelle Version: **v0.3.4**

---

## ✅ Done (Patch-Notes, neueste zuerst)

### Unreleased (lokal, noch nicht getaggt) – 2026-07-09
- **Projekt-Setup:** `start-fathom.bat` (Doppelklick-Start im Dev-Modus, getestet),
  `CLAUDE.md` (Projektleitfaden) und `ROADMAP.md` (dieses Board) angelegt.
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
- **UI-Redesign (Spotify-Stil):** Schritte 1–4 released (Farbpalette, frameless
  Titelleiste, Queue, Sidebar-Layout). Als Nächstes: Abgleich mit Anthonys
  **Figma-Testlayout** (Link ausstehend).

---

## 📋 To-Do (als Nächstes geplant)
- **Figma-Testlayout umsetzen:** Anthony hat in Figma ein Testlayout für die
  App erstellt → Link einholen, Layout analysieren, Redesign-Schritte ableiten.
- Unreleased-Änderungen committen/pushen (nach Freigabe).

---

## 🧭 Planning (später / Ideen)
- **Interne Umbenennung** `tavernloops` → `fathom-music` (package.json name,
  `appId`, `productName`): vom Nutzer bewusst verschoben, weil Komplikationen
  mit Auto-Update/Installer-Identität auftreten können – braucht ein
  durchdachtes Migrationskonzept.
- **Räume/Mitspieler:** „invite your players to join your room" (im README
  angekündigt) – Spieler hören live mit; braucht ein Sync-Konzept (kostenlos!).
- **Backup/Export-Import** der Kampagnen-Bibliothek prüfen/ausbauen.
- Weitere Ideen des Nutzers hier sammeln.

---

## 🐞 Bugs / Known Issues
- Aktuell keine offenen Funktions-Bugs bekannt.
- Bekannte Grenze: Nutzerdaten (inkl. Audio-Blobs) liegen in IndexedDB unter
  dem Origin `http://127.0.0.1:47615` – Port/Origin nie ändern (CLAUDE.md §4).
