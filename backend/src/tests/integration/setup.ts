import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Ensure we are testing against non-production if possible (safeguard)
if (process.env.NODE_ENV === 'production' && !process.env.FORCE_TEST_PROD) {
    console.warn('WARNING: Running integration tests in PRODUCTION mode. Ensure TEST_DATABASE_URL is distinct if using it.');
}

// Global integration test timeout (can be overridden per test)
jest.setTimeout(60000);

beforeAll(async () => {
    // Global setup if needed
    console.log('Starting Integration Tests...');
});

afterAll(async () => {
    // Global teardown
    console.log('Integration Tests Completed.');
    // Force exit to ensure no hanging handles
});
