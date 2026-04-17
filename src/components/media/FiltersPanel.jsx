import React, { useState } from 'react';
import { mediaApi } from '../../api/media';
import CreateFilterModal from './CreateFilterModal';

function FiltersPanel({ entityId, entityType, initialFilters = [], axes, canWrite }) {
    // entityType: 'document' | 'heat-exchanger'
    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState(initialFilters);
    const [removingId, setRemovingId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleRemove = async (filterId) => {
        setRemovingId(filterId);
        const fn = entityType === 'heat-exchanger'
            ? mediaApi.removeFilterFromHeatExchanger(entityId, filterId)
            : mediaApi.removeFilterFromDocument(entityId, filterId);
        const { ok } = await fn;
        if (ok) setFilters(prev => prev.filter(f => f.id !== filterId));
        setRemovingId(null);
    };

    const handleFilterCreated = (newFilter) => {
        setFilters(prev => [...prev, newFilter]);
        setShowCreateModal(false);
    };

    return (
        <>
            {/* Кликабельный заголовок с тегами — встраивается в шапку карточки */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 min-w-0 text-left group"
                title="Управление фильтрами"
            >
                <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform
                                 ${open ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {filters.length === 0 ? (
                    <span className="text-sm text-gray-400 italic
                                     group-hover:text-gray-600 dark:group-hover:text-gray-300
                                     transition-colors">
                        Фильтры не заданы
                    </span>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {filters.map(f => (
                            <span key={f.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5
                                           bg-blue-50 dark:bg-blue-950
                                           border border-blue-200 dark:border-blue-800
                                           rounded-full text-xs text-blue-700 dark:text-blue-300">
                                <span className="opacity-60">{f.axis.name}:</span>
                                {f.values.map(v => v.value).join(', ')}
                            </span>
                        ))}
                    </div>
                )}
            </button>

            {/* Раскрывающаяся панель */}
            {open && (
                <div className="px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50
                                border-b border-gray-100 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide mb-2">
                        {entityType === 'heat-exchanger'
                            ? 'Привязка к изделиям по осям'
                            : 'Фильтры документа'}
                    </div>

                    {filters.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                            {entityType === 'heat-exchanger'
                                ? 'Без фильтров теплообменник не привязан ни к одному изделию'
                                : 'Документ без фильтров не показывается в карточке товара'}
                        </p>
                    ) : (
                        <div className="space-y-1.5 mb-2">
                            {filters.map(f => (
                                <div key={f.id}
                                    className="flex items-center justify-between px-3 py-1.5
                                               rounded-lg bg-white dark:bg-neutral-900
                                               border border-gray-200 dark:border-gray-700">
                                    <div className="text-xs">
                                        <span className="text-gray-400 dark:text-gray-500">
                                            {f.axis.name}
                                        </span>
                                        <span className="mx-1.5 text-gray-300">∈</span>
                                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                                            [{f.values.map(v => v.value).join(', ')}]
                                        </span>
                                    </div>
                                    {canWrite && (
                                        <button
                                            onClick={() => handleRemove(f.id)}
                                            disabled={removingId === f.id}
                                            className="text-gray-300 hover:text-red-500
                                                       transition-colors ml-3 text-xs
                                                       disabled:opacity-50">
                                            {removingId === f.id ? '···' : '×'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {canWrite && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-xs text-blue-600 hover:text-blue-700
                                       dark:text-blue-400 dark:hover:text-blue-300
                                       transition-colors">
                            + Добавить фильтр
                        </button>
                    )}
                </div>
            )}

            {showCreateModal && (
                <CreateFilterModal
                    docId={entityType === 'document' ? entityId : undefined}
                    heId={entityType === 'heat-exchanger' ? entityId : undefined}
                    axes={axes}
                    currentFilterIds={filters.map(f => f.id)}
                    onCreated={handleFilterCreated}
                    onClose={() => setShowCreateModal(false)}
                />
            )}
        </>
    );
}

export default FiltersPanel;