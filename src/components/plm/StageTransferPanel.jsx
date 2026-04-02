import React, { useState, useEffect } from 'react';
import { plmApi } from '../../api/plm';

/**
 * Панель переноса характеристик стадии в серийные.
 *
 * Props:
 *   stage      — { id, litera_code, product_id, ... }
 *   onDone     — callback после переноса
 *   onClose    — закрыть панель
 */
export default function StageTransferPanel({ stage, onDone, onClose }) {
    const [specs, setSpecs] = useState([]);       // характеристики стадии
    const [serialSpecs, setSerialSpecs] = useState({}); // серийные: def_id → value
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!stage?.id) return;
        setLoading(true);

        Promise.all([
            // Характеристики стадии
            plmApi.getProductSpecs(stage.product_id, stage.id),
            // Серийные (без стадии) — для сравнения
            plmApi.getProductSpecs(stage.product_id, null),
        ])
            .then(([stageRes, serialRes]) => {
                if (stageRes.ok && stageRes.data.success) {
                    setSpecs(stageRes.data.data);
                    // Выбрать все по умолчанию
                    setSelected(new Set(stageRes.data.data.map(s => s.id)));
                }
                if (serialRes.ok && serialRes.data.success) {
                    const map = {};
                    serialRes.data.data.forEach(s => { map[s.definition_id] = s.value; });
                    setSerialSpecs(map);
                }
            })
            .catch(() => setError('Ошибка загрузки'))
            .finally(() => setLoading(false));
    }, [stage?.id]);

    const toggleAll = () => {
        if (selected.size === specs.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(specs.map(s => s.id)));
        }
    };

    const toggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleTransfer = async () => {
        if (!selected.size) return;
        setSaving(true);
        setError(null);

        const { ok, data } = await plmApi.transferSpecs(stage.id, [...selected]);
        setSaving(false);

        if (ok && data.success) {
            onDone?.(data.data.transferred);
        } else {
            setError(data.error || 'Ошибка переноса');
        }
    };

    if (loading) return (
        <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
            Загрузка характеристик...
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Заголовок */}
            <div className="flex items-center justify-between px-4 py-3
                            border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        Перенос в серийные
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        Лит.{stage.litera_code} → серийные (без литеры)
                    </div>
                </div>
                <button onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">
                    ×
                </button>
            </div>

            {/* Список характеристик */}
            <div className="flex-1 overflow-y-auto">
                {specs.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-gray-400 text-center">
                        Нет характеристик в этой стадии
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800/60">
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="w-8 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.size === specs.length}
                                        onChange={toggleAll}
                                        className="rounded"
                                    />
                                </th>
                                <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium">
                                    Характеристика
                                </th>
                                <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium">
                                    Значение стадии
                                </th>
                                <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium">
                                    Серийное
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {specs.map(spec => {
                                const serialVal = serialSpecs[spec.definition_id];
                                const willOverwrite = !!serialVal && serialVal !== spec.value;
                                return (
                                    <tr key={spec.id}
                                        onClick={() => toggle(spec.id)}
                                        className={`border-b border-gray-100 dark:border-gray-800
                                                    cursor-pointer transition-colors
                                                    hover:bg-neutral-50 dark:hover:bg-neutral-800/40
                                                    ${selected.has(spec.id)
                                                ? 'bg-violet-50/40 dark:bg-violet-900/10'
                                                : ''}`}>
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(spec.id)}
                                                onChange={() => toggle(spec.id)}
                                                onClick={e => e.stopPropagation()}
                                                className="rounded"
                                            />
                                        </td>
                                        <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                            {spec.definition_name}
                                        </td>
                                        <td className="px-2 py-2 font-medium text-violet-600 dark:text-violet-400">
                                            {spec.value}
                                        </td>
                                        <td className="px-2 py-2">
                                            {serialVal ? (
                                                <span className={willOverwrite
                                                    ? 'text-amber-500 dark:text-amber-400'
                                                    : 'text-gray-400 dark:text-gray-500'}>
                                                    {serialVal}
                                                    {willOverwrite && (
                                                        <span className="ml-1 text-[10px]">→ перезапись</span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600 text-xs">
                                                    нет
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Футер */}
            <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {error && (
                    <div className="text-xs text-red-500 dark:text-red-400">{error}</div>
                )}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">
                        Выбрано: {selected.size} из {specs.length}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-3 py-1.5 text-xs rounded-lg
                                       text-gray-600 dark:text-gray-400
                                       hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                            Отмена
                        </button>
                        <button
                            onClick={handleTransfer}
                            disabled={!selected.size || saving}
                            className="px-4 py-1.5 text-xs font-medium rounded-lg
                                       bg-violet-600 hover:bg-violet-700 text-white
                                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {saving ? 'Перенос...' : `Перенести ${selected.size}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}