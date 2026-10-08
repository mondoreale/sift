import { jobSchema, type Job } from '@/contracts';
import type { Candidate, Diagnostic } from '../ingestion/normalize';

export type FxRates = Readonly<Record<string, number>>;

export type FxRateProvider = (currency: string) => Promise<number | undefined>;

export type SalaryPolicy = (candidate: Candidate, usdAmount: number | null) => Diagnostic[];

export type ApprovalResult =
    { status: 'approved'; job: Job } | { status: 'rejected'; reasons: Diagnostic[] };

function reason(code: string, field: string, message: string): Diagnostic {
    return { code, field, message };
}

export const standardSalaryPolicy: SalaryPolicy = (candidate, usdAmount) => {
    if (usdAmount === null || candidate.period === null) return [];

    const threshold = candidate.period === 'annual' ? 100000 : 45;

    return usdAmount > threshold
        ? []
        : [
              reason(
                  'SALARY_TOO_LOW',
                  'salary',
                  `USD pay must be strictly over ${threshold} per ${candidate.period === 'annual' ? 'year' : 'hour'}.`,
              ),
          ];
};

export async function evaluateApproval(
    candidate: Candidate,
    id: string,
    rateProvider: FxRateProvider,
    salaryPolicy: SalaryPolicy = standardSalaryPolicy,
): Promise<ApprovalResult> {
    const reasons: Diagnostic[] = [];
    const add = (code: string, field: string, message: string) =>
        reasons.push(reason(code, field, message));

    if (!candidate.title) add('TITLE_REQUIRED', 'title', 'A nonblank title is required.');

    if (candidate.remote === null)
        add('REMOTE_REQUIRED', 'remote', 'Remote status must be an explicit boolean.');

    if (candidate.remote !== true && !['US', 'CA'].includes(candidate.location?.country ?? '')) {
        add(
            'LOCATION_INELIGIBLE',
            'location',
            'Job must be remote or located in the US or Canada.',
        );
    }

    if (candidate.employmentType !== 'full-time')
        add(
            'EMPLOYMENT_INELIGIBLE',
            'employment_type',
            'Explicit full-time employment is required.',
        );

    if (candidate.companyType === 'staffing firm')
        add('STAFFING_FIRM', 'company_type', 'Staffing firms are not eligible.');
    else if (
        !['direct employer', 'consulting agency', 'non-staffing'].includes(
            candidate.companyType ?? '',
        )
    ) {
        add(
            'COMPANY_TYPE_UNKNOWN',
            'company_type',
            'Recognized non-staffing company evidence is required.',
        );
    }

    if (!candidate.description)
        add('DESCRIPTION_REQUIRED', 'description', 'Description is required as language evidence.');

    const english = candidate.language === 'english' || candidate.language === 'en';
    const french = candidate.language === 'french' || candidate.language === 'fr';

    if (!english && !(french && candidate.location?.country === 'CA')) {
        add(
            'LANGUAGE_INELIGIBLE',
            'language',
            'English is required, or French for a stated Canadian location.',
        );
    }

    if (candidate.amount === null)
        add('SALARY_AMOUNT_INVALID', 'salary.value', 'Salary must have a positive finite amount.');

    if (candidate.period === null)
        add(
            'SALARY_PERIOD_REQUIRED',
            'salary.unit',
            'Explicit annual or hourly salary unit is required.',
        );

    let rate: number | undefined;

    if (!candidate.currency)
        add('SALARY_CURRENCY_REQUIRED', 'salary.currency', 'Explicit salary currency is required.');
    else {
        let lookupFailed = false;
        try {
            rate = await rateProvider(candidate.currency);
        } catch {
            lookupFailed = true;
            add('FX_SERVICE_UNAVAILABLE', 'salary.currency', 'USD exchange rate lookup failed.');
        }

        if (!lookupFailed && (rate === undefined || !Number.isFinite(rate) || rate <= 0))
            add(
                'CURRENCY_UNSUPPORTED',
                'salary.currency',
                'No valid USD exchange rate for this currency.',
            );
    }

    const usdAmount =
        candidate.amount !== null && rate !== undefined && Number.isFinite(rate) && rate > 0
            ? candidate.amount * rate
            : null;

    const annualizedUsd =
        usdAmount === null ? null : usdAmount * (candidate.period === 'hourly' ? 2080 : 1);

    if (annualizedUsd !== null && (!Number.isFinite(annualizedUsd) || annualizedUsd <= 0)) {
        add(
            'SALARY_CONVERSION_INVALID',
            'salary',
            'USD conversion must remain positive and finite.',
        );
    }

    reasons.push(...salaryPolicy(candidate, usdAmount));

    if (reasons.length) return { status: 'rejected', reasons };

    const published = jobSchema.safeParse({
        id,
        title: candidate.title,
        company: candidate.company,
        description: candidate.description,
        location: candidate.location,
        remote: candidate.remote,
        postingDate: candidate.postingDate,
        compensation: {
            amount: candidate.amount,
            currency: candidate.currency,
            period: candidate.period,
            annualizedUsd,
        },
    });

    return published.success
        ? { status: 'approved', job: published.data }
        : {
              status: 'rejected',
              reasons: [
                  reason(
                      'PUBLICATION_INVALID',
                      'record',
                      'Record cannot be represented as a published job.',
                  ),
              ],
          };
}
