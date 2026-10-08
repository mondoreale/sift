import { jobQuerySchema, jobSchema } from '@/contracts';
import { describe, expect, it } from 'vitest';
import { InMemoryJobRepository } from './in-memory-job-repository';

function makeJob() {
    return jobSchema.parse({
        id: 'repository-test-job',
        title: 'Backend Engineer',
        company: 'Example Company',
        description: null,
        location: { city: 'Austin', region: 'TX', country: 'US' },
        remote: false,
        compensation: {
            amount: 145000,
            currency: 'USD',
            period: 'annual',
            annualizedUsd: 145000,
        },
        postingDate: '2023-10-03',
    });
}

describe('in-memory job repository', () => {
    it('keeps repository instances isolated', async () => {
        const populated = new InMemoryJobRepository([makeJob()]);
        const empty = new InMemoryJobRepository();
        expect((await populated.list()).items).toHaveLength(1);
        expect(await empty.list()).toEqual({ items: [], availableCountries: [] });
    });

    it('does not retain mutable input references', async () => {
        const job = makeJob();
        const repository = new InMemoryJobRepository([job]);
        job.compensation.amount = 1;
        expect((await repository.list()).items[0]?.compensation.amount).toBe(145000);
    });

    it('does not expose mutable stored records', async () => {
        const repository = new InMemoryJobRepository([makeJob()]);
        const returnedJob = (await repository.list()).items[0];
        expect(returnedJob).toBeDefined();
        if (returnedJob) returnedJob.compensation.amount = 1;
        expect((await repository.list()).items[0]?.compensation.amount).toBe(145000);
    });

    it('combines literal title search and stated-country filtering without narrowing facets', async () => {
        const repository = new InMemoryJobRepository([
            makeJob(),
            {
                ...makeJob(),
                id: 'remote',
                remote: true,
                location: { city: null, region: null, country: 'GB' },
            },
            { ...makeJob(), id: 'worldwide', remote: true, location: null },
        ]);
        const result = await repository.list(
            jobQuerySchema.parse({ search: 'eNgInEeR', country: 'US' }),
        );
        expect(result.items.map((job) => job.id)).toEqual(['repository-test-job']);
        expect(result.availableCountries).toEqual(['GB', 'US']);
        expect((await repository.list(jobQuerySchema.parse({ search: '[.*]' }))).items).toEqual([]);
    });

    it('sorts comparable pay, leaves unknown dates last in both directions and breaks ties by id', async () => {
        const base = makeJob();
        const repository = new InMemoryJobRepository([
            { ...base, id: 'b', postingDate: null },
            {
                ...base,
                id: 'c',
                postingDate: '2023-10-02',
                compensation: {
                    amount: 46,
                    currency: 'USD',
                    period: 'hourly',
                    annualizedUsd: 95680,
                },
            },
            { ...base, id: 'a', postingDate: null },
            { ...base, id: 'd', postingDate: '2023-10-04' },
        ]);
        const ids = async (sortBy: string, sortOrder: string) =>
            (await repository.list(jobQuerySchema.parse({ sortBy, sortOrder }))).items.map(
                (job) => job.id,
            );
        expect(await ids('date', 'desc')).toEqual(['d', 'c', 'a', 'b']);
        expect(await ids('date', 'asc')).toEqual(['c', 'd', 'a', 'b']);
        expect(await ids('salary', 'asc')).toEqual(['c', 'a', 'b', 'd']);
        expect(await ids('salary', 'desc')).toEqual(['a', 'b', 'd', 'c']);
        expect(await ids('date', 'desc')).toEqual(['d', 'c', 'a', 'b']);
    });
});
