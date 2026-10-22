import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/osunnote/" : "/",
  plugins: [react()],
  server: { port: 4173 },
}));
