/** @type {import("jest").Config} **/
const baseConfig = require('./jest.integration.config');

module.exports = {
  ...baseConfig,
  testMatch: [
    '**/__tests__/system/**/*.test.ts'
  ],
  testTimeout: 120000, // 2 minutes — these are full user journeys
  displayName: 'system',
};
