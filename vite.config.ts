import { defineConfig } from 'vite';

// JSX settings come from tsconfig.json, so no React plugin is needed.
export default defineConfig({
  root: 'web',
  build: { outDir: '../dist', emptyOutDir: true },
});
