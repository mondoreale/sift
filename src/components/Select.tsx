function Chevron() {
    return (
        <svg
            className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-zinc-400"
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" />
        </svg>
    );
}

export function Select<T extends string>({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string }[];
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                {label}
            </span>
            <span className="relative">
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value as T)}
                    className="w-full cursor-pointer appearance-none border-b border-zinc-300 bg-transparent py-2 pr-6 text-[15px] outline-none transition-colors hover:border-zinc-900 focus:border-zinc-900"
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <Chevron />
            </span>
        </label>
    );
}
