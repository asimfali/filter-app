export default function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full
                            ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b
                                border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ✕
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    );
}