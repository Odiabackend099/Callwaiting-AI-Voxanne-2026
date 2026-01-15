/**
 * Vitest global setup for frontend tests
 * Initializes MSW server and global test utilities
 */

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { mswServer } from './server';

// Start MSW server before all tests
beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'warn' });
});

// Reset request handlers after each test
afterEach(() => {
  mswServer.resetHandlers();
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  mswServer.close();
});

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage for tests
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});
