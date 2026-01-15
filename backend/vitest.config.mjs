/**
 * Vitest configuration for backend tests
 * Configures Node.js environment, module resolution, and coverage
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use Node environment for backend tests
    environment: 'node',
    
    // Include/exclude patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['node_modules', 'dist', 'build'],
    
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
      include: ['src/**/*.{js,ts}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/index.ts',
        'src/main.ts',
      ],
    },
    
    // Globals for convenience
    globals: true,
    
    // Watch mode
    watch: true,
    
    // Reporter
    reporter: 'verbose',
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
