import React, { useState, useEffect } from 'react';
import { bomApi } from '../../api/bom';

export default function FuzzyMergeModal({ material, onClose, onMerged }) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [merging, setMerging] = useState(false);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        bomApi.fuzzySearchPart(material.part_name)
            .then(({ ok, data }) => {
                if (ok && data.success) setResults(data.data);
                else setError('Ошибка поиска');
            })
            .finally(() => setLoading(false));
    }, [material.part_name]);

    const handleMerge = async () => {
        if (!selected) return;
        setMerging(true);
        setError('');
        const { ok, data } = await bomApi.mergeSpecMaterial(material.id, selected.id);
        if (ok && data.success) {
            onMerged(data.data);
        } else {
            setError(data.error || 'Ошибка замены');
            setMerging(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-lg p-6 space-y-4">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Уточните номенклатуру
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Исходное имя:{' '}
                        <span className="font-mono text-amber-600">{material.part_name}</span>
                    </p>
                </div>

                <div className="space-y-1 max-h-72 overflow-y-auto">
                    {loading && (
                        <p className="text-sm text-gray-400 text-center py-4">Поиск похожих...</p>
                    )}
                    {!loading && results.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">Похожих не найдено</p>
                    )}
                    {results.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setSelected(r)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm
                                transition-colors border
                                ${selected?.id === r.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                }`}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-gray-900 dark:text-white truncate">
                                    {r.onec_name}
                                </span>
                                <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded
                                    ${r.score >= 95
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : r.score >= 85
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-neutral-800'
                                    }`}>
                                    {r.score}%
                                </span>
                            </div>
                            {r.folder && (
                                <span className="text-xs text-gray-400 truncate block mt-0.5">
                                    {r.folder}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                        Отмена
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={!selected || merging}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700
                                   text-white disabled:opacity-50 transition-colors">
                        {merging ? 'Замена...' : 'Выбрать'}
                    </button>
                </div>
            </div>
        </div>
    );
}