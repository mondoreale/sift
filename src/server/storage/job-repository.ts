import type { Job, JobQuery } from '@/contracts';

export type JobSearchResult = {
    items: readonly Job[];
    availableCountries: readonly string[];
};

export interface JobRepository {
    list(query?: JobQuery): Promise<JobSearchResult>;
}
