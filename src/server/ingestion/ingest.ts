import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Job } from '@/contracts';
import { evaluateApproval, type FxRateProvider, type SalaryPolicy } from '../approval/evaluate';
import { normalize, type Diagnostic } from './normalize';

export type ReviewEntry = {
    source: string;
    record: number;
    title: string | null;
    status: 'approved' | 'rejected';
    reasons: Diagnostic[];
    diagnostics: Diagnostic[];
};

type IngestionLog =
    | ReviewEntry
    | {
          event: 'ingestion_summary';
          total: number;
          approved: number;
          rejected: number;
      };

type Options = {
    rateProvider: FxRateProvider;
    salaryPolicy?: SalaryPolicy;
    read?: (path: string) => Promise<string>;
    log?: (entry: IngestionLog) => void;
};

export async function ingestFiles(
    paths: readonly string[],
    options: Options,
): Promise<{ jobs: Job[]; review: ReviewEntry[] }> {
    const jobs: Job[] = [];
    const review: ReviewEntry[] = [];
    const read = options.read ?? ((path: string) => readFile(path, 'utf8'));

    for (const path of paths) {
        const key = createHash('sha256').update(resolve(path)).digest('hex').slice(0, 16);
        const source = `${basename(path)}:${key}`;

        let content: string;

        try {
            content = await read(path);
        } catch {
            throw new Error(`Unable to read feed ${source}.`);
        }

        let records: unknown;

        try {
            records = JSON.parse(content);
        } catch {
            throw new Error(`Feed ${source} contains invalid JSON.`);
        }

        if (!Array.isArray(records)) throw new Error(`Feed ${source} must contain a JSON array.`);

        for (const [index, raw] of records.entries()) {
            const { candidate, diagnostics } = normalize(raw);
            const result = candidate
                ? await evaluateApproval(
                      candidate,
                      `${key}:${index + 1}`,
                      options.rateProvider,
                      options.salaryPolicy,
                  )
                : { status: 'rejected' as const, reasons: diagnostics };

            if (result.status === 'approved') jobs.push(result.job);

            const entry: ReviewEntry = {
                source,
                record: index + 1,
                title: candidate?.title ?? null,
                status: result.status,
                reasons: result.status === 'rejected' ? result.reasons : [],
                diagnostics: candidate ? diagnostics : [],
            };

            review.push(entry);
        }
    }

    for (const entry of review) {
        if (entry.status === 'rejected' || entry.diagnostics.length) options.log?.(entry);
    }

    options.log?.({
        event: 'ingestion_summary',
        total: review.length,
        approved: jobs.length,
        rejected: review.length - jobs.length,
    });

    return { jobs, review };
}
