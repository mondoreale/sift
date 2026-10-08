import { describe, expect, it } from 'vitest';
import { jobListResponseSchema, jobQuerySchema, jobSchema } from './jobs';

const job = {
    id: 'test-job',
    title: 'Backend Engineer',
    company: null,
    description: null,
    location: null,
    remote: true,
    compensation: {
        amount: 145000,
        currency: 'USD',
        period: 'annual',
        annualizedUsd: 145000,
    },
    postingDate: null,
};

describe('published job contracts', () => {
    it('validates search defaults and explicit query values', () => {
        expect(jobQuerySchema.parse({})).toEqual({
            search: '',
            sortBy: 'date',
            sortOrder: 'desc',
        });
        expect(jobQuerySchema.parse({ search: ' Engineer ', country: 'ca' }).country).toBe('CA');
        for (const query of [
            { sortBy: 'title' },
            { country: 'Canada' },
            { search: 'x'.repeat(201) },
            { file: 'secret' },
        ]) {
            expect(jobQuerySchema.safeParse(query).success).toBe(false);
        }
    });

    it('accepts an empty list', () => {
        expect(
            jobListResponseSchema.parse({
                items: [],
                total: 0,
                availableCountries: [],
            }),
        ).toEqual({
            items: [],
            total: 0,
            availableCountries: [],
        });
    });

    it('allows unknown location and posting date without inventing values', () => {
        expect(jobSchema.parse(job)).toEqual(job);
    });

    it.each(['', '   ', null])('rejects invalid published title %s', (title) => {
        expect(jobSchema.safeParse({ ...job, title }).success).toBe(false);
    });

    it.each(['2023-02-30', '2023-13-01', '', 'yesterday'])(
        'rejects invalid date %s',
        (postingDate) => {
            expect(jobSchema.safeParse({ ...job, postingDate }).success).toBe(false);
        },
    );

    it.each([0, -1, Infinity, NaN])('rejects invalid compensation %s', (amount) => {
        expect(
            jobSchema.safeParse({
                ...job,
                compensation: { ...job.compensation, amount },
            }).success,
        ).toBe(false);
    });

    it('requires explicit compensation currency and period', () => {
        expect(jobSchema.safeParse({ ...job, compensation: { amount: 62.5 } }).success).toBe(false);
    });

    it('rejects malformed jobs and inconsistent totals', () => {
        expect(jobListResponseSchema.safeParse({ items: [{}], total: 1 }).success).toBe(false);
        expect(jobListResponseSchema.safeParse({ items: [], total: 1 }).success).toBe(false);
    });
});
