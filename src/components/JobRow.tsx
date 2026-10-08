import { type Job } from '@/contracts';

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
});

function formatSalary({ compensation }: Job) {
    const hourly = compensation.period === 'hourly';
    const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: compensation.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: hourly ? 2 : 0,
    }).format(hourly ? compensation.amount : Math.round(compensation.amount / 1000));

    return hourly ? `${amount} / hr` : `${amount}k / yr`;
}

export function JobRow({ job }: { job: Job }) {
    const country = job.location?.country;
    const location = [
        job.location?.city,
        job.location?.region,
        country ? countryNames.of(country) : null,
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <li className="group grid gap-x-10 gap-y-3 border-t border-line py-7 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 wrap-anywhere">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-[19px] leading-snug font-medium transition-colors group-hover:text-muted motion-reduce:transition-none">
                        {job.title}
                    </h2>
                    <span className="text-[15px] text-muted">
                        {job.company ?? 'Company unavailable'}
                    </span>
                </div>
                {job.description && (
                    <p className="mt-2 line-clamp-2 max-w-xl text-[14.5px] leading-relaxed text-muted">
                        {job.description}
                    </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11.5px] text-muted">
                    <span>{location || 'Location unavailable'}</span>
                    <span aria-hidden="true" className="h-3 w-px bg-line" />
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${job.remote ? 'bg-accent' : 'bg-ink'}`}
                        />
                        {job.remote ? 'Remote' : 'On-site'}
                    </span>
                </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-2 font-mono sm:max-w-60 sm:flex-col sm:items-end sm:justify-start sm:text-right">
                <span className="wrap-anywhere text-[13px] text-ink tabular-nums">
                    {formatSalary(job)}
                </span>
                {job.postingDate ? (
                    <time className="text-[11.5px] text-muted" dateTime={job.postingDate}>
                        {dateFormat.format(new Date(`${job.postingDate}T00:00:00Z`))}
                    </time>
                ) : (
                    <span className="text-[11.5px] text-muted">Date unavailable</span>
                )}
            </div>
        </li>
    );
}
