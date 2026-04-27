import React, { useState } from 'react';

const TYPE_LABEL = {
    series: 'Серия + Дизайн + IP',
    length: 'Длина',
};

const TYPE_COLOR = {
    series: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    length: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function RulePreview({ rules }) {
    const [expanded, setExpanded] = useState({});

    if (!rules.length) {
        return (
            <p className="text-sm text-gray-400 text-center py-8">
                Правила не сгенерированы
            </p>
        );
    }

    const toggle = (idx) => {
        setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    return (
        <div className="space-y-2">
            {rules.map((rule, idx) => (
                <div key={idx}
                    className="border border-gray-100 dark:border-gray-800
                               rounded-lg overflow-hidden">

                    {/* Шапка правила */}
                    <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        onClick={() => toggle(idx)}
                    >
                        {/* Тип */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                            ${TYPE_COLOR[rule.type] || 'bg-gray-100 text-gray-600'}`}>
                            {TYPE_LABEL[rule.type] || rule.type}
                        </span>

                        {/* Название */}
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {rule.name}
                        </span>

                        {/* Совпадения */}
                        {rule.matches_count !== undefined && (
                            <span className={`text-xs shrink-0
                                ${rule.matches_count > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-400'}`}>
                                {rule.matches_count} совп.
                            </span>
                        )}

                        <span className="text-gray-300 dark:text-gray-600 text-xs">
                            {expanded[idx] ? '▲' : '▼'}
                        </span>
                    </div>

                    {/* Детали */}
                    {expanded[idx] && (
                        <div className="border-t border-gray-100 dark:border-gray-800
                                        px-3 py-3 space-y-3">
                            {/* Паттерн */}
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Паттерн (regex):</p>
                                <code className="text-xs font-mono bg-neutral-100
                                                 dark:bg-neutral-800 px-2 py-1 rounded
                                                 text-gray-900 dark:text-white block">
                                    {rule.pattern}
                                </code>
                            </div>

                            {/* Оси */}
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Привязывает оси:</p>
                                <div className="flex flex-wrap gap-1">
                                    {rule.axes.map((a, i) => (
                                        <span key={i}
                                            className="text-xs px-2 py-0.5 rounded
                                                       bg-neutral-100 dark:bg-neutral-800
                                                       text-gray-700 dark:text-gray-300">
                                            {a.axis_code} → #{a.value_id}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Совпадения */}
                            {rule.matches?.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">
                                        Совпадает с существующими ({rule.matches_count}):
                                    </p>
                                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                        {rule.matches.map((m, i) => (
                                            <p key={i}
                                                className="text-xs text-gray-600
                                                           dark:text-gray-400 font-mono">
                                                · {m}
                                            </p>
                                        ))}
                                        {rule.matches_count > rule.matches.length && (
                                            <p className="text-xs text-gray-400 italic">
                                                ...и ещё {rule.matches_count - rule.matches.length}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rule.pattern_error && (
                                <p className="text-xs text-red-500">
                                    Ошибка паттерна: {rule.pattern_error}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Итого */}
            <div className="text-xs text-gray-400 pt-1">
                Итого правил: {rules.length}
                {' · '}
                Серия: {rules.filter(r => r.type === 'series').length}
                {' · '}
                Длина: {rules.filter(r => r.type === 'length').length}
            </div>
        </div>
    );
}