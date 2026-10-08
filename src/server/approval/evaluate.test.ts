import { describe, expect, it, vi } from 'vitest';
import { mockedUsdRateProvider } from '../config';
import { normalize } from '../ingestion/normalize';
import {
    evaluateApproval,
    standardSalaryPolicy,
    type FxRateProvider,
    type SalaryPolicy,
} from './evaluate';

const raw = {
    title: ' Engineer ',
    description: 'Build software.',
    company: 'Demo employer',
    location: { country: 'USA', city: '', state: 'CA' },
    remote: false,
    salary: { value: 120000, currency: 'USD', unit: 'annual' },
    employment_type: 'Full-Time',
    company_type: 'Direct Employer',
    language: 'English',
    posting_date: '2023-10-01',
};

function decide(
    overrides: Record<string, unknown> = {},
    policy?: SalaryPolicy,
    rateProvider: FxRateProvider = mockedUsdRateProvider,
) {
    const { candidate } = normalize({ ...raw, ...overrides });
    if (!candidate) throw new Error('Expected a candidate');
    return evaluateApproval(candidate, 'test', rateProvider, policy);
}

describe('explicit evidence and approval', () => {
    it('normalizes both source shapes without guessing salary fields', async () => {
        const result = await decide({
            location: 'Montreal, QC, Canada',
            salary: 62.5,
            language: 'French',
        });
        expect(result).toMatchObject({
            status: 'rejected',
            reasons: [{ code: 'SALARY_PERIOD_REQUIRED' }, { code: 'SALARY_CURRENCY_REQUIRED' }],
        });
        const normalized = normalize({
            ...raw,
            location: 'Montreal, QC, Canada',
            salary: 62.5,
        });
        expect(normalized.candidate).toMatchObject({
            location: { city: 'Montreal', region: 'QC', country: 'CA' },
            amount: 62.5,
            period: null,
            currency: null,
        });
        expect(normalize(raw).candidate?.location).toEqual({
            city: null,
            region: 'CA',
            country: 'US',
        });
    });

    it.each([
        [100000, 'annual', 'rejected'],
        [100000.01, 'annual', 'approved'],
        [45, 'hourly', 'rejected'],
        [46, 'hourly', 'approved'],
    ])(
        'evaluates %s %s strictly, independently of annualization',
        async (value, unit, expectedStatus) => {
            expect((await decide({ salary: { value, currency: 'USD', unit } })).status).toBe(
                expectedStatus,
            );
        },
    );

    it('preserves original pay and converts only comparison values', async () => {
        expect(
            await decide({ salary: { value: 150000, currency: 'CAD', unit: 'annual' } }),
        ).toMatchObject({
            status: 'approved',
            job: {
                title: 'Engineer',
                compensation: {
                    amount: 150000,
                    currency: 'CAD',
                    annualizedUsd: 111000,
                },
            },
        });
        expect(
            await decide({ salary: { value: 46, currency: 'USD', unit: 'hourly' } }),
        ).toMatchObject({
            status: 'approved',
            job: { compensation: { annualizedUsd: 95680 } },
        });
    });

    it('collects independent failures without stopping at the title', async () => {
        const result = await decide({
            title: ' ',
            remote: false,
            location: null,
            employment_type: 'Contract',
            company_type: 'Staffing Firm',
            language: 'German',
            salary: { value: 40, currency: 'USD', unit: 'hourly' },
        });
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected')
            expect(result.reasons.map((entry) => entry.code)).toEqual([
                'TITLE_REQUIRED',
                'LOCATION_INELIGIBLE',
                'EMPLOYMENT_INELIGIBLE',
                'STAFFING_FIRM',
                'LANGUAGE_INELIGIBLE',
                'SALARY_TOO_LOW',
            ]);
    });

    it('requires real evidence while allowing optional company and date', async () => {
        expect(await decide({ company: null, posting_date: '2023-02-30' })).toMatchObject({
            status: 'approved',
            job: { company: null, postingDate: null },
        });
        expect(await decide({ salary: { value: 120000, currency: 'USD' } })).toMatchObject({
            status: 'approved',
            job: { compensation: { period: 'annual' } },
        });
        for (const overrides of [
            { remote: 'true' },
            { company_type: null },
            { description: '' },
            { language: '' },
            { salary: { value: 120000, currency: 'USD', unit: 'monthly' } },
            { salary: { value: 120000, currency: 'ZZZ', unit: 'annual' } },
            { salary: { value: Infinity, currency: 'USD', unit: 'annual' } },
        ]) {
            expect((await decide(overrides)).status).toBe('rejected');
        }
        expect(normalize({ ...raw, posting_date: 'yesterday' }).diagnostics).toMatchObject([
            { code: 'INVALID_DATE' },
        ]);
        expect(normalize(null).candidate).toBeNull();
    });

    it('allows remote anywhere, French only in Canada, and non-staffing agencies', async () => {
        expect(
            (
                await decide({
                    remote: true,
                    location: 'London, UK',
                    company_type: 'Consulting Agency',
                })
            ).status,
        ).toBe('approved');
        expect((await decide({ remote: false, location: 'Berlin, Germany' })).status).toBe(
            'rejected',
        );
        expect((await decide({ remote: true, location: null })).status).toBe('approved');
        expect(
            (
                await decide({
                    remote: true,
                    location: 'Montreal, QC, Canada',
                    language: 'French',
                })
            ).status,
        ).toBe('approved');
        expect((await decide({ remote: true, location: null, language: 'French' })).status).toBe(
            'rejected',
        );
        expect(
            (await decide({ remote: true, location: 'London, UK', language: 'French' })).status,
        ).toBe('rejected');
    });

    it('supports an alternative salary rule without bypassing other gates', async () => {
        const remoteUkPolicy: SalaryPolicy = (candidate, usdAmount) =>
            candidate.remote === true &&
            candidate.location?.country === 'GB' &&
            candidate.period === 'annual' &&
            usdAmount !== null &&
            usdAmount >= 90000
                ? []
                : standardSalaryPolicy(candidate, usdAmount);
        const overrides = {
            remote: true,
            location: 'London, UK',
            salary: { value: 90000, currency: 'USD', unit: 'annual' },
        };
        expect((await decide(overrides)).status).toBe('rejected');
        expect((await decide(overrides, remoteUkPolicy)).status).toBe('approved');
        expect(
            (await decide({ ...overrides, company_type: 'Staffing Firm' }, remoteUkPolicy)).status,
        ).toBe('rejected');
        expect(
            (await decide({ ...overrides, employment_type: 'Contract' }, remoteUkPolicy)).status,
        ).toBe('rejected');
        expect((await decide({ ...overrides, language: 'German' }, remoteUkPolicy)).status).toBe(
            'rejected',
        );
    });
});

