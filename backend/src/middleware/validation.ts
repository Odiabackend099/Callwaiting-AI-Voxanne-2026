import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware factory for Zod schema validation
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateRequest(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate and parse request body
            const validated = schema.parse(req.body);

            // Replace req.body with validated data (ensures type safety)
            req.body = validated;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Log detailed error for debugging
                console.error('[VALIDATION] Request validation failed', {
                    url: req.url,
                    method: req.method,
                    errors: error.issues.map((err: any) => ({
                        path: err.path.join('.'),
                        message: err.message,
                        code: err.code,
                        expected: err.expected,
                        received: err.received
                    })),
                    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : undefined
                });

                // Format Zod errors into user-friendly messages
                const errors = error.issues.map((err: any) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code
                }));

                res.status(400).json({
                    error: 'Validation failed',
                    details: errors,
                    hint: 'Check the console for detailed error information'
                });
                return;
            }

            // Unexpected error
            console.error('[VALIDATION] Unexpected validation error', error);
            res.status(500).json({
                error: 'Internal server error during validation'
            });
        }
    };
}
