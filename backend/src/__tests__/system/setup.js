/**
 * System Test Setup
 *
 * Runs before each system test file (via Jest setupFiles).
 * Sets NODE_ENV=development so the server bypasses CSRF validation,
 * matching the server.ts comment: "Disable CSRF validation in development
 * for easier testing".
 *
 * This is intentional: system tests send real supertest HTTP requests
 * against the app. They don't go through a browser, so there's no
 * mechanism to obtain and include a real CSRF token.
 */
process.env.NODE_ENV = 'development';
