#!/usr/bin/env node

/**
 * Security Audit Script: Detect Exposed Secrets
 * 
 * This script scans the entire codebase for NEXT_PUBLIC_ prefixed secrets
 * that should NEVER be exposed to the browser.
 * 
 * Run: node audit-security.js
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// High-risk patterns that should NEVER have NEXT_PUBLIC_ prefix
const SENSITIVE_PATTERNS = [
  'VAPI_API_KEY',
  'VAPI_PRIVATE_KEY',
  'VAPI_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'PINECONE_API_KEY',
  'DATABASE_URL',
  'ENCRYPTION_KEY'
];

// Directories to ignore
const IGNORE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.vercel',
  'coverage',
  '.turbo'
];

// File extensions to scan
const SCANNABLE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development'
];

let leakCount = 0;
let filesScanned = 0;
const leaksFound = [];

function isIgnoredDir(dirName) {
  return IGNORE_DIRS.includes(dirName);
}

function shouldScanFile(filePath) {
  return SCANNABLE_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function scanFile(filePath) {
  filesScanned++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasLeak = false;
    const leaksInFile = [];

    SENSITIVE_PATTERNS.forEach(pattern => {
      // Check for NEXT_PUBLIC_ prefix (the main leak pattern)
      const leakPattern = new RegExp(`NEXT_PUBLIC_${pattern}`, 'gi');
      const matches = content.match(leakPattern);
      
      if (matches) {
        hasLeak = true;
        leakCount += matches.length;
        
        matches.forEach(match => {
          leaksInFile.push({
            pattern: match,
            reason: 'Secrets exposed to browser via NEXT_PUBLIC_ prefix'
          });
        });
      }

      // Additionally, check if secret keys are used in .tsx (client components)
      if (filePath.endsWith('.tsx')) {
        const clientKeyPattern = new RegExp(`process\\.env\\.${pattern}(?!_)`, 'g');
        const clientMatches = content.match(clientKeyPattern);
        
        if (clientMatches && !filePath.includes('.server.') && !filePath.includes('/api/')) {
          hasLeak = true;
          leakCount += clientMatches.length;
          
          clientMatches.forEach(match => {
            leaksInFile.push({
              pattern: match,
              reason: 'Secret key accessed in client-side component (non-API route)'
            });
          });
        }
      }
    });

    if (hasLeak) {
      leaksFound.push({
        file: filePath,
        leaks: leaksInFile
      });
    }
  } catch (error) {
    // Skip files that can't be read
  }
}

function scanDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!isIgnoredDir(file)) {
          scanDirectory(filePath);
        }
      } else if (shouldScanFile(filePath)) {
        scanFile(filePath);
      }
    });
  } catch (error) {
    // Skip directories that can't be read
  }
}

function printBanner() {
  console.log(`\n${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${BLUE}║                 🔐 SECURITY AUDIT INITIATED                  ║${RESET}`);
  console.log(`${BOLD}${BLUE}║        Scanning for Exposed Secrets (NEXT_PUBLIC_ leak)       ║${RESET}`);
  console.log(`${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${RESET}\n`);
}

function printResults() {
  console.log(`\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}📊 SCAN COMPLETE${RESET}`);
  console.log(`${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);

  console.log(`Files scanned: ${filesScanned}`);
  console.log(`Total leaks detected: ${leakCount}\n`);

  if (leakCount === 0) {
    console.log(`${GREEN}${BOLD}✅ EXCELLENT! No exposed secrets detected.${RESET}`);
    console.log(`Your secrets are properly protected from the browser.${RESET}\n`);
    return;
  }

  console.log(`${RED}${BOLD}⚠️  CRITICAL SECURITY ISSUES FOUND!${RESET}\n`);
  console.log(`The following files contain secrets exposed to the browser:\n`);

  leaksFound.forEach((leak) => {
    console.log(`${RED}📄 ${leak.file}${RESET}`);
    leak.leaks.forEach((leak) => {
      console.log(`   ${YELLOW}→ ${leak.pattern}${RESET}`);
      console.log(`     Reason: ${leak.reason}`);
    });
    console.log();
  });

  console.log(`${RED}${BOLD}REQUIRED ACTIONS:${RESET}`);
  console.log(`1. Remove ${RED}NEXT_PUBLIC_${RESET} prefix from all sensitive variables in ${BOLD}.env${RESET}`);
  console.log(`2. Create API routes to proxy requests through the backend`);
  console.log(`3. Update frontend to call these API routes instead of accessing env directly`);
  console.log(`4. Rotate any compromised API keys in their respective services`);
  console.log(`5. Re-run this audit to verify all issues are resolved\n`);
}

function main() {
  printBanner();
  
  const startTime = Date.now();
  console.log(`🔍 Scanning codebase for exposed secrets...\n`);

  const rootDir = process.cwd();
  scanDirectory(rootDir);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✓ Scan completed in ${duration}s\n`);

  printResults();
}

// Run the audit
main();
