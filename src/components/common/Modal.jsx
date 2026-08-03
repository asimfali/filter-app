const MAX_WIDTH_CLS = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
};

export default function Modal({
    title, subtitle, onClose, children, wide, maxWidth,
    scrollBody, closeOnBackdropClick, footer, headerExtra,
    bodyClassName, forceDark,
}) {
    const width = maxWidth ?? (wide ? '2xl' : 'md');
    const cardBg = forceDark ? 'bg-neutral-900' : 'bg-white dark:bg-neutral-900';
    const cardBorder = forceDark ? 'border border-gray-700' : '';
    const headerBorder = forceDark ? 'border-gray-700' : 'border-gray-200 dark:border-gray-700';
    const titleColor = forceDark ? 'text-white' : 'text-gray-900 dark:text-white';
    const subtitleColor = forceDark ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400';
    const closeColor = forceDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600';

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={closeOnBackdropClick ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            <div className={`${cardBg} ${cardBorder} rounded-xl shadow-xl w-full
                            ${MAX_WIDTH_CLS[width] ?? MAX_WIDTH_CLS.md}
                            ${scrollBody ? 'max-h-[90vh] flex flex-col' : ''}`}>
                <div className={`flex items-center justify-between px-5 py-4 border-b
                                ${headerBorder} shrink-0`}>
                    <div>
                        <h3 className={`font-semibold ${titleColor}`}>{title}</h3>
                        {subtitle && <p className={`text-xs ${subtitleColor} mt-0.5`}>{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {headerExtra}
                        <button onClick={onClose}
                            className={`${closeColor} text-xl leading-none transition-colors`}>
                            ✕
                        </button>
                    </div>
                </div>
                <div className={bodyClassName ?? (scrollBody ? 'flex-1 min-h-0 overflow-y-auto px-5 py-4' : 'px-5 py-4')}>
                    {children}
                </div>
                {footer && (
                    <div className={`px-5 py-4 border-t ${headerBorder} shrink-0`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}