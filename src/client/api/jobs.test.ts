import { jobQuerySchema } from '@/contracts';
import { describe, expect, it, vi } from 'vitest';
import { fetchJobs } from './jobs';

describe('job API boundary', () => {
    it('uses a relative endpoint and forwards cancellation', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(Response.json({ items: [], total: 0, availableCountries: [] }));

        vi.stubGlobal('fetch', fetchMock);

        const controller = new AbortController();

        expect(await fetchJobs(controller.signal)).toEqual({
            items: [],
            total: 0,
            availableCountries: [],
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/jobs', {
            signal: controller.signal,
        });
    });

    it('encodes literal search text and query values with URLSearchParams', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            Response.json({
                items: [],
                total: 0,
                availableCountries: ['CA', 'US'],
            }),
        );

        vi.stubGlobal('fetch', fetchMock);

        await fetchJobs(
            undefined,
            jobQuerySchema.parse({
                search: 'C++ & APIs',
                country: 'ca',
                sortBy: 'salary',
                sortOrder: 'asc',
            }),
        );

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/jobs?search=C%2B%2B+%26+APIs&country=CA&sortBy=salary&sortOrder=asc',
            {},
        );
    });

    it('rejects non-successful HTTP responses without leaking their contents', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(Response.json({ error: 'private details' }, { status: 500 })),
        );

        await expect(fetchJobs()).rejects.toThrow('Jobs are temporarily unavailable.');
    });

    it('rejects invalid JSON', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));

        await expect(fetchJobs()).rejects.toThrow('The job service returned an invalid response.');
    });

    it('rejects malformed response contracts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: [{}], total: 1 })));

        await expect(fetchJobs()).rejects.toThrow('The job service returned an invalid response.');
    });

    it('propagates network failures to the UI boundary', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

        await expect(fetchJobs()).rejects.toThrow('offline');
    });
});
