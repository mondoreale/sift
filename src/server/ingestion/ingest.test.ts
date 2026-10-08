import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { FxRateProvider } from '../approval/evaluate';
import { feedPaths, mockedUsdRateProvider } from '../config';
import { ingestFiles } from './ingest';

describe('startup ingestion', () => {
    it('preserves the supplied sample and reports every original rejection', async () => {
        const markdown = await readFile(
            new URL('../../../instructions.md', import.meta.url),
            'utf8',
        );
        const supplied = JSON.parse(markdown.split('```json\n')[1]!.split('```')[0]!);
        const paths = feedPaths();
        expect(JSON.parse(await readFile(paths[0]!, 'utf8'))).toEqual(supplied);
        const { jobs, review } = await ingestFiles([paths[0]!], {
            rateProvider: mockedUsdRateProvider,
        });
        expect(jobs).toEqual([]);
        expect(review).toHaveLength(20);
        expect(review.map((entry) => entry.reasons.map((reason) => reason.code))).toEqual([
            ['SALARY_PERIOD_REQUIRED'],
            ['EMPLOYMENT_INELIGIBLE', 'STAFFING_FIRM', 'SALARY_PERIOD_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['EMPLOYMENT_INELIGIBLE'],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            [
                'STAFFING_FIRM',
                'LANGUAGE_INELIGIBLE',
                'SALARY_PERIOD_REQUIRED',
                'SALARY_CURRENCY_REQUIRED',
            ],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['LOCATION_INELIGIBLE', 'LANGUAGE_INELIGIBLE', 'SALARY_PERIOD_REQUIRED'],
            ['EMPLOYMENT_INELIGIBLE', 'SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['EMPLOYMENT_INELIGIBLE', 'STAFFING_FIRM'],
            ['SALARY_PERIOD_REQUIRED', 'SALARY_CURRENCY_REQUIRED'],
            ['SALARY_PERIOD_REQUIRED'],
            ['TITLE_REQUIRED', 'EMPLOYMENT_INELIGIBLE', 'STAFFING_FIRM', 'SALARY_TOO_LOW'],
        ]);
    });

    it('loads both files, publishes only explicit demo jobs and assigns stable IDs', async () => {
        const log = vi.fn();
        const first = await ingestFiles(feedPaths(), { rateProvider: mockedUsdRateProvider, log });
        const second = await ingestFiles(feedPaths(), { rateProvider: mockedUsdRateProvider });
        expect(first.jobs).toEqual(second.jobs);
        expect(first.jobs.map((job) => job.title)).toEqual([
            'Platform Engineer',
            'Data Engineer',
            'Remote Systems Engineer',
            'Cloud Engineer',
            'Software Engineer',
            'Product Analyst',
            'UX Designer',
            'Security Engineer',
        ]);
        expect(first.jobs.every((job) => job.company?.startsWith('Demo:'))).toBe(true);
        expect(new Set(first.jobs.map((job) => job.id)).size).toBe(8);
        expect(log).toHaveBeenLastCalledWith({
            event: 'ingestion_summary',
            total: 29,
            approved: 8,
            rejected: 21,
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain('Temporary support role.');
    });

    it('continues past invalid individual records and accepts empty arrays', async () => {
        const { review } = await ingestFiles(['mixed.json', 'empty.json'], {
            rateProvider: mockedUsdRateProvider,
            read: async (path) => (path === 'mixed.json' ? '[null,[],42,{}]' : '[]'),
        });
        expect(review).toHaveLength(4);
        expect(
            review.slice(0, 3).every((entry) => entry.reasons[0]?.code === 'INVALID_RECORD'),
        ).toBe(true);
        expect(review[3]?.reasons.length).toBeGreaterThan(1);
        expect(
            await ingestFiles(['empty.json'], {
                rateProvider: mockedUsdRateProvider,
                read: async () => '[]',
            }),
        ).toEqual({ jobs: [], review: [] });
    });

    it.each(['broken', '{}', 'null'])(
        'fails atomically for an invalid feed root: %s',
        async (content) => {
            const log = vi.fn();
            await expect(
                ingestFiles(['bad.json'], {
                    rateProvider: mockedUsdRateProvider,
                    read: async () => content,
                    log,
                }),
            ).rejects.toThrow('Feed');
            expect(log).not.toHaveBeenCalled();
        },
    );

    it('fails safely when a configured file cannot be read', async () => {
        await expect(
            ingestFiles(['missing.json'], {
                rateProvider: mockedUsdRateProvider,
                read: async () => {
                    throw new Error('private permission details');
                },
            }),
        ).rejects.toThrow('Unable to read feed missing.json');
    });

    it('rejects a failed FX lookup and continues publishing later records', async () => {
        const record = {
            title: 'Engineer',
            description: 'Build software.',
            location: 'Austin, TX, USA',
            remote: false,
            salary: { value: 150000, currency: 'CAD', unit: 'annual' },
            employment_type: 'Full-Time',
            company_type: 'Direct Employer',
            language: 'English',
        };
        const rateProvider = vi
            .fn<FxRateProvider>()
            .mockRejectedValueOnce(new Error('private service details'))
            .mockResolvedValueOnce(0.74);
        const log = vi.fn();

        const { jobs, review } = await ingestFiles(['fx.json'], {
            rateProvider,
            read: async () => JSON.stringify([record, { ...record, title: 'Later Engineer' }]),
            log,
        });

        expect(rateProvider.mock.calls).toEqual([['CAD'], ['CAD']]);
        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toMatchObject({
            title: 'Later Engineer',
            compensation: { amount: 150000, currency: 'CAD', annualizedUsd: 111000 },
        });
        expect(review).toMatchObject([
            { record: 1, status: 'rejected', reasons: [{ code: 'FX_SERVICE_UNAVAILABLE' }] },
            { record: 2, status: 'approved', reasons: [] },
        ]);
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenNthCalledWith(1, review[0]);
        expect(log).toHaveBeenLastCalledWith({
            event: 'ingestion_summary',
            total: 2,
            approved: 1,
            rejected: 1,
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain('private service details');
    });
});
