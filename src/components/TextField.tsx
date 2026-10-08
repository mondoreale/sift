import { useId, useRef, type ComponentPropsWithoutRef } from 'react';

type TextFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> & {
    label: string;
    value: string;
    onChange: (value: string) => void;
    clearable?: boolean;
};

export function TextField({
    label,
    value,
    onChange,
    clearable = false,
    id,
    className = '',
    disabled,
    readOnly,
    ...inputProps
}: TextFieldProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase text-zinc-400" htmlFor={inputId}>
                {label}
            </label>
            <span className="relative">
                <input
                    {...inputProps}
                    ref={inputRef}
                    id={inputId}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    onChange={(event) => onChange(event.target.value)}
                    className={`h-11 w-full min-w-0 appearance-none border-b border-zinc-300 bg-transparent py-2 pr-9 text-[15px] transition-colors outline-none placeholder:text-zinc-400 hover:border-zinc-900 focus:border-zinc-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-search-cancel-button]:appearance-none ${className}`}
                />
                {clearable && value && !disabled && !readOnly && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            inputRef.current?.focus();
                        }}
                        aria-label={`Clear ${label.toLowerCase()}`}
                        title={`Clear ${label.toLowerCase()}`}
                        className="absolute top-1/2 right-0 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center text-zinc-400 hover:text-zinc-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.25" />
                        </svg>
                    </button>
                )}
            </span>
        </div>
    );
}
