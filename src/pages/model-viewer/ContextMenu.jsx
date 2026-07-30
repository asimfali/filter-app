import { useEffect } from 'react';
import { IconEye } from '../../components/common/Icons';

// ── Контекстное меню ──────────────────────────────────────────────────────────

export default function ContextMenu({ x, y, node, onHide, onShow, onIsolate, onFocus, onClose }) {
    useEffect(() => {
        const handler = () => onClose();
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed z-50 bg-white dark:bg-neutral-900 border border-gray-200
                       dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-40"
            style={{ left: x, top: y }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500
                            dark:text-gray-400 border-b border-gray-100
                            dark:border-gray-800 truncate max-w-48">
                {node.name}
            </div>
            <button onClick={onHide}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <IconEye className="w-4 h-4 inline mr-1" /> Скрыть
            </button>
            <button onClick={onShow}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                ✓ Показать
            </button>
            <button onClick={onIsolate}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                ◎ Изолировать
            </button>
            <button onClick={onFocus}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                ⊙ Фокус
            </button>
        </div>
    );
}
