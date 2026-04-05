import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './', // relative paths for NUI
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        minify: true,
    },
});
