/**
 * Monitoring Routes
 * Provides system health and performance metrics endpoints
 */

import { Router, Request, Response } from 'express';
import { getCacheStats } from '../services/cache';
import { requireAuthOrDev } from '../middleware/auth';

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

export default monitoringRouter;
