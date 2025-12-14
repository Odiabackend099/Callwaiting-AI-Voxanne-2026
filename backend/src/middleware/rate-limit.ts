import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiter for agent configuration updates
// Allows 10 requests per minute per IP
export const agentConfigLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per window
    message: 'Too many configuration updates. Please try again in a minute.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many configuration updates. Please try again in a minute.',
            retryAfter: 60
        });
    }
});

// Rate limiter for call creation
// Allows 30 calls per minute per IP (more lenient for calling)
export const callCreationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per window
    message: 'Too many call attempts. Please try again in a minute.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many call attempts. Please try again in a minute.',
            retryAfter: 60
        });
    }
});

// General API rate limiter
// Allows 100 requests per minute per IP
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
