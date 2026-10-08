import { jobSchema, type JobListResponse } from '@/contracts';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { fetchJobs } from './api/jobs';

vi.mock('./api/jobs', () => ({ fetchJobs: vi.fn() }));
const fetchJobsMock = vi.mocked(fetchJobs);

beforeEach(() => {
    fetchJobsMock.mockReset();
});

describe('job board', () => {
    it('moves from loading to an honest empty state', async () => {
        let resolveRequest!: (response: JobListResponse) => void;
        fetchJobsMock.mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            }),
        );
        render(<App />);
        expect(screen.getByText('Job board')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Open positions' }),
        ).toBeInTheDocument();
        expect(screen.queryByText('jobs available')).not.toBeInTheDocument();
        expect(screen.getByText('Loading jobs...')).toBeInTheDocument();
        await act(async () => resolveRequest({ items: [], total: 0, availableCountries: [] }));
        expect(screen.getByRole('heading', { name: 'No jobs available' })).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('jobs available')).toBeInTheDocument();
    });

    it('retries a failed request and recovers', async () => {
        fetchJobsMock
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ items: [], total: 0, availableCountries: [] });
        render(<App />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load jobs');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
        expect(
            await screen.findByRole('heading', { name: 'No jobs available' }),
        ).toBeInTheDocument();
        expect(fetchJobsMock).toHaveBeenCalledTimes(2);
    });

    it('renders original compensation, unknown dates, and descriptions as text', async () => {
        const job = jobSchema.parse({
            id: 'client-test-job',
            title: 'Backend Engineer',
            company: 'Example Company',
            description: '<script>alert("unsafe")</script>',
            location: null,
            remote: true,
            compensation: {
                amount: 65,
                currency: 'USD',
                period: 'hourly',
                annualizedUsd: 135200,
            },
            postingDate: null,
        });
        fetchJobsMock.mockResolvedValue({
            items: [job],
            total: 1,
            availableCountries: [],
        });
        const { container } = render(<App />);
        expect(
            await screen.findByRole('heading', { name: 'Backend Engineer' }),
        ).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('job available')).toBeInTheDocument();
        expect(screen.getByText('Remote')).toBeInTheDocument();
        expect(screen.getByText('Date unavailable')).toBeInTheDocument();
        expect(screen.getByText('$65.00')).toBeInTheDocument();
        expect(screen.getByText('<script>alert("unsafe")</script>')).toBeInTheDocument();
        expect(container.querySelector('script')).toBeNull();
    });

    it('cancels the request on unmount', () => {
        fetchJobsMock.mockReturnValue(new Promise(() => {}));
        const { unmount } = render(<App />);
        const signal = fetchJobsMock.mock.calls[0]?.[0];
        unmount();
        expect(signal?.aborted).toBe(true);
    });

    it('debounces title edits and hides obsolete counts while waiting', async () => {
        vi.useFakeTimers();
        const response = { items: [], total: 0, availableCountries: ['CA', 'US'] };
        fetchJobsMock.mockResolvedValue(response);
        const { unmount } = render(<App />);
        try {
            await act(async () => {});
            fireEvent.change(screen.getByRole('searchbox', { name: 'Search titles' }), {
                target: { value: 'Eng' },
            });
            fireEvent.change(screen.getByRole('searchbox', { name: 'Search titles' }), {
                target: { value: 'Engineer' },
            });
            expect(screen.queryByText('jobs available')).not.toBeInTheDocument();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(299);
            });
            expect(fetchJobsMock).toHaveBeenCalledTimes(1);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(fetchJobsMock).toHaveBeenCalledTimes(2);
            expect(fetchJobsMock.mock.calls[1]?.[1]).toMatchObject({
                search: 'Engineer',
            });
            expect(screen.getByRole('heading', { name: 'No matching jobs' })).toBeInTheDocument();
        } finally {
            unmount();
            vi.useRealTimers();
        }
    });

    it('clears only the search query with the clear button', async () => {
        fetchJobsMock.mockResolvedValue({
            items: [],
            total: 0,
            availableCountries: ['CA'],
        });
        render(<App />);
        await screen.findByRole('option', { name: 'Canada' });
        const user = userEvent.setup();
        const searchInput = screen.getByRole('searchbox', { name: 'Search titles' });

        expect(searchInput).toHaveAttribute('placeholder', 'Job title');
        expect(searchInput).toHaveClass('h-11');
        expect(screen.getByRole('combobox', { name: 'Country' })).toHaveClass('h-11');
        expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveClass('h-11');
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
        await user.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'CA');
        await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'salary:asc');
        await user.type(searchInput, 'Engineer');
        await waitFor(() =>
            expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({ search: 'Engineer' }),
        );
        await user.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(searchInput).toHaveValue('');
        expect(searchInput).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
        await waitFor(() =>
            expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({
                search: '',
                country: 'CA',
                sortBy: 'salary',
                sortOrder: 'asc',
            }),
        );
    });

    it('updates country and sort immediately, retains facets and clears filters', async () => {
        fetchJobsMock.mockResolvedValue({
            items: [],
            total: 0,
            availableCountries: ['CA', 'US'],
        });
        render(<App />);
        await screen.findByRole('option', { name: 'Canada' });
        const user = userEvent.setup();
        await user.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'CA');
        expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({ country: 'CA' });
        await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'salary:asc');
        expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({
            country: 'CA',
            sortBy: 'salary',
            sortOrder: 'asc',
        });
        expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({
            search: '',
            country: undefined,
            sortBy: 'date',
            sortOrder: 'desc',
        });
        expect(
            await screen.findByRole('heading', { name: 'No jobs available' }),
        ).toBeInTheDocument();
    });

    it('ignores an out-of-order response and retries the current query', async () => {
        let resolveOld!: (response: JobListResponse) => void;
        fetchJobsMock
            .mockResolvedValueOnce({
                items: [],
                total: 0,
                availableCountries: ['CA', 'US'],
            })
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveOld = resolve;
                    }),
            )
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({
                items: [],
                total: 0,
                availableCountries: ['CA', 'US'],
            });
        render(<App />);
        const user = userEvent.setup();
        await screen.findByRole('option', { name: 'Canada' });
        await user.selectOptions(screen.getByRole('combobox', { name: 'Country' }), 'CA');
        const oldSignal = fetchJobsMock.mock.calls[1]?.[0];
        await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'salary:desc');
        expect(oldSignal?.aborted).toBe(true);
        await screen.findByRole('alert');
        await act(async () => {
            resolveOld({ items: [], total: 0, availableCountries: [] });
        });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() =>
            expect(fetchJobsMock.mock.lastCall?.[1]).toMatchObject({
                country: 'CA',
                sortBy: 'salary',
            }),
        );
        expect(
            await screen.findByRole('heading', { name: 'No matching jobs' }),
        ).toBeInTheDocument();
    });
});
