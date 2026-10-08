import { describe, expect, it } from 'vitest';
import { feedPaths, fxRates, mockedUsdRateProvider } from './config';

describe('startup configuration', () => {
    it.each([
        ['USD', 1],
        ['CAD', 0.74],
        ['GBP', 1.27],
        ['EUR', 1.08],
        ['ZZZ', undefined],
    ] as const)('returns a mocked async USD rate for %s', async (currency, rate) => {
        const response = mockedUsdRateProvider(currency);

        expect(response).toBeInstanceOf(Promise);
        await expect(response).resolves.toBe(rate);
    });

    it('resolves configured paths from the process directory and removes duplicates', () => {
        expect(feedPaths('["one.json","./one.json","two.json"]', '/feeds')).toEqual([
            '/feeds/one.json',
            '/feeds/two.json',
        ]);
        expect(Object.isFrozen(fxRates)).toBe(true);
    });
    it.each(['', 'bad', '[]', '{}', '[" "]', '[42]'])(
        'rejects invalid configuration %s',
        (value) => {
            expect(() => feedPaths(value)).toThrow('JOB_FILES');
        },
    );
});
