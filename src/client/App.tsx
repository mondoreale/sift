'use client';

import { jobQuerySchema, type Job, type JobListResponse } from '@/contracts';
import {
    AlertCircleIcon,
    Briefcase01Icon,
    Cancel01Icon,
    InboxIcon,
    Loading03Icon,
    RefreshIcon,
    Search01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { fetchJobs } from './api/jobs';

type JobsState =
    { status: 'loading' } | { status: 'ready'; response: JobListResponse } | { status: 'error' };

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
});

const labelStyle = 'flex min-w-0 flex-col gap-2 text-[13px] font-medium text-muted';
const controlStyle =
    'h-11 w-full min-w-0 rounded border border-line bg-white px-3 py-2 font-sans text-[15px] text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';
const buttonStyle =
    'inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus';
const statusStyle =
    'status-grid flex min-h-72 flex-col items-center justify-center gap-4 px-5 py-10 text-center';

function JobRow({ job }: { job: Job }) {
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
        <li className='grid grid-cols-1 gap-4 border-b border-line px-4 py-6 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] md:gap-6 md:px-6'>
            <div className='min-w-0 wrap-anywhere'>
                <h2 className='text-lg leading-snug font-semibold'>{job.title}</h2>
                <p className='mt-1 text-[15px]'>{job.company ?? 'Company unavailable'}</p>
                <p className='mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted'>
                    {job.remote && <span className='font-medium text-accent'>Remote</span>}
                    {location || (job.remote ? null : 'Location unavailable')}
                </p>
                {job.description && (
                    <p className='mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted'>
                        {job.description}
                    </p>
                )}
            </div>
            <div className='min-w-0 wrap-anywhere md:text-right'>
                <p className='font-mono text-[15px] leading-6 font-medium tabular-nums'>
                    {compensation}
                    <span className='font-sans text-[13px] font-normal text-muted'>
                        {' '}
                        / {job.compensation.period === 'hourly' ? 'hour' : 'year'}
                    </span>
                </p>
                {job.postingDate ? (
                    <time className='mt-2 block text-[13px] text-muted' dateTime={job.postingDate}>
                        {dateFormat.format(new Date(`${job.postingDate}T00:00:00Z`))}
                    </time>
                ) : (
                    <span className='mt-2 block text-[13px] text-muted'>Date unavailable</span>
                )}
            </div>
        </li>
    );
}

