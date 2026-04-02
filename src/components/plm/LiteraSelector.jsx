import React, { useState, useRef, useEffect } from 'react';

const STATUS_COLOR = {
    draft: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived: 'bg-neutral-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500',
};

const STATUS_LABEL = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    active: 'Активна',
    archived: 'В архиве',
};

export default function LiteraSelector({ stages, selected, onChange, showAll = true }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!stages || stages.length === 0) return null;

    if (stages.length === 1 && !showAll) {
        const s = stages[0];
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.status]}`}>
                Лит.{s.litera_code}
            </span>
        );
    }

    const label = selected === null
        ? 'Все литеры'
        : selected === 'none'
            ? 'Без литеры'
            : `Лит.${selected.litera_code}`;

    return (
        <div ref={ref} className="relative">
            {/* Кнопка-триггер */}
            <button
                onClick={() => setOpen(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full
                            font-medium border transition-colors
                            ${selected && selected !== 'none'
                                ? `${STATUS_COLOR[selected.status]} border-transparent`
                                : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
            >
                {label}
                <span className="text-[10px] opacity-60">{open ? '▲' : '▼'}</span>
            </button>

            {/* Дропдаун */}
            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-48
                                bg-white dark:bg-neutral-900
                                border border-gray-200 dark:border-gray-700
                                rounded-lg shadow-lg overflow-hidden">

                    {showAll && (
                        <>
                            <button
                                onClick={() => { onChange(null); setOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors
                                    hover:bg-neutral-50 dark:hover:bg-neutral-800
                                    ${selected === null
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                        : 'text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Все литеры
                            </button>
                            <button
                                onClick={() => { onChange('none'); setOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors
                                    hover:bg-neutral-50 dark:hover:bg-neutral-800
                                    border-b border-gray-100 dark:border-gray-800
                                    ${selected === 'none'
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                                        : 'text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Без литеры
                            </button>
                        </>
                    )}

                    {stages.map(stage => (
                        <button
                            key={stage.id}
                            onClick={() => { onChange(stage); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors
                                hover:bg-neutral-50 dark:hover:bg-neutral-800
                                ${selected?.id === stage.id
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : ''
                                }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        Лит.{stage.litera_code}
                                    </span>
                                    <span className="ml-1.5 text-gray-400">
                                        {stage.litera_name}
                                    </span>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded-full ${STATUS_COLOR[stage.status]}`}>
                                    {STATUS_LABEL[stage.status]}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}