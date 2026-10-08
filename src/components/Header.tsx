export function Header({ total }: { total: number | undefined }) {
    return (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-6 sm:flex-nowrap">
            <div className="min-w-0 flex-1 basis-40 sm:basis-auto">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                    Job board
                </p>
                <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
                    Open positions
                </h1>
            </div>
            {total !== undefined && (
                <p className="shrink-0 text-right">
                    <span className="block text-4xl font-medium tabular-nums tracking-tight sm:text-5xl">
                        {total}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                        {total === 1 ? 'job' : 'jobs'} available
                    </span>
                </p>
            )}
        </header>
    );
}
