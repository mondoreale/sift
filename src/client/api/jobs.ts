import {
    jobListResponseSchema,
    jobQuerySchema,
    type JobListResponse,
    type JobQuery,
} from '@/contracts';

export async function fetchJobs(
    signal?: AbortSignal,
    query: JobQuery = jobQuerySchema.parse({}),
): Promise<JobListResponse> {
    const params = new URLSearchParams();

    if (query.search) params.set('search', query.search);
    if (query.country) params.set('country', query.country);
    if (query.sortBy !== 'date') params.set('sortBy', query.sortBy);
    if (query.sortOrder !== 'desc') params.set('sortOrder', query.sortOrder);

    const response = await fetch(
        `/api/jobs${params.size ? `?${params}` : ''}`,
        signal ? { signal } : {},
    );

    if (!response.ok) {
        throw new Error('Jobs are temporarily unavailable. Please try again.');
    }

    let body: unknown;

    try {
        body = await response.json();
    } catch {
        throw new Error('The job service returned an invalid response.');
    }

    const result = jobListResponseSchema.safeParse(body);

    if (!result.success) {
        throw new Error('The job service returned an invalid response.');
    }

    return result.data;
}
