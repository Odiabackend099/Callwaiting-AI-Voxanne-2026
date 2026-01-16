module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    // Run sequentially to avoid database conflicts and race conditions
    maxWorkers: 1,

    // Extended timeout for comprehensive regression tests (60s)
    testTimeout: 60000,

    // Only run regression tests
    testMatch: ['**/tests/regression/**/*.test.ts'],

    // Don't bail - run all tests to see full regression impact
    bail: false,

    // Setup files (dotenv)
    setupFiles: ['dotenv/config'],

    // Collect coverage for regression suite
    collectCoverage: true,
    coverageDirectory: 'coverage/regression',
    coverageReporters: ['text', 'lcov', 'html'],

    // ESM handling for UUID
    transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
    },

    // Verbose output
    verbose: true,
};
