import React, { useState } from 'react';
import { bomApi } from '../../api/bom';
import { inputCls } from '../../utils/styles';

export default function CreateSpecModal({ onClose, onCreated }) {
    const [partSearch, setPartSearch] = useState('');
    const [partResults, setPartResults] = useState([]);
    const [selectedPart, setSelectedPart] = useState(null);
    const [specName, setSpecName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePartSearch = async (q) => {
        setPartSearch(q);
        setSelectedPart(null);
        if (q.length < 2) { setPartResults([]); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10 });
        if (ok && data.success) setPartResults(data.data);
    };

    const handlePartSelect = (part) => {
        setSelectedPart(part);
        setPartSearch(part.onec_name);
        setSpecName(`${part.onec_name}(Сборка)`);
        setPartResults([]);
    };

    const handleCreate = async () => {
        if (!partSearch.trim()) { setError('Укажите изделие'); return; }
        if (!specName.trim()) { setError('Укажите название спецификации'); return; }
        setLoading(true);
        setError('');

        // Если не выбрали из списка — создаём Part локально
        let partId = selectedPart?.id;
        if (!partId) {
            const { ok, data } = await bomApi.createPart({
                onec_name: partSearch.trim(),
                is_assembly: true,
                unit: 'шт.',
            });
            if (ok && data.success) {
                partId = data.data.id;
            } else {
                setError(data.error || 'Ошибка создания изделия');
                setLoading(false);
                return;
            }
        }

        const { ok, data } = await bomApi.createSpec({
            part: partId,
            onec_name: specName.trim(),
            stage_name: 'Сборка',
            process_type: 'Сборка',
            date_from: new Date().toISOString().slice(0, 10),
            quantity: 1,
        });
        if (ok && data.success) {
            onCreated(data.data);
        } else {
            setError(data.error?.onec_name?.[0] || data.error || 'Ошибка создания');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Новая спецификация
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Поиск изделия */}
                <div className="relative">
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-1">
                        Изделие (номенклатура 1С)
                    </label>
                    <input
                        value={partSearch}
                        onChange={e => handlePartSearch(e.target.value)}
                        placeholder="Начните вводить название..."
                        className="w-full px-3 py-1.5 text-sm rounded-lg
                                   bg-neutral-50 dark:bg-neutral-800
                                   border border-gray-200 dark:border-gray-700
                                   text-gray-900 dark:text-white
                                   focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                    {partResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50
                                        bg-white dark:bg-neutral-900
                                        border border-gray-200 dark:border-gray-700
                                        rounded-lg shadow-lg mt-0.5
                                        max-h-48 overflow-y-auto">
                            {partResults.map(part => (
                                <button key={part.id}
                                    onClick={() => handlePartSelect(part)}
                                    className="w-full text-left px-3 py-2 text-xs
                                               hover:bg-neutral-50 dark:hover:bg-neutral-800
                                               border-b border-gray-50 last:border-0">
                                    <div className="text-gray-900 dark:text-white">
                                        {part.onec_name}
                                    </div>
                                    {part.sku && (
                                        <div className="text-gray-400 text-[10px]">{part.sku}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Название спецификации */}
                <div>
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-1">
                        Название спецификации
                    </label>
                    <input
                        value={specName}
                        onChange={e => setSpecName(e.target.value)}
                        placeholder="КЭВ-45П5033Е(Сборка)"
                        className="w-full px-3 py-1.5 text-sm rounded-lg
                                   bg-neutral-50 dark:bg-neutral-800
                                   border border-gray-200 dark:border-gray-700
                                   text-gray-900 dark:text-white
                                   focus:outline-none focus:border-blue-500"
                    />
                </div>

                {error && (
                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Отмена
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || !specName.trim() || !partSearch.trim()}
                        className="px-4 py-2 text-sm rounded-lg
                                   bg-emerald-600 hover:bg-emerald-700
                                   text-white disabled:opacity-50 transition-colors">
                        {loading ? 'Создание...' : 'Создать'}
                    </button>
                </div>
            </div>
        </div>
    );
}