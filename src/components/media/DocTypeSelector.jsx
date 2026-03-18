export default function DocTypeSelector({ docTypes, activeDocType, onSelect, hint }) {
    if (!docTypes.length) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {hint && (
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {hint}
                </span>
            )}
            <div className="flex flex-wrap gap-1">
                {docTypes.map(dt => (
                    <button
                        key={dt.code}
                        onClick={() => onSelect(dt)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors
                            ${activeDocType?.code === dt.code
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {dt.name}
                    </button>
                ))}
            </div>
        </div>
    );
}