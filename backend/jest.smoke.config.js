
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    // Run in parallel for speed
    maxWorkers: '50%',

    // Short timeout - smoke tests should be fast
    testTimeout: 30000, // 30 seconds per test (slightly higher than prompt to be safe on first run)

    // Only run smoke tests
    testMatch: ['**/smoke/**/*.test.ts'],

    // Fail fast - stop on first failure
    bail: 1,

    // No coverage needed for smoke tests
    collectCoverage: false,

    setupFiles: ['dotenv/config'],

    // ESM handling
    transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
    },
};
