import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });

export const apiErrorResponseSchema = z.object({
    error: z.object({
        code: z.enum(['INTERNAL_ERROR', 'NOT_FOUND', 'INVALID_QUERY']),
        message: z.string().min(1),
    }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
