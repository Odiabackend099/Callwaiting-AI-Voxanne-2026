/**
 * Vitest configuration for frontend tests
 * Configures test environment, modules, and coverage settings
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
  },
  test: {
    // Use happy-dom instead of jsdom to avoid ESM/CJS issues
    environment: 'happy-dom',
    
    // Global setup file with MSW server
    setupFiles: ['./src/__tests__/__mocks__/setup.ts'],
    
    // Include/exclude patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.next'],
    
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    
    // Globals for convenience (no imports needed for describe, it, etc.)
    globals: true,
    
    // Reporter
    reporter: 'verbose',
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
