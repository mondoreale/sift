import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register } from '../instrumentation';
import { getRepository } from './runtime';
import { InMemoryJobRepository } from './storage/in-memory-job-repository';

vi.mock('./runtime', () => ({ getRepository: vi.fn() }));

beforeEach(() => {
    vi.mocked(getRepository).mockReset();
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('Next.js startup instrumentation', () => {
    it('initializes the repository before Node application preparation completes', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.mocked(getRepository).mockResolvedValue(new InMemoryJobRepository());
        await register();
        expect(getRepository).toHaveBeenCalledTimes(1);
    });

    it('does not load filesystem ingestion in the Edge runtime', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        await register();
        expect(getRepository).not.toHaveBeenCalled();
    });

    it('exits the process for fatal startup ingestion rather than relying on a framework throw', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        const failure = new Error('Feed cannot be read.');
        vi.mocked(getRepository).mockRejectedValue(failure);
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stopped = new Error('process stopped');
        const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw stopped;
        });
        await expect(register()).rejects.toBe(stopped);
        expect(exit).toHaveBeenCalledWith(1);
        expect(log).toHaveBeenCalledWith('Job ingestion failed.', failure);
    });
});
