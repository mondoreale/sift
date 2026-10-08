'use client';

import { Header } from '@/components/Header';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { jobQuerySchema, type Job, type JobListResponse } from '@/contracts';
import {
    AlertCircleIcon,
    Cancel01Icon,
    InboxIcon,
    Loading03Icon,
    RefreshIcon,
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
            <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 sm:pt-24">
                <Header
                    total={
                        displayState.status === 'ready' ? displayState.response.total : undefined
                    }
                />
                <form
                    className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,210px)]"
                    onSubmit={(event) => event.preventDefault()}
                    aria-label="Job search"
                >
                    <div className="min-w-0 sm:col-span-2 md:col-span-1">
                        <TextField
                            label="Search"
                            id="title-search"
                            type="search"
                            aria-label="Search titles"
                            placeholder="Job title"
                            value={search}
                            maxLength={200}
                            onChange={setSearch}
                            clearable
                        />
                    </div>
                    <Select
                        label="Country"
                        value={country}
                        onChange={(value) => {
                            setCountry(value);
                            setState({ status: 'loading' });
                        }}
                        options={[
                            { value: '', label: 'All countries' },
                            ...availableCountries.map((code) => ({
                                value: code,
                                label: countryNames.of(code) ?? code,
                            })),
                        ]}
                    />
                    <Select
                        label="Sort"
                        value={sort}
                        onChange={(value) => {
                            setSort(value);
                            setState({ status: 'loading' });
                        }}
                        options={[
                            { value: 'date:desc', label: 'Newest first' },
                            { value: 'date:asc', label: 'Oldest first' },
                            { value: 'salary:desc', label: 'Salary: high to low' },
                            { value: 'salary:asc', label: 'Salary: low to high' },
                        ]}
                    />
                </form>
                <section
                    className="min-h-72 border-y border-line bg-white"
                    aria-label="Job results"
                    aria-busy={displayState.status === 'loading'}
                >
                    {displayState.status === 'loading' && (
                        <div className={statusStyle} role="status">
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className="shrink-0 animate-spin text-muted motion-reduce:animate-none"
                                size={28}
                                strokeWidth={1.5}
                                aria-hidden="true"
                                focusable="false"
                            />
                            <p className="text-[15px] text-muted">Loading jobs...</p>
                        </div>
                    )}
                    {displayState.status === 'error' && (
                        <div className={statusStyle} role="alert">
                            <HugeiconsIcon
                                icon={AlertCircleIcon}
                                className="shrink-0 text-danger"
                                size={28}
                                strokeWidth={1.5}
                                aria-hidden="true"
                                focusable="false"
                            />
                            <h2 className="text-lg font-medium">Could not load jobs</h2>
                            <button className={buttonStyle} onClick={retry}>
                                <HugeiconsIcon
                                    icon={RefreshIcon}
                                    className="shrink-0"
                                    size={18}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                    focusable="false"
                                />
                                Retry
                            </button>
                        </div>
                    )}
                    {displayState.status === 'ready' &&
                        (displayState.response.total === 0 ? (
                            <div className={statusStyle} role="status">
                                <HugeiconsIcon
                                    icon={InboxIcon}
                                    className="shrink-0 text-muted"
                                    size={30}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                    focusable="false"
                                />
                                <h2 className="text-lg font-medium">
                                    {hasFilters ? 'No matching jobs' : 'No jobs available'}
                                </h2>
                                {hasFilters && (
                                    <button className={buttonStyle} onClick={clearFilters}>
                                        <HugeiconsIcon
                                            icon={Cancel01Icon}
                                            className="shrink-0"
                                            size={18}
                                            strokeWidth={1.5}
                                            aria-hidden="true"
                                            focusable="false"
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
