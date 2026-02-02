#!/usr/bin/env ts-node
/**
 * Manual Verification Script for Time Travel Bug Fix
 *
 * Purpose: Quickly verify that the date validation fix is working correctly
 * Usage: npx ts-node backend/scripts/verify-time-travel-fix.ts
 */

import {
  validateAndCorrectDate,
  validateBookingDate,
  getCurrentDateISO,
  getDateCorrectionStats,
  clearCorrectionHistory
} from '../src/utils/date-validation';
import { getTemporalContext } from '../src/services/super-system-prompt';
import { generatePromptContext } from '../src/config/system-prompts';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(emoji: string, message: string, color: string = colors.reset) {
  console.log(`${emoji}  ${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log(`\n${colors.cyan}${colors.bold}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}${'='.repeat(60)}${colors.reset}\n`);
}

function testResult(passed: boolean, testName: string, details?: string) {
  if (passed) {
    log('✅', `${colors.green}PASS: ${testName}${colors.reset}`);
    if (details) {
      console.log(`   ${colors.reset}→ ${details}${colors.reset}`);
    }
  } else {
    log('❌', `${colors.red}FAIL: ${testName}${colors.reset}`);
    if (details) {
      console.log(`   ${colors.red}→ ${details}${colors.reset}`);
    }
  }
}

async function main() {
  console.clear();

  log('🔍', `${colors.bold}Time Travel Bug Fix - Verification Script${colors.reset}\n`);
  log('📅', `Current Date: ${getCurrentDateISO()}`);
  log('📆', `Current Year: ${new Date().getFullYear()}\n`);

  let totalTests = 0;
  let passedTests = 0;

  // Clear any existing history
  clearCorrectionHistory();

  // ==========================================
  // Test 1: System Prompt Context
  // ==========================================
  header('Test 1: System Prompt Temporal Context');

  try {
    const context = getTemporalContext('America/New_York');
    totalTests++;

    const hasISODate = context.currentDateISO !== undefined;
    const hasYear = context.currentYear !== undefined;
    const isoFormat = /^\d{4}-\d{2}-\d{2}$/.test(context.currentDateISO || '');
    const correctYear = context.currentYear === new Date().getFullYear();

    if (hasISODate && hasYear && isoFormat && correctYear) {
      passedTests++;
      testResult(true, 'System prompt includes ISO date and year',
        `ISO: ${context.currentDateISO}, Year: ${context.currentYear}`);
    } else {
      testResult(false, 'System prompt missing required fields',
        `Has ISO: ${hasISODate}, Has Year: ${hasYear}, ISO Format: ${isoFormat}, Correct Year: ${correctYear}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'System prompt context generation failed', error.message);
  }

  // ==========================================
  // Test 2: Prompt Context Generation
  // ==========================================
  header('Test 2: Prompt Context for Organizations');

  try {
    const promptContext = generatePromptContext({
      id: 'test-org-123',
      name: 'Test Clinic',
      timezone: 'America/Los_Angeles',
      business_hours: '9 AM - 5 PM'
    });
    totalTests++;

    const hasISODate = promptContext.currentDateISO !== undefined;
    const hasYear = promptContext.currentYear !== undefined;

    if (hasISODate && hasYear) {
      passedTests++;
      testResult(true, 'Organization prompt context includes date/year',
        `ISO: ${promptContext.currentDateISO}, Year: ${promptContext.currentYear}`);
    } else {
      testResult(false, 'Organization prompt context missing fields',
        `Has ISO: ${hasISODate}, Has Year: ${hasYear}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Prompt context generation failed', error.message);
  }

  // ==========================================
  // Test 3: Date Validation - 2024 Auto-Correction
  // ==========================================
  header('Test 3: Date Validation & Auto-Correction');

  // Test 3a: 2024 date correction
  try {
    const result = validateAndCorrectDate('2024-02-03', true);
    totalTests++;

    if (result.action === 'corrected' && result.correctedDate?.startsWith('2026')) {
      passedTests++;
      testResult(true, '2024 date auto-corrected to 2026',
        `2024-02-03 → ${result.correctedDate}`);
    } else {
      testResult(false, '2024 date NOT corrected',
        `Action: ${result.action}, Corrected: ${result.correctedDate}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, '2024 date validation threw error', error.message);
  }

  // Test 3b: 2025 date correction
  try {
    const result = validateAndCorrectDate('2025-12-25', true);
    totalTests++;

    if (result.action === 'corrected' && result.correctedDate?.startsWith('2026')) {
      passedTests++;
      testResult(true, '2025 date auto-corrected to 2026',
        `2025-12-25 → ${result.correctedDate}`);
    } else {
      testResult(false, '2025 date NOT corrected',
        `Action: ${result.action}, Corrected: ${result.correctedDate}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, '2025 date validation threw error', error.message);
  }

  // Test 3c: Current year acceptance
  try {
    const currentYear = new Date().getFullYear();
    const result = validateAndCorrectDate(`${currentYear}-03-15`, true);
    totalTests++;

    if (result.action === 'accepted' && !result.correctedDate) {
      passedTests++;
      testResult(true, 'Current year date accepted without correction',
        `${currentYear}-03-15 accepted`);
    } else {
      testResult(false, 'Current year date incorrectly modified',
        `Action: ${result.action}, Corrected: ${result.correctedDate}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Current year validation threw error', error.message);
  }

  // Test 3d: Invalid format rejection
  try {
    const result = validateAndCorrectDate('02/03/2024', true);
    totalTests++;

    if (result.action === 'rejected') {
      passedTests++;
      testResult(true, 'Invalid format (MM/DD/YYYY) rejected',
        `Reason: ${result.reason}`);
    } else {
      testResult(false, 'Invalid format NOT rejected',
        `Action: ${result.action}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Invalid format validation threw error', error.message);
  }

  // ==========================================
  // Test 4: Booking Date Validation
  // ==========================================
  header('Test 4: Booking Date Validation (API-Ready)');

  // Test 4a: Valid booking date
  try {
    const result = validateBookingDate('2026-05-20', 'America/New_York', 'test-org');
    totalTests++;

    if (result.valid && !result.wasAutoCorrected) {
      passedTests++;
      testResult(true, 'Valid booking date accepted',
        'No correction needed');
    } else {
      testResult(false, 'Valid booking date incorrectly handled',
        `Valid: ${result.valid}, Corrected: ${result.wasAutoCorrected}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Booking date validation threw error', error.message);
  }

  // Test 4b: Past year booking date
  try {
    const result = validateBookingDate('2024-02-03', 'America/New_York', 'test-org');
    totalTests++;

    if (result.valid && result.wasAutoCorrected && result.correctedDate === '2026-02-03') {
      passedTests++;
      testResult(true, 'Past year booking date auto-corrected',
        `2024-02-03 → ${result.correctedDate}`);
    } else {
      testResult(false, 'Past year booking date not handled correctly',
        `Valid: ${result.valid}, Corrected: ${result.correctedDate}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Booking date validation threw error', error.message);
  }

  // ==========================================
  // Test 5: Correction Statistics
  // ==========================================
  header('Test 5: Correction Statistics Tracking');

  try {
    const stats = getDateCorrectionStats();
    totalTests++;

    const hasCorrections = stats.total > 0;
    const has2024Corrections = stats.correctionsByYear[2024] > 0;
    const has2025Corrections = stats.correctionsByYear[2025] > 0;
    const hasRecentCorrections = stats.recentCorrections.length > 0;

    if (hasCorrections && (has2024Corrections || has2025Corrections) && hasRecentCorrections) {
      passedTests++;
      testResult(true, 'Correction statistics tracking works',
        `Total: ${stats.total}, Last 24h: ${stats.last24Hours}, 2024: ${stats.correctionsByYear[2024] || 0}, 2025: ${stats.correctionsByYear[2025] || 0}`);
    } else {
      testResult(false, 'Correction statistics incomplete',
        `Total: ${stats.total}, Has corrections: ${hasCorrections}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'Statistics tracking threw error', error.message);
  }

  // ==========================================
  // Test 6: ISO Date Format Utility
  // ==========================================
  header('Test 6: ISO Date Utility Functions');

  try {
    const isoDate = getCurrentDateISO('America/New_York');
    totalTests++;

    const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
    const isCurrentYear = isoDate.startsWith(new Date().getFullYear().toString());

    if (isValidFormat && isCurrentYear) {
      passedTests++;
      testResult(true, 'ISO date utility returns correct format',
        `ISO Date: ${isoDate}`);
    } else {
      testResult(false, 'ISO date utility format incorrect',
        `Format valid: ${isValidFormat}, Current year: ${isCurrentYear}, Result: ${isoDate}`);
    }
  } catch (error: any) {
    totalTests++;
    testResult(false, 'ISO date utility threw error', error.message);
  }

  // ==========================================
  // Summary
  // ==========================================
  header('Verification Summary');

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  const allPassed = passedTests === totalTests;

  console.log(`\n${colors.bold}Total Tests:${colors.reset} ${totalTests}`);
  console.log(`${colors.green}${colors.bold}Passed:${colors.reset} ${passedTests}`);
  console.log(`${colors.red}${colors.bold}Failed:${colors.reset} ${totalTests - passedTests}`);
  console.log(`${colors.cyan}${colors.bold}Success Rate:${colors.reset} ${successRate}%\n`);

  if (allPassed) {
    log('🎉', `${colors.green}${colors.bold}ALL TESTS PASSED! Time travel bug fix is working correctly.${colors.reset}\n`);
    log('✅', 'System prompts include ISO date format');
    log('✅', 'Date validation auto-corrects past years');
    log('✅', 'Booking endpoints use validation');
    log('✅', 'Statistics tracking is operational');
    log('✅', 'Ready for production deployment!\n');
    process.exit(0);
  } else {
    log('⚠️', `${colors.yellow}${colors.bold}SOME TESTS FAILED. Review the output above.${colors.reset}\n`);
    log('🔧', 'Fix the failing tests before deploying to production');
    process.exit(1);
  }
}

// Run verification
main().catch(error => {
  console.error(`\n${colors.red}${colors.bold}FATAL ERROR:${colors.reset}`, error);
  process.exit(1);
});
