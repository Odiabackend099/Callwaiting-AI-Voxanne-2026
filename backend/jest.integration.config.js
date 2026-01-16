/** @type {import("jest").Config} **/
const baseConfig = require('./jest.config');

module.exports = {
    ...baseConfig,
    testMatch: [
        '**/__tests__/integration/**/*.test.ts'
    ],
    testTimeout: 60000,
    maxWorkers: 1, // Run sequentially to avoid DB locking issues
    setupFilesAfterEnv: ['<rootDir>/src/tests/integration/setup.ts'],
    displayName: 'integration',
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)'
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/src/tests/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};
