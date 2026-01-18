#!/usr/bin/env ts-node

/**
 * ================================================================================
 * ATOMIC .ENV UPDATER
 * ================================================================================
 *
 * Utility for atomically updating environment variables in .env file.
 *
 * Features:
 * - Read existing .env file
 * - Update or append environment variables
 * - Atomic write using temp file + rename
 * - Preserves file formatting and comments
 * - Verification after update
 *
 * Usage (as library):
 *   import { updateEnvVariable } from './env-updater';
 *   await updateEnvVariable('BACKEND_URL', 'https://xyz.ngrok-free.dev', '../.env');
 *
 * Usage (as script):
 *   ts-node utils/env-updater.ts BACKEND_URL https://xyz.ngrok-free.dev
 */

import * as fs from 'fs';
import * as path from 'path';

interface EnvUpdaterOptions {
  backupFile?: boolean;
  verify?: boolean;
}

// Simple logging utility
function log(level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: '📋',
    SUCCESS: '✅',
    ERROR: '❌',
    WARN: '⚠️'
  }[level];

  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Update a single environment variable in .env file
 *
 * @param key - The environment variable key (e.g., 'BACKEND_URL')
 * @param value - The new value
 * @param envPath - Path to .env file (defaults to '../.env' relative to this script)
 * @param options - Configuration options
 * @throws Error if file operation fails
 */
export async function updateEnvVariable(
  key: string,
  value: string,
  envPath: string = '../.env',
  options: EnvUpdaterOptions = {}
): Promise<void> {
  const defaults = {
    backupFile: true,
    verify: true,
    ...options
  };

  try {
    // Resolve full path
    const fullPath = path.resolve(__dirname, envPath);
    log('INFO', `Updating .env at: ${fullPath}`);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      throw new Error(`.env file not found at: ${fullPath}`);
    }

    // Read existing content
    log('INFO', 'Reading existing .env file');
    const originalContent = await fs.promises.readFile(fullPath, 'utf8');

    // Create backup if requested
    if (defaults.backupFile) {
      const backupPath = `${fullPath}.backup`;
      await fs.promises.writeFile(backupPath, originalContent, 'utf8');
      log('INFO', `Backup created: ${backupPath}`);
    }

    // Regex to match: KEY=VALUE (with any quotes or formatting)
    // Matches lines like: BACKEND_URL=value or BACKEND_URL='value' or BACKEND_URL="value"
    const regex = new RegExp(`^${key}=.*$`, 'm');

    let newContent: string;

    if (regex.test(originalContent)) {
      // Update existing variable
      log('INFO', `Replacing existing ${key} value`);
      newContent = originalContent.replace(regex, `${key}=${value}`);
    } else {
      // Append new variable
      log('INFO', `Appending new ${key} variable`);
      newContent = originalContent.endsWith('\n')
        ? `${originalContent}${key}=${value}\n`
        : `${originalContent}\n${key}=${value}\n`;
    }

    // Atomic write using temp file + rename pattern
    const tempPath = `${fullPath}.tmp`;

    log('INFO', 'Writing to temporary file');
    await fs.promises.writeFile(tempPath, newContent, 'utf8');

    log('INFO', 'Replacing original file (atomic operation)');
    await fs.promises.rename(tempPath, fullPath);

    // Verify update if requested
    if (defaults.verify) {
      const updatedContent = await fs.promises.readFile(fullPath, 'utf8');

      if (!updatedContent.includes(`${key}=${value}`)) {
        throw new Error(`Verification failed: ${key}=${value} not found in updated .env`);
      }

      log('SUCCESS', `Verified: ${key} updated successfully`);
    }

    log('SUCCESS', `.env file updated: ${key}=${value}`);

  } catch (error) {
    log('ERROR', `Failed to update .env variable`, error);
    throw error;
  }
}

/**
 * Update multiple environment variables in one operation
 *
 * @param updates - Object with key-value pairs to update
 * @param envPath - Path to .env file
 * @param options - Configuration options
 */
export async function updateEnvVariables(
  updates: Record<string, string>,
  envPath: string = '../.env',
  options: EnvUpdaterOptions = {}
): Promise<void> {
  try {
    const fullPath = path.resolve(__dirname, envPath);

    log('INFO', `Updating ${Object.keys(updates).length} variables`);

    // Read original once
    const originalContent = await fs.promises.readFile(fullPath, 'utf8');

    // Apply all updates
    let newContent = originalContent;

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');

      if (regex.test(newContent)) {
        newContent = newContent.replace(regex, `${key}=${value}`);
      } else {
        newContent += `\n${key}=${value}`;
      }

      log('INFO', `Updated ${key}`);
    }

    // Ensure trailing newline
    if (!newContent.endsWith('\n')) {
      newContent += '\n';
    }

    // Atomic write
    const tempPath = `${fullPath}.tmp`;
    await fs.promises.writeFile(tempPath, newContent, 'utf8');
    await fs.promises.rename(tempPath, fullPath);

    log('SUCCESS', `All ${Object.keys(updates).length} variables updated`);

  } catch (error) {
    log('ERROR', 'Failed to update .env variables', error);
    throw error;
  }
}

/**
 * Get current value of an environment variable from .env file
 *
 * @param key - The environment variable key
 * @param envPath - Path to .env file
 * @returns The value or undefined if not found
 */
export async function getEnvVariable(
  key: string,
  envPath: string = '../.env'
): Promise<string | undefined> {
  try {
    const fullPath = path.resolve(__dirname, envPath);
    const content = await fs.promises.readFile(fullPath, 'utf8');

    const regex = new RegExp(`^${key}=(.*)$`, 'm');
    const match = content.match(regex);

    if (match && match[1]) {
      // Remove quotes if present
      let value = match[1].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }

    return undefined;
  } catch (error) {
    log('ERROR', `Failed to read ${key}`, error);
    return undefined;
  }
}

// ================================================================================
// CLI USAGE
// ================================================================================

// Allow script to be run directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: ts-node env-updater.ts <KEY> <VALUE> [envPath]');
    console.log('Example: ts-node env-updater.ts BACKEND_URL https://xyz.ngrok-free.dev ../../../backend/.env');
    process.exit(1);
  }

  const key = args[0];
  const value = args[1];
  const envPath = args[2] || '../.env';

  updateEnvVariable(key, value, envPath)
    .then(() => {
      log('SUCCESS', 'Done!');
      process.exit(0);
    })
    .catch((error) => {
      log('ERROR', 'Update failed', error);
      process.exit(1);
    });
}

export default { updateEnvVariable, updateEnvVariables, getEnvVariable };
