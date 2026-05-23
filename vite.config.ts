import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` for builds so the bundle loads from file:// inside Electron.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
}));
