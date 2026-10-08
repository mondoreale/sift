import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestFiles } from './ingestion/ingest';
import { getRepository } from './runtime';

vi.mock('server-only', () => ({}));
vi.mock('./ingestion/ingest', () => ({ ingestFiles: vi.fn() }));

beforeEach(() => {
    vi.stubGlobal('jobSearchRepository', undefined);
    vi.mocked(ingestFiles).mockReset();
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('process-local repository initialization', () => {
    it('shares one pending ingestion across concurrent requests', async () => {
        let complete!: (result: Awaited<ReturnType<typeof ingestFiles>>) => void;
        vi.mocked(ingestFiles).mockReturnValue(
            new Promise((resolve) => {
                complete = resolve;
            }),
        );
        const first = getRepository();
        const second = getRepository();
        expect(second).toBe(first);
        expect(ingestFiles).toHaveBeenCalledTimes(1);
        complete({ jobs: [], review: [] });
        const repository = await first;
        expect(await second).toBe(repository);
        expect(await repository.list()).toEqual({ items: [], availableCountries: [] });
        expect(await getRepository()).toBe(repository);
        expect(ingestFiles).toHaveBeenCalledTimes(1);
    });

    it('retains failed initialization instead of serving a partial dataset', async () => {
        vi.mocked(ingestFiles).mockRejectedValue(new Error('invalid feed'));
        const first = getRepository();
        await expect(first).rejects.toThrow('invalid feed');
        expect(getRepository()).toBe(first);
        await expect(getRepository()).rejects.toThrow('invalid feed');
        expect(ingestFiles).toHaveBeenCalledTimes(1);
    });
});
