'use client';

import { jobQuerySchema, type Job, type JobListResponse } from '@/contracts';
import {
    BriefcaseBusiness,
    CircleAlert,
    Inbox,
    LoaderCircle,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchJobs } from './api/jobs';

type JobsState =
    { status: 'loading' } | { status: 'ready'; response: JobListResponse } | { status: 'error' };

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const dateFormat = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
});

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
        <li className='job-row'>
            <div className='job-info'>
                <h2>{job.title}</h2>
                <p className='company'>{job.company ?? 'Company unavailable'}</p>
                <p className='job-location'>
                    {job.remote && <span className='remote-label'>Remote</span>}
                    {location || (job.remote ? null : 'Location unavailable')}
                </p>
                {job.description && <p className='description'>{job.description}</p>}
            </div>
            <div className='job-meta'>
                <p className='salary'>
                    {compensation}
                    <span> / {job.compensation.period === 'hourly' ? 'hour' : 'year'}</span>
                </p>
                {job.postingDate ? (
                    <time dateTime={job.postingDate}>
                        {dateFormat.format(new Date(`${job.postingDate}T00:00:00Z`))}
                    </time>
                ) : (
                    <span className='date-unavailable'>Date unavailable</span>
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
            <header className='site-header'>
                <div className='header-inner'>
                    <div className='brand'>
                        <BriefcaseBusiness size={23} aria-hidden='true' />
                        <span>Job board</span>
                    </div>
                </div>
            </header>
            <main>
                <div className='page-heading'>
                    <div>
                        <p className='eyebrow'>Approved listings</p>
                        <h1>Jobs</h1>
                    </div>
                    {displayState.status === 'ready' && (
                        <span className='result-count'>
                            {displayState.response.total}{' '}
                            {displayState.response.total === 1 ? 'job' : 'jobs'}
                        </span>
                    )}
                </div>
                <form
                    className='search-controls'
                    onSubmit={(event) => event.preventDefault()}
                    aria-label='Job search'
                >
                    <label className='search-control' htmlFor='title-search'>
                        <span>Search titles</span>
                        <span className='search-input'>
                            <Search size={18} aria-hidden='true' />
                            <input
                                id='title-search'
                                type='search'
                                value={search}
                                maxLength={200}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </span>
                    </label>
                    <label htmlFor='country-filter'>
                        <span>Country</span>
                        <select
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
                    <label htmlFor='sort-jobs'>
                        <span>Sort</span>
                        <select
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
                    className='results'
                    aria-label='Job results'
                    aria-busy={displayState.status === 'loading'}
                >
                    {displayState.status === 'loading' && (
                        <div className='status-state' role='status'>
                            <LoaderCircle className='spinner' size={28} aria-hidden='true' />
                            <p>Loading jobs...</p>
                        </div>
                    )}
                    {displayState.status === 'error' && (
                        <div className='status-state error-state' role='alert'>
                            <CircleAlert size={28} aria-hidden='true' />
                            <h2>Could not load jobs</h2>
                            <button onClick={retry}>
                                <RefreshCw size={16} aria-hidden='true' />
                                Retry
                            </button>
                        </div>
                    )}
                    {displayState.status === 'ready' &&
                        (displayState.response.total === 0 ? (
                            <div className='status-state' role='status'>
                                <Inbox size={30} aria-hidden='true' />
                                <h2>{hasFilters ? 'No matching jobs' : 'No jobs available'}</h2>
                                {hasFilters && (
                                    <button onClick={clearFilters}>
                                        <X size={16} aria-hidden='true' />
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <ul className='job-list'>
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
