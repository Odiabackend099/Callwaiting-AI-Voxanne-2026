/**
 * Monitoring Routes
 * Provides system health and performance metrics endpoints
 */

import { Router, Request, Response } from 'express';
import { getCacheStats } from '../services/cache';
import { requireAuthOrDev } from '../middleware/auth';
import { getDateCorrectionStats } from '../utils/date-validation';

const monitoringRouter = Router();

// Require authentication for all monitoring endpoints
monitoringRouter.use(requireAuthOrDev);

/**
 * GET /api/monitoring/cache-stats
 * Returns cache performance metrics
 *
 * Response format:
 * {
 *   timestamp: "2026-01-28T12:00:00.000Z",
 *   cache: {
 *     size: 42,
 *     hits: 1250,
 *     misses: 187,
 *     hitRate: 87.0
 *   }
 * }
 */
monitoringRouter.get('/cache-stats', (req: Request, res: Response) => {
  try {
    const stats = getCacheStats();

    res.json({
      timestamp: new Date().toISOString(),
      cache: stats,
      message: `Cache is performing well with ${stats.hitRate}% hit rate`
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch cache statistics',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/monitoring/health
 * Basic health check endpoint
 *
 * Response format:
 * {
 *   status: "healthy",
 *   timestamp: "2026-01-28T12:00:00.000Z",
 *   uptime: 86400
 * }
 */
monitoringRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

/**
 * GET /api/monitoring/date-corrections
 * Returns statistics about date auto-corrections (time travel bug tracking)
 *
 * Purpose: Monitor how often the AI attempts to book appointments in past years (e.g., 2024 instead of 2026)
 * This helps track the effectiveness of system prompt improvements over time.
 *
 * Response format:
 * {
 *   timestamp: "2026-02-02T12:00:00.000Z",
 *   stats: {
 *     totalCorrections: 15,
 *     last24Hours: 5,
 *     last7Days: 12,
 *     correctionsByYear: { "2024": 3, "2025": 2 },
 *     correctionsByOrg: { "org-123": 3, "org-456": 2 },
 *     recentCorrections: [ ... ]  // Last 10 corrections
 *   },
 *   interpretation: {
 *     status: "good|warning|critical",
 *     message: "Correction rate is X per day"
 *   }
 * }
 */
monitoringRouter.get('/date-corrections', (req: Request, res: Response) => {
  try {
    const stats = getDateCorrectionStats();

    // Calculate correction rate (corrections per day)
    const correctionsPerDay = stats.last7Days > 0
      ? (stats.last7Days / 7).toFixed(1)
      : '0';

    // Determine status based on correction rate
    let status: 'good' | 'warning' | 'critical';
    let message: string;

    if (stats.last24Hours === 0) {
      status = 'good';
      message = 'No date corrections needed in the last 24 hours. System prompts are working well!';
    } else if (stats.last24Hours <= 3) {
      status = 'good';
      message = `Low correction rate (${stats.last24Hours} in 24h). Prompts are effective.`;
    } else if (stats.last24Hours <= 10) {
      status = 'warning';
      message = `Moderate correction rate (${stats.last24Hours} in 24h). Consider reviewing system prompts.`;
    } else {
      status = 'critical';
      message = `High correction rate (${stats.last24Hours} in 24h). Urgent: Review and strengthen system prompts!`;
    }

    res.json({
      timestamp: new Date().toISOString(),
      stats: {
        totalCorrections: stats.total,
        last24Hours: stats.last24Hours,
        last7Days: stats.last7Days,
        correctionsByYear: stats.correctionsByYear,
        correctionsByOrg: stats.correctionsByOrg,
        recentCorrections: stats.recentCorrections
      },
      interpretation: {
        status,
        message,
        correctionsPerDay: parseFloat(correctionsPerDay)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch date correction statistics',
      message: error?.message || 'Unknown error'
    });
  }
});

export default monitoringRouter;
