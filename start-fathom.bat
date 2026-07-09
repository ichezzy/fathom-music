@echo off
REM Doppelklick startet Fathom Music im Dev-Modus (Vite + Electron, mit Hot-Reload).
REM Das Fenster bleibt offen, solange die App laeuft.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run electron:dev
