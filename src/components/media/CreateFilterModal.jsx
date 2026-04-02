import React, { useState, useEffect } from 'react';
import { mediaApi } from '../../api/media';

export default function CreateFilterModal({ docId, axes, currentFilterIds = [], onCreated, onClose }) {
    const [mode, setMode] = useState('existing'); // 'existing' | 'new'

    // ── Режим "существующие" ──────────────────────────────────────────────
    const [allFilters, setAllFilters] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(true);
    const [attaching, setAttaching] = useState(null); // id фильтра который привязываем

    // ── Режим "новый" ─────────────────────────────────────────────────────
    const [step, setStep] = useState('axis');
    const [selectedAxisId, setSelectedAxisId] = useState(null);
    const [selectedAxisName, setSelectedAxisName] = useState('');
    const [values, setValues] = useState([]);
    const [selectedValueIds, setSelectedValueIds] = useState([]);
    const [loadingValues, setLoadingValues] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Загружаем все существующие фильтры при открытии
    useEffect(() => {
        mediaApi.getFilters()
            .then(({ ok, data }) => {
                if (ok) setAllFilters(data.filters || []);
            })
            .finally(() => setLoadingFilters(false));
    }, []);

    // Загружаем значения оси при выборе (режим "новый")
    useEffect(() => {
        if (!selectedAxisId) return;
        setLoadingValues(true);
        setSelectedValueIds([]);
        setError('');
        mediaApi.getAxisValues(selectedAxisId)
            .then(({ ok, data }) => {
                if (ok) setValues(data.values || []);
                else setError('Ошибка загрузки значений');
            })
            .finally(() => setLoadingValues(false));
    }, [selectedAxisId]);

    // ── Handlers: существующие ────────────────────────────────────────────

    const handleAttachExisting = async (filterId) => {
        setAttaching(filterId);
        setError('');
        const { ok, data } = await mediaApi.addFilterToDocument(docId, filterId);
        if (ok && data.success) {
            // Находим фильтр в списке и передаём наверх
            const filter = allFilters.find(f => f.id === filterId);
            onCreated(filter);
        } else {
            setError(data.error || 'Ошибка привязки');
            setAttaching(null);
        }
    };

    // ── Handlers: новый ───────────────────────────────────────────────────

    const handleAxisSelect = (axis) => {
        setSelectedAxisId(axis.id);
        setSelectedAxisName(axis.name);
        setStep('values');
    };

    const toggleValue = (id) => {
        setSelectedValueIds(prev =>
            prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
        );
    };

    const handleCreate = async () => {
        if (!selectedValueIds.length) return;
        setSaving(true);
        setError('');
        try {
            const { ok: ok1, data: d1 } = await mediaApi.createFilter(selectedAxisId, selectedValueIds);
            if (!ok1 || !d1.success) { setError(d1.error || 'Ошибка создания'); return; }

            const { ok: ok2, data: d2 } = await mediaApi.addFilterToDocument(docId, d1.filter.id);
            if (!ok2 || !d2.success) { setError(d2.error || 'Ошибка привязки'); return; }

            onCreated(d1.filter);
        } finally {
            setSaving(false);
        }
    };

    const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

    // ── Группировка существующих фильтров по оси ─────────────────────────

    const filtersByAxis = allFilters.reduce((acc, f) => {
        const key = f.axis.name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(f);
        return acc;
    }, {});

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 backdrop-blur-sm"
            onClick={handleBackdrop}
        >
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md
                            mx-4 flex flex-col max-h-[80vh]">

                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Добавить фильтр
                        </h3>
                        {mode === 'new' && step === 'values' && (
                            <p className="text-xs text-gray-400 mt-0.5">{selectedAxisName}</p>
                        )}
                    </div>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                                   transition-colors text-lg leading-none">
                        ×
                    </button>
                </div>

                {/* Переключатель режимов */}
                <div className="px-5 pt-3 shrink-0">
                    <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setMode('existing')}
                            className={`px-3 py-1.5 rounded text-xs transition-colors ${
                                mode === 'existing'
                                    ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}>
                            Выбрать существующий
                        </button>
                        <button
                            onClick={() => { setMode('new'); setStep('axis'); setSelectedAxisId(null); }}
                            className={`px-3 py-1.5 rounded text-xs transition-colors ${
                                mode === 'new'
                                    ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}>
                            + Создать новый
                        </button>
                    </div>
                </div>

                {/* Тело — скроллируемое */}
                <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">

                    {/* ── Режим: существующие ── */}
                    {mode === 'existing' && (
                        <>
                            {loadingFilters ? (
                                <p className="text-sm text-gray-400 text-center py-6">Загрузка...</p>
                            ) : allFilters.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-6">
                                    Нет созданных фильтров.{' '}
                                    <button
                                        onClick={() => setMode('new')}
                                        className="text-blue-500 hover:text-blue-600">
                                        Создать первый
                                    </button>
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(filtersByAxis).map(([axisName, filters]) => (
                                        <div key={axisName}>
                                            <div className="text-xs text-gray-400 dark:text-gray-500
                                                            uppercase tracking-wide mb-2">
                                                {axisName}
                                            </div>
                                            <div className="space-y-1">
                                                {filters.map(f => {
                                                    const alreadyAttached = currentFilterIds.includes(f.id);
                                                    const isAttaching = attaching === f.id;
                                                    return (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => !alreadyAttached && handleAttachExisting(f.id)}
                                                            disabled={alreadyAttached || isAttaching}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm
                                                                        border transition-colors
                                                                ${alreadyAttached
                                                                    ? 'border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-default'
                                                                    : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-950'
                                                                }`}
                                                        >
                                                            <span className="font-mono">
                                                                [{f.values.map(v => v.value).join(', ')}]
                                                            </span>
                                                            {alreadyAttached && (
                                                                <span className="ml-2 text-xs text-gray-400">
                                                                    уже добавлен
                                                                </span>
                                                            )}
                                                            {isAttaching && (
                                                                <span className="ml-2 text-xs text-blue-400">
                                                                    ···
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Режим: новый — шаг 1: ось ── */}
                    {mode === 'new' && step === 'axis' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                Выберите ось параметра
                            </p>
                            {axes.map(axis => (
                                <button
                                    key={axis.id}
                                    onClick={() => handleAxisSelect(axis)}
                                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm
                                               border border-gray-200 dark:border-gray-700
                                               hover:border-blue-400 hover:bg-blue-50
                                               dark:hover:border-blue-600 dark:hover:bg-blue-950
                                               text-gray-800 dark:text-gray-200 transition-colors"
                                >
                                    {axis.name}
                                    <span className="ml-2 text-xs text-gray-400">
                                        {axis['product_type__name']}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Режим: новый — шаг 2: значения ── */}
                    {mode === 'new' && step === 'values' && (
                        <div>
                            <button
                                onClick={() => { setStep('axis'); setSelectedAxisId(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600
                                           dark:hover:text-gray-300 mb-3 transition-colors">
                                ← Назад
                            </button>
                            {loadingValues ? (
                                <p className="text-sm text-gray-400 text-center py-6">Загрузка...</p>
                            ) : (
                                <>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        Выберите значения
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {values.map(v => {
                                            const selected = selectedValueIds.includes(v.id);
                                            return (
                                                <button
                                                    key={v.id}
                                                    onClick={() => toggleValue(v.id)}
                                                    className={`px-3 py-1.5 rounded-full text-sm
                                                                font-medium transition-all
                                                        ${selected
                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                            : 'bg-neutral-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                                        }`}>
                                                    {v.value}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {selectedValueIds.length > 0 && (
                                        <p className="text-xs text-blue-500 mt-3">
                                            Выбрано: {selectedValueIds.length}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-500 mt-3">{error}</p>
                    )}
                </div>

                {/* Футер — только для режима "новый", шаг "значения" */}
                {mode === 'new' && step === 'values' && !loadingValues && (
                    <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700
                                    flex justify-end gap-2 shrink-0">
                        <button onClick={onClose}
                            className="text-sm text-gray-500 hover:text-gray-700
                                       dark:hover:text-gray-300 px-3 py-2 transition-colors">
                            Отмена
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!selectedValueIds.length || saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white text-sm font-medium px-4 py-2
                                       rounded-lg transition-colors">
                            {saving ? 'Создание...' : 'Создать фильтр'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}