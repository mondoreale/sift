import { resolve } from 'node:path';
import type { FxRates } from './approval/evaluate';

export const fxRates: FxRates = Object.freeze({
    USD: 1,
    CAD: 0.74,
    GBP: 1.27,
    EUR: 1.08,
});

export function feedPaths(configured = process.env.JOB_FILES, cwd = process.cwd()): string[] {
    if (configured === undefined)
        return ['assignment.json', 'demo.json'].map((file) => resolve(cwd, 'fixtures', file));
    let paths: unknown;
    try {
        paths = JSON.parse(configured);
    } catch {
        throw new Error('JOB_FILES must be a nonempty JSON array of file paths.');
    }
    if (
        !Array.isArray(paths) ||
        paths.length === 0 ||
        !paths.every((path) => typeof path === 'string' && path.trim())
    ) {
        throw new Error('JOB_FILES must be a nonempty JSON array of file paths.');
    }
    return [...new Set(paths.map((path: string) => resolve(cwd, path)))];
}
