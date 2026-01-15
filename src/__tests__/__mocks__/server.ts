/**
 * MSW Server setup for Node environment
 * Used in test setup files to intercept HTTP requests
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create a server that listens to requests during test execution
export const mswServer = setupServer(...handlers);
