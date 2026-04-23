export default function WarningsList({ warnings }) {
    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3
                        border border-amber-200 dark:border-amber-800 max-h-32 overflow-y-auto">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                Предупреждения ({warnings.length}):
            </p>
            {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 dark:text-amber-400">· {w}</p>
            ))}
        </div>
    );
}