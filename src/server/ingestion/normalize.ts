export type Diagnostic = { code: string; field: string; message: string };

export type Candidate = {
    title: string | null;
    company: string | null;
    description: string | null;
    location: {
        city: string | null;
        region: string | null;
        country: string | null;
    } | null;
    remote: boolean | null;
    amount: number | null;
    currency: string | null;
    period: 'annual' | 'hourly' | null;
    employmentType: string | null;
    companyType: string | null;
    language: string | null;
    postingDate: string | null;
};

export function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function object(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

const countryAliases: Record<string, string> = {
    usa: 'US',
    'united states': 'US',
    'united states of america': 'US',
    canada: 'CA',
    uk: 'GB',
    'united kingdom': 'GB',
    germany: 'DE',
    ireland: 'IE',
};

const countryNames = new Intl.DisplayNames(['en'], {
    type: 'region',
    fallback: 'none',
});

function country(value: unknown): string | null {
    const name = text(value);

    if (!name) return null;

    const alias = countryAliases[name.toLowerCase()];

    if (alias) return alias;

    const code = name.toUpperCase();

    return /^[A-Z]{2}$/.test(code) && countryNames.of(code) ? code : null;
}

function location(value: unknown): Candidate['location'] {
    const fields = object(value);

    if (fields)
        return {
            city: text(fields.city),
            region: text(fields.state),
            country: country(fields.country),
        };

    const valueText = text(value);

    if (!valueText || valueText.toLowerCase() === 'remote') return null;

    const parts = valueText.split(',').map((part) => part.trim());

    return {
        city: parts.length > 1 ? text(parts[0]) : null,
        region: parts.length > 2 ? text(parts[1]) : null,
        country: country(parts.at(-1)),
    };
}

export function normalize(raw: unknown): {
    candidate: Candidate | null;
    diagnostics: Diagnostic[];
} {
    const fields = object(raw);

    if (!fields)
        return {
            candidate: null,
            diagnostics: [
                {
                    code: 'INVALID_RECORD',
                    field: 'record',
                    message: 'Record must be a JSON object.',
                },
            ],
        };

    const salary = object(fields.salary);
    const amount = salary ? salary.value : fields.salary;
    const unit = salary && salary.unit === undefined ? 'annual' : text(salary?.unit)?.toLowerCase();

    const date = text(fields.posting_date);
    const validDate =
        date !== null &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

    const diagnostics: Diagnostic[] =
        date && !validDate
            ? [
                  {
                      code: 'INVALID_DATE',
                      field: 'posting_date',
                      message: 'Invalid posting date retained as unknown.',
                  },
              ]
            : [];

    return {
        candidate: {
            title: text(fields.title),
            company: text(fields.company),
            description: text(fields.description),
            location: location(fields.location),
            remote: typeof fields.remote === 'boolean' ? fields.remote : null,
            amount:
                typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : null,
            currency: text(salary?.currency)?.toUpperCase() ?? null,
            period: unit === 'annual' ? 'annual' : unit === 'hourly' ? 'hourly' : null,
            employmentType: text(fields.employment_type)?.toLowerCase() ?? null,
            companyType: text(fields.company_type)?.toLowerCase() ?? null,
            language: text(fields.language)?.toLowerCase() ?? null,
            postingDate: validDate ? date : null,
        },
        diagnostics,
    };
}
