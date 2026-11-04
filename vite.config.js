import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
      "/office-preview-files": "http://localhost:4000",
    },
  },
});
