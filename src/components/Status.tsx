type StatusProps = {
    title: string;
    description: string;
    role?: 'status' | 'alert';
    titleAs?: 'p' | 'h2';
    action?:
        | {
              label: string;
              onClick: () => void;
          }
        | undefined;
};

export function Status({
    title,
    description,
    role = 'status',
    titleAs: Title = 'h2',
    action,
}: StatusProps) {
    return (
        <div className="px-5 py-20 text-center" role={role}>
            <Title className="text-[17px] font-medium">{title}</Title>
            <p className="mt-1.5 text-[14.5px] text-zinc-500">{description}</p>
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-6 max-w-full cursor-pointer border-b border-zinc-900 pb-0.5 font-mono text-[12px] hover:text-zinc-500 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
