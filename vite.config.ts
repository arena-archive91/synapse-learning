import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('pyodide')) return 'pyodide';
          if (id.includes('mermaid')) return 'mermaid';
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('katex')) return 'katex';
          if (id.includes('codemirror') || id.includes('@codemirror')) return 'codemirror';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
});
