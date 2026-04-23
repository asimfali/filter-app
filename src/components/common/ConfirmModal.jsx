export default function ConfirmModal({ message, onConfirm, onCancel, danger = true }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-sm p-6 space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Отмена
                    </button>
                    <button onClick={onConfirm}
                        className={`px-4 py-2 text-sm rounded-lg text-white transition-colors
                                   ${danger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-blue-600 hover:bg-blue-700'}`}>
                        Подтвердить
                    </button>
                </div>
            </div>
        </div>
    );
}