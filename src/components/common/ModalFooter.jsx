export default function ModalFooter({
    onClose,
    onConfirm,
    loading,
    disabled,
    confirmLabel,
    closeLabel = 'Отмена',
}) {
    return (
        <div className="flex justify-end gap-2">
            <button onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                           text-gray-600 dark:text-gray-400
                           hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                {closeLabel}
            </button>
            {onConfirm && (
                <button onClick={onConfirm} disabled={loading || disabled}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600
                               hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors">
                    {loading ? 'Обработка...' : confirmLabel}
                </button>
            )}
        </div>
    );
}