describe('async USD rate lookup', () => {
    it('waits for the mocked response before applying salary policy', async () => {
        const { promise, resolve } = Promise.withResolvers<number | undefined>();
        const rateProvider = vi.fn<FxRateProvider>().mockReturnValue(promise);
        const policy = vi.fn(standardSalaryPolicy);
        const settled = vi.fn();
        const decision = decide(
            { salary: { value: 150000, currency: 'cad', unit: 'annual' } },
            policy,
            rateProvider,
        );
        const observed = decision.then(settled);

        await Promise.resolve();
        expect(rateProvider).toHaveBeenCalledExactlyOnceWith('CAD');
        expect(policy).not.toHaveBeenCalled();
        expect(settled).not.toHaveBeenCalled();

        resolve(0.74);
        await expect(decision).resolves.toMatchObject({
            status: 'approved',
            job: { compensation: { amount: 150000, currency: 'CAD', annualizedUsd: 111000 } },
        });
        await observed;
        expect(policy).toHaveBeenCalledWith(expect.anything(), 111000);
    });

    it('does not request a rate without explicit currency', async () => {
        const rateProvider = vi.fn<FxRateProvider>();

        await expect(
            decide({ salary: { value: 120000, unit: 'annual' } }, undefined, rateProvider),
        ).resolves.toMatchObject({
            status: 'rejected',
            reasons: [{ code: 'SALARY_CURRENCY_REQUIRED' }],
        });
        expect(rateProvider).not.toHaveBeenCalled();
    });

    it.each([undefined, 0, -1, NaN, Infinity])('rejects an invalid rate: %s', async (rate) => {
        const rateProvider = vi.fn<FxRateProvider>().mockResolvedValue(rate);

        await expect(decide({}, undefined, rateProvider)).resolves.toMatchObject({
            status: 'rejected',
            reasons: [{ code: 'CURRENCY_UNSUPPORTED' }],
        });
    });

    it('records lookup failure safely alongside independent rejection reasons', async () => {
        const rateProvider = vi
            .fn<FxRateProvider>()
            .mockRejectedValue(new Error('private service details'));
        const policy = vi.fn<SalaryPolicy>().mockReturnValue([]);
        const result = await decide({ title: '' }, policy, rateProvider);

        expect(result).toEqual({
            status: 'rejected',
            reasons: [
                {
                    code: 'TITLE_REQUIRED',
                    field: 'title',
                    message: 'A nonblank title is required.',
                },
                {
                    code: 'FX_SERVICE_UNAVAILABLE',
                    field: 'salary.currency',
                    message: 'USD exchange rate lookup failed.',
                },
            ],
        });
        expect(policy).toHaveBeenCalledWith(expect.anything(), null);
    });
});
