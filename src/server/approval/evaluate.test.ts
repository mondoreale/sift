import { describe, expect, it } from 'vitest';
import { normalize } from '../ingestion/normalize';
import { evaluateApproval, standardSalaryPolicy, type SalaryPolicy } from './evaluate';

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
const rates = { USD: 1, CAD: 0.74, GBP: 1.27, EUR: 1.08 };

function decide(overrides: Record<string, unknown> = {}, policy?: SalaryPolicy) {
    const { candidate } = normalize({ ...raw, ...overrides });
    if (!candidate) throw new Error('Expected a candidate');
    return evaluateApproval(candidate, 'test', rates, policy);
}

describe('explicit evidence and approval', () => {
    it('normalizes both source shapes without guessing salary fields', () => {
        const result = decide({
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
        [100000, 'annual', false],
        [100000.01, 'annual', true],
        [45, 'hourly', false],
        [46, 'hourly', true],
    ])('evaluates %s %s strictly, independently of annualization', (value, unit, approved) => {
        expect(decide({ salary: { value, currency: 'USD', unit } }).status).toBe(
            approved ? 'approved' : 'rejected',
        );
    });

    it('preserves original pay and converts only comparison values', () => {
        expect(
            decide({ salary: { value: 150000, currency: 'CAD', unit: 'annual' } }),
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
        expect(decide({ salary: { value: 46, currency: 'USD', unit: 'hourly' } })).toMatchObject({
            status: 'approved',
            job: { compensation: { annualizedUsd: 95680 } },
        });
    });

    it('collects independent failures without stopping at the title', () => {
        const result = decide({
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

    it('requires real evidence while allowing optional company and date', () => {
        expect(decide({ company: null, posting_date: '2023-02-30' })).toMatchObject({
            status: 'approved',
            job: { company: null, postingDate: null },
        });
        for (const overrides of [
            { remote: 'true' },
            { company_type: null },
            { description: '' },
            { language: '' },
            { salary: { value: 120000, currency: 'USD' } },
            { salary: { value: 120000, currency: 'ZZZ', unit: 'annual' } },
            { salary: { value: Infinity, currency: 'USD', unit: 'annual' } },
        ]) {
            expect(decide(overrides).status).toBe('rejected');
        }
        expect(normalize({ ...raw, posting_date: 'yesterday' }).diagnostics).toMatchObject([
            { code: 'INVALID_DATE' },
        ]);
        expect(normalize(null).candidate).toBeNull();
    });

    it('allows remote anywhere, French only in Canada, and non-staffing agencies', () => {
        expect(
            decide({
                remote: true,
                location: 'London, UK',
                company_type: 'Consulting Agency',
            }).status,
        ).toBe('approved');
        expect(decide({ remote: false, location: 'Berlin, Germany' }).status).toBe('rejected');
        expect(decide({ remote: true, location: null }).status).toBe('approved');
        expect(
            decide({
                remote: true,
                location: 'Montreal, QC, Canada',
                language: 'French',
            }).status,
        ).toBe('approved');
        expect(decide({ remote: true, location: null, language: 'French' }).status).toBe(
            'rejected',
        );
        expect(decide({ remote: true, location: 'London, UK', language: 'French' }).status).toBe(
            'rejected',
        );
    });

    it('supports an alternative salary rule without bypassing other gates', () => {
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
        expect(decide(overrides).status).toBe('rejected');
        expect(decide(overrides, remoteUkPolicy).status).toBe('approved');
        expect(decide({ ...overrides, company_type: 'Staffing Firm' }, remoteUkPolicy).status).toBe(
            'rejected',
        );
        expect(decide({ ...overrides, employment_type: 'Contract' }, remoteUkPolicy).status).toBe(
            'rejected',
        );
        expect(decide({ ...overrides, language: 'German' }, remoteUkPolicy).status).toBe(
            'rejected',
        );
    });
});
