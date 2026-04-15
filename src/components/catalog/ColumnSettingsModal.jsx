import React, { useState } from 'react';

const TYPE_LABEL = { axis: 'Параметр', spec: 'Характеристика', docs: 'Документы' };
const TYPE_COLOR = {
    axis: 'text-blue-500 dark:text-blue-400',
    spec: 'text-gray-500 dark:text-gray-400',
    docs: 'text-emerald-600 dark:text-emerald-400',
};

export default function ColumnSettingsModal({ columns, onToggle, onReorder, onClose }) {
    const [dragging, setDragging] = useState(null); // index

    const handleDragStart = (i) => setDragging(i);
    const handleDragOver = (e, i) => {
        e.preventDefault();
        if (dragging === null || dragging === i) return;
        onReorder(dragging, i);
        setDragging(i);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={onClose}>
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl
                            border border-gray-200 dark:border-gray-700 w-80 max-h-[80vh]
                            flex flex-col"
                onClick={e => e.stopPropagation()}>

                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800
                                flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                        Настройка колонок
                    </span>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">
                        ×
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-2 py-2 space-y-0.5">
                    {columns.map((col, i) => (
                        <div
                            key={col.type + ':' + col.id}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={e => handleDragOver(e, i)}
                            onDragEnd={() => setDragging(null)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg
                                cursor-grab select-none transition-colors
                                ${dragging === i
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                }`}
                        >
                            {/* Drag handle */}
                            <span className="text-gray-300 dark:text-gray-600 text-xs">⠿</span>

                            {/* Toggle */}
                            <button
                                onClick={() => onToggle(col.type, col.id)}
                                className={`w-8 h-4 rounded-full transition-colors shrink-0
                                    ${col.visible
                                        ? 'bg-blue-500'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                            >
                                <span className={`block w-3 h-3 rounded-full bg-white
                                    shadow transition-transform mx-0.5
                                    ${col.visible ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>

                            {/* Label */}
                            <div className="min-w-0 flex-1">
                                <div className={`text-xs font-medium truncate
                                    ${col.visible
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-gray-400 dark:text-gray-500'
                                    }`}>
                                    {col.label}
                                </div>
                                <div className={`text-[10px] ${TYPE_COLOR[col.type]}`}>
                                    {TYPE_LABEL[col.type]}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onClose}
                        className="w-full text-xs text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300 transition-colors">
                        Готово
                    </button>
                </div>
            </div>
        </div>
    );
}