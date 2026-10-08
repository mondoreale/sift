import 'server-only';
import { feedPaths, mockedUsdRateProvider } from './config';
import { ingestFiles } from './ingestion/ingest';
import { InMemoryJobRepository } from './storage/in-memory-job-repository';
import type { JobRepository } from './storage/job-repository';

const state = globalThis as typeof globalThis & {
    jobSearchRepository?: Promise<JobRepository>;
};

async function initialize(): Promise<JobRepository> {
    const { jobs } = await ingestFiles(feedPaths(), {
        rateProvider: mockedUsdRateProvider,
        log: (entry) => console.error(JSON.stringify(entry)),
    });
    return new InMemoryJobRepository(jobs);
}

export function getRepository(): Promise<JobRepository> {
    return (state.jobSearchRepository ??= initialize());
}
