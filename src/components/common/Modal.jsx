const MAX_WIDTH_CLS = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
};

export default function Modal({
    title, onClose, children, wide, maxWidth,
    scrollBody, closeOnBackdropClick, footer,
}) {
    const width = maxWidth ?? (wide ? '2xl' : 'md');

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={closeOnBackdropClick ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            <div className={`bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full
                            ${MAX_WIDTH_CLS[width] ?? MAX_WIDTH_CLS.md}
                            ${scrollBody ? 'max-h-[90vh] flex flex-col' : ''}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b
                                border-gray-200 dark:border-gray-700 shrink-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ✕
                    </button>
                </div>
                <div className={scrollBody ? 'flex-1 min-h-0 overflow-y-auto px-5 py-4' : 'px-5 py-4'}>
                    {children}
                </div>
                {footer && (
                    <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}