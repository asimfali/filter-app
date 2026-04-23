import React, { useState, useEffect } from 'react';
import { bomApi } from '../../api/bom';
import { inputCls } from '../../utils/styles';

export default function UnitWeightModal({ onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [edits, setEdits] = useState({}); // { id: unit_weight }
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            const { ok, data } = await bomApi.searchPartsUnitWeight(query);
            if (ok && data.success) setResults(data.data);
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const handleChange = (id, value) => {
        setEdits(e => ({ ...e, [id]: value }));
        setSaved(false);
    };

    const handleSave = async () => {
        const items = Object.entries(edits).map(([id, unit_weight]) => ({
            id: parseInt(id),
            unit_weight: unit_weight === '' ? null : parseFloat(unit_weight),
        }));
        if (!items.length) return;

        setSaving(true);
        const { ok, data } = await bomApi.savePartsUnitWeight(items);
        if (ok && data.success) {
            setSaved(true);
            setEdits({});
            // Обновляем значения в results
            setResults(r => r.map(p =>
                edits[p.id] !== undefined
                    ? { ...p, unit_weight: edits[p.id] || null }
                    : p
            ));
        }
        setSaving(false);
    };

    const dirty = Object.keys(edits).length > 0;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-2xl
                            max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Масса единицы номенклатуры
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Используется для пересчёта шт → кг при загрузке в 1С
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">
                        ✕
                    </button>
                </div>

                {/* Поиск */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Введите 2+ символа для поиска..."
                        autoFocus
                        className={inputCls}
                    />
                    {searching && (
                        <p className="text-xs text-gray-400 mt-1">Поиск...</p>
                    )}
                </div>

                {/* Таблица */}
                <div className="flex-1 overflow-y-auto">
                    {results.length === 0 && query.length >= 2 && !searching ? (
                        <p className="text-sm text-gray-400 text-center py-8">Ничего не найдено</p>
                    ) : results.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">
                            Введите название для поиска
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                                <tr className="text-xs text-gray-400 uppercase border-b
                                               border-gray-100 dark:border-gray-800">
                                    <th className="text-left px-5 py-2">Наименование</th>
                                    <th className="text-left px-3 py-2 w-20">Ед. 1С</th>
                                    <th className="text-left px-3 py-2 w-36">Масса ед., кг</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(p => (
                                    <tr key={p.id}
                                        className="border-b border-gray-50 dark:border-gray-800
                                                   hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                        <td className="px-5 py-2 text-gray-800 dark:text-gray-200">
                                            {p.onec_name}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 text-xs">
                                            {p.base_unit || p.unit || '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.000001"
                                                value={edits[p.id] !== undefined
                                                    ? edits[p.id]
                                                    : (p.unit_weight || '')}
                                                onChange={e => handleChange(p.id, e.target.value)}
                                                placeholder="0.000000"
                                                className={inputCls}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Футер */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800
                                flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-400">
                        {results.length > 0 && `Найдено: ${results.length}`}
                        {saved && (
                            <span className="text-emerald-500 ml-3">✓ Сохранено</span>
                        )}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-1.5 text-sm border border-gray-200
                                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                                       rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                            Закрыть
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600
                                       hover:bg-blue-700 text-white disabled:opacity-50
                                       transition-colors">
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}