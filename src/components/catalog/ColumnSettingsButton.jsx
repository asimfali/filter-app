import React, { useState } from 'react';
import ColumnSettingsModal from './ColumnSettingsModal';


/** Кнопка ⚙ + модалка настройки колонок (общая для просмотра и редактора). */
export default function ColumnSettingsButton({ columns, onToggle, onReorder }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-3 py-2 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800
                           text-gray-700 dark:text-gray-300 hover:bg-neutral-200
                           dark:hover:bg-neutral-700 transition-colors"
                title="Настройка колонок">
                ⚙
            </button>
            {open && (
                <ColumnSettingsModal columns={columns} onToggle={onToggle}
                    onReorder={onReorder} onClose={() => setOpen(false)} />
            )}
        </>
    );
}
