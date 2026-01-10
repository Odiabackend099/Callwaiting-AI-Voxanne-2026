// Load environment variables BEFORE anything else
// Works with both CommonJS (tsx) and ESM
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for both CommonJS and ESM
let __dirname: string;
try {
  // ESM mode
  const __filename = fileURLToPath(import.meta.url);
  __dirname = dirname(__filename);
} catch {
  // CommonJS mode (fallback)
  __dirname = __dirname || require('path').dirname(__filename || '.');
}

// Load .env from backend directory
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
