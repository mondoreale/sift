import { jobQuerySchema, jobSchema, type Job, type JobQuery } from '@/contracts';
import type { JobRepository, JobSearchResult } from './job-repository';

export class InMemoryJobRepository implements JobRepository {
    private readonly jobs: Job[];

    constructor(initialJobs: readonly Job[] = []) {
        this.jobs = initialJobs.map((job) => jobSchema.parse(job));
    }

    async list(query: JobQuery = jobQuerySchema.parse({})): Promise<JobSearchResult> {
        const search = query.search.toLowerCase();
        const direction = query.sortOrder === 'asc' ? 1 : -1;

        const items = this.jobs.filter(
            (job) =>
                job.title.toLowerCase().includes(search) &&
                (!query.country || job.location?.country === query.country),
        );

        items.sort((first, second) => {
            let comparison: number;

            if (query.sortBy === 'salary')
                comparison = first.compensation.annualizedUsd - second.compensation.annualizedUsd;
            else {
                if (first.postingDate === null && second.postingDate !== null) return 1;
                if (second.postingDate === null && first.postingDate !== null) return -1;

                comparison = (first.postingDate ?? '').localeCompare(second.postingDate ?? '');
            }

            return comparison * direction || first.id.localeCompare(second.id);
        });

        const availableCountries = [
            ...new Set(
                this.jobs.flatMap((job) => (job.location?.country ? [job.location.country] : [])),
            ),
        ].sort();

        return structuredClone({ items, availableCountries });
    }
}