export function App() {
    const [state, setState] = useState<JobsState>({ status: 'loading' });
    const [requestVersion, setRequestVersion] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [country, setCountry] = useState('');
    const [sort, setSort] = useState('date:desc');
    const [availableCountries, setAvailableCountries] = useState<string[]>([]);
    const pendingSearch = search.trim() !== debouncedSearch;
    const hasFilters = Boolean(search.trim() || country);
    const displayState: JobsState = pendingSearch ? { status: 'loading' } : state;

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const controller = new AbortController();
        const query = jobQuerySchema.parse({
            search: debouncedSearch,
            country: country || undefined,
            sortBy: sort.startsWith('salary') ? 'salary' : 'date',
            sortOrder: sort.endsWith('asc') ? 'asc' : 'desc',
        });
        setState({ status: 'loading' });
        fetchJobs(controller.signal, query)
            .then((response) => {
                if (!controller.signal.aborted) {
                    setState({ status: 'ready', response });
                    setAvailableCountries(response.availableCountries);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({ status: 'error' });
            });
        return () => controller.abort();
    }, [requestVersion, debouncedSearch, country, sort]);

    function retry() {
        setState({ status: 'loading' });
        setRequestVersion((version) => version + 1);
    }

    function clearFilters() {
        setSearch('');
        setDebouncedSearch('');
        setCountry('');
        setSort('date:desc');
        setState({ status: 'loading' });
    }

    return (
        <>
            <header className='border-b border-line bg-white'>
                <div className='mx-auto flex min-h-16 max-w-280 items-center px-4 sm:px-8'>
                    <div className='flex items-center gap-2.5 text-xl font-semibold'>
                        <HugeiconsIcon
                            icon={Briefcase01Icon}
                            className='shrink-0 text-accent'
                            size={24}
                            strokeWidth={1.5}
                            aria-hidden='true'
                            focusable='false'
                        />
                        <span>Job board</span>
                    </div>
                </div>
            </header>
            <main className='mx-auto max-w-280 px-4 py-7 sm:px-8 sm:py-9'>
                <div className='mb-6 flex items-end justify-between gap-4'>
                    <div>
                        <p className='mb-1 text-[13px] text-muted'>Approved listings</p>
                        <h1 className='text-[28px] leading-tight font-semibold'>Jobs</h1>
                    </div>
                    {displayState.status === 'ready' && (
                        <span className='pb-1 font-mono text-[13px] whitespace-nowrap text-muted tabular-nums'>
                            {displayState.response.total}{' '}
                            {displayState.response.total === 1 ? 'job' : 'jobs'}
                        </span>
                    )}
                </div>
                <form
                    className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,210px)]'
                    onSubmit={(event) => event.preventDefault()}
                    aria-label='Job search'
                >
                    <label
                        className={`${labelStyle} sm:col-span-2 md:col-span-1`}
                        htmlFor='title-search'
                    >
                        <span>Search titles</span>
                        <span className='relative flex items-center'>
                            <HugeiconsIcon
                                icon={Search01Icon}
                                className='pointer-events-none absolute left-3 shrink-0'
                                size={18}
                                strokeWidth={1.5}
                                aria-hidden='true'
                                focusable='false'
                            />
                            <input
                                className={`${controlStyle} pl-10`}
                                id='title-search'
                                type='search'
                                value={search}
                                maxLength={200}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </span>
                    </label>
                    <label className={labelStyle} htmlFor='country-filter'>
                        <span>Country</span>
                        <select
                            className={controlStyle}
                            id='country-filter'
                            value={country}
                            onChange={(event) => {
                                setCountry(event.target.value);
                                setState({ status: 'loading' });
                            }}
                        >
                            <option value=''>All countries</option>
                            {availableCountries.map((code) => (
                                <option key={code} value={code}>
                                    {countryNames.of(code)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={labelStyle} htmlFor='sort-jobs'>
                        <span>Sort</span>
                        <select
                            className={controlStyle}
                            id='sort-jobs'
                            value={sort}
                            onChange={(event) => {
                                setSort(event.target.value);
                                setState({ status: 'loading' });
                            }}
                        >
                            <option value='date:desc'>Newest first</option>
                            <option value='date:asc'>Oldest first</option>
                            <option value='salary:desc'>Salary: high to low</option>
                            <option value='salary:asc'>Salary: low to high</option>
                        </select>
                    </label>
                </form>
                <section
                    className='min-h-72 border-y border-line bg-white'
                    aria-label='Job results'
                    aria-busy={displayState.status === 'loading'}
                >
                    {displayState.status === 'loading' && (
                        <div className={statusStyle} role='status'>
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='shrink-0 animate-spin text-muted motion-reduce:animate-none'
                                size={28}
                                strokeWidth={1.5}
                                aria-hidden='true'
                                focusable='false'
                            />
                            <p className='text-[15px] text-muted'>Loading jobs...</p>
                        </div>
                    )}
                    {displayState.status === 'error' && (
                        <div className={statusStyle} role='alert'>
                            <HugeiconsIcon
                                icon={AlertCircleIcon}
                                className='shrink-0 text-danger'
                                size={28}
                                strokeWidth={1.5}
                                aria-hidden='true'
                                focusable='false'
                            />
                            <h2 className='text-lg font-medium'>Could not load jobs</h2>
                            <button className={buttonStyle} onClick={retry}>
                                <HugeiconsIcon
                                    icon={RefreshIcon}
                                    className='shrink-0'
                                    size={18}
                                    strokeWidth={1.5}
                                    aria-hidden='true'
                                    focusable='false'
                                />
                                Retry
                            </button>
                        </div>
                    )}
                    {displayState.status === 'ready' &&
                        (displayState.response.total === 0 ? (
                            <div className={statusStyle} role='status'>
                                <HugeiconsIcon
                                    icon={InboxIcon}
                                    className='shrink-0 text-muted'
                                    size={30}
                                    strokeWidth={1.5}
                                    aria-hidden='true'
                                    focusable='false'
                                />
                                <h2 className='text-lg font-medium'>
                                    {hasFilters ? 'No matching jobs' : 'No jobs available'}
                                </h2>
                                {hasFilters && (
                                    <button className={buttonStyle} onClick={clearFilters}>
                                        <HugeiconsIcon
                                            icon={Cancel01Icon}
                                            className='shrink-0'
                                            size={18}
                                            strokeWidth={1.5}
                                            aria-hidden='true'
                                            focusable='false'
                                        />
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <ul>
                                {displayState.response.items.map((job) => (
                                    <JobRow key={job.id} job={job} />
                                ))}
                            </ul>
                        ))}
                </section>
            </main>
        </>
    );
}
