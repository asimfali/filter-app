export default function FileDropZone({
    file,
    onFile,
    error,
    accept = '.xlsx',
    placeholder = 'Выберите файл или перетащите сюда',
    hint,
}) {
    return (
        <>
            <label
                className={`flex flex-col items-center justify-center
                           border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors
                           ${file
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) onFile(dropped);
                }}
            >
                <input type="file" accept={accept} className="hidden"
                    onChange={e => onFile(e.target.files[0] || null)} />
                {file ? (
                    <>
                        <span className="text-2xl mb-1">✓</span>
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {file.name}
                        </span>
                        <span className="text-xs text-gray-400 mt-1">
                            {(file.size / 1024).toFixed(1)} KB
                        </span>
                    </>
                ) : (
                    <>
                        <span className="text-2xl mb-1 text-gray-400">📄</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {placeholder}
                        </span>
                        {hint && (
                            <span className="text-xs text-gray-400 mt-1">{hint}</span>
                        )}
                    </>
                )}
            </label>
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </>
    );
}