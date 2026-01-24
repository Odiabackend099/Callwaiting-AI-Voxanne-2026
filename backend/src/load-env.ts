// Load environment variables BEFORE anything else
// Works with both CommonJS (tsx) and ESM
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from backend directory
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
