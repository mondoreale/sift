import {
    apiErrorResponseSchema,
    healthResponseSchema,
    jobListResponseSchema,
    jobQuerySchema,
} from '@/contracts';
import type { JobRepository } from './storage/job-repository';

export function createApp(repository: JobRepository | (() => Promise<JobRepository>)) {
    async function request(input: string | Request): Promise<Response> {
        try {
            const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost');

            if (url.pathname === '/api/health') {
                if (typeof repository === 'function') await repository();

                return Response.json(healthResponseSchema.parse({ status: 'ok' }));
            }

            if (url.pathname !== '/api/jobs') {
                return Response.json(
                    apiErrorResponseSchema.parse({
                        error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
                    }),
                    { status: 404 },
                );
            }

            const params = url.searchParams;
            const parsed = jobQuerySchema.safeParse(Object.fromEntries(params));
            const repeated = [...params.keys()].some((key) => params.getAll(key).length > 1);

            if (!parsed.success || repeated) {
                return Response.json(
                    apiErrorResponseSchema.parse({
                        error: {
                            code: 'INVALID_QUERY',
                            message: 'Invalid job search parameters.',
                        },
                    }),
                    { status: 400 },
                );
            }

            const store = typeof repository === 'function' ? await repository() : repository;
            const result = await store.list(parsed.data);

            return Response.json(
                jobListResponseSchema.parse({ ...result, total: result.items.length }),
            );
        } catch (error) {
            console.error(error);

            return Response.json(
                apiErrorResponseSchema.parse({
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Unable to complete the request.',
                    },
                }),
                { status: 500 },
            );
        }
    }

    return { request };
}
