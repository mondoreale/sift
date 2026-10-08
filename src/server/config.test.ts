import { describe, expect, it } from 'vitest';
import { feedPaths, fxRates } from './config';

describe('startup configuration', () => {
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
