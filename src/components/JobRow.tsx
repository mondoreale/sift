import { type Job } from '@/contracts';

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
});

export function JobRow({ job }: { job: Job }) {
    const country = job.location?.country;
    const location = [
        job.location?.city,
        job.location?.region,
        country ? countryNames.of(country) : null,
    ]
        .filter(Boolean)
        .join(', ');
    const compensation = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: job.compensation.currency,
        maximumFractionDigits: 2,
    }).format(job.compensation.amount);

    return (
        <li className="grid grid-cols-1 gap-4 border-b border-line px-4 py-6 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] md:gap-6 md:px-6">
            <div className="min-w-0 wrap-anywhere">
                <h2 className="text-lg leading-snug font-semibold">{job.title}</h2>
                <p className="mt-1 text-[15px]">{job.company ?? 'Company unavailable'}</p>
                <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                    {job.remote && <span className="font-medium text-accent">Remote</span>}
                    {location || (job.remote ? null : 'Location unavailable')}
                </p>
                {job.description && (
                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted">
                        {job.description}
                    </p>
                )}
            </div>
            <div className="min-w-0 wrap-anywhere md:text-right">
                <p className="font-mono text-[15px] leading-6 font-medium tabular-nums">
                    {compensation}
                    <span className="font-sans text-[13px] font-normal text-muted">
                        {' '}
                        / {job.compensation.period === 'hourly' ? 'hour' : 'year'}
                    </span>
                </p>
                {job.postingDate ? (
                    <time className="mt-2 block text-[13px] text-muted" dateTime={job.postingDate}>
                        {dateFormat.format(new Date(`${job.postingDate}T00:00:00Z`))}
                    </time>
                ) : (
                    <span className="mt-2 block text-[13px] text-muted">Date unavailable</span>
                )}
            </div>
        </li>
    );
}
