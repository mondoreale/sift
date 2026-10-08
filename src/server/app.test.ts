import { apiErrorResponseSchema, healthResponseSchema, jobListResponseSchema } from '@/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { InMemoryJobRepository } from './storage/in-memory-job-repository';
import { ingestFiles } from './ingestion/ingest';
import { fxRates } from './config';

afterEach(() => vi.restoreAllMocks());

describe('HTTP application', () => {
    it('returns the shared health contract', async () => {
        const response = await createApp(new InMemoryJobRepository()).request('/api/health');
        expect(response.status).toBe(200);
        expect(healthResponseSchema.parse(await response.json())).toEqual({
            status: 'ok',
        });
    });

    it('returns an empty approved-job list', async () => {
        const { jobs } = await ingestFiles(['empty.json'], {
            rates: fxRates,
            read: async () => '[]',
        });
        const response = await createApp(new InMemoryJobRepository(jobs)).request('/api/jobs');
        expect(response.status).toBe(200);
        expect(jobListResponseSchema.parse(await response.json())).toEqual({
            items: [],
            total: 0,
            availableCountries: [],
        });
    });

    it('returns a consistent error envelope for unknown endpoints', async () => {
        const response = await createApp(new InMemoryJobRepository()).request('/api/missing');
        expect(response.status).toBe(404);
        expect(apiErrorResponseSchema.parse(await response.json()).error.code).toBe('NOT_FOUND');
    });

    it('does not leak internal details when the repository fails', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failure = new Error('private storage details');
        const app = createApp({
            list: async () => {
                throw failure;
            },
        });
        const response = await app.request('/api/jobs');
        expect(response.status).toBe(500);
        const body = apiErrorResponseSchema.parse(await response.json());
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(body.error.message).not.toContain('private');
        expect(log).toHaveBeenCalledWith(failure);
    });

    it('refuses to publish invalid repository output', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const repository = new InMemoryJobRepository();
        vi.spyOn(repository, 'list').mockResolvedValue({
            items: [{ id: 'invalid' } as never],
            availableCountries: [],
        });
        const response = await createApp(repository).request('/api/jobs');
        expect(response.status).toBe(500);
        expect(apiErrorResponseSchema.parse(await response.json()).error.code).toBe(
            'INTERNAL_ERROR',
        );
    });

    it.each([
        'sortBy=title',
        'country=Canada',
        'sortOrder=sideways',
        'file=secret',
        'country=US&country=CA',
        `search=${'x'.repeat(201)}`,
    ])('rejects invalid query %s before reading storage', async (query) => {
        const repository = new InMemoryJobRepository();
        const list = vi.spyOn(repository, 'list');
        const response = await createApp(repository).request(`/api/jobs?${query}`);
        expect(response.status).toBe(400);
        expect(apiErrorResponseSchema.parse(await response.json()).error.code).toBe(
            'INVALID_QUERY',
        );
        expect(list).not.toHaveBeenCalled();
    });

    it('passes normalized query values to storage', async () => {
        const repository = new InMemoryJobRepository();
        const list = vi.spyOn(repository, 'list');
        expect(
            (
                await createApp(repository).request(
                    '/api/jobs?search=%20Engineer%20&country=ca&sortBy=salary&sortOrder=asc',
                )
            ).status,
        ).toBe(200);
        expect(list).toHaveBeenCalledWith({
            search: 'Engineer',
            country: 'CA',
            sortBy: 'salary',
            sortOrder: 'asc',
        });
    });

    it('accepts a standard Request and waits for repository initialization', async () => {
        const repository = new InMemoryJobRepository();
        const load = vi.fn().mockResolvedValue(repository);
        const response = await createApp(load).request(
            new Request('http://localhost:3000/api/jobs?country=US'),
        );
        expect(response.status).toBe(200);
        expect(load).toHaveBeenCalledTimes(1);
        expect(jobListResponseSchema.parse(await response.json()).total).toBe(0);
    });

    it.each(['/api/jobs', '/api/health'])(
        'does not report readiness or leak details after startup failure: %s',
        async (path) => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const load = vi.fn().mockRejectedValue(new Error('private feed path'));
            const response = await createApp(load).request(path);
            expect(response.status).toBe(500);
            expect(apiErrorResponseSchema.parse(await response.json())).toEqual({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Unable to complete the request.',
                },
            });
        },
    );
});
