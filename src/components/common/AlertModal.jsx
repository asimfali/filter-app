export default function AlertModal({ message, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-sm p-6 space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
                <div className="flex justify-end">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                   hover:bg-blue-700 text-white transition-colors">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}