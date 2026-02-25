import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tokenStorage } from '../api/auth';
import { sessionsApi } from '../api/sessions';

const API_BASE = '/api/v1/catalog';

export default function SpecEditorPage({
    productIds,
    sessionId,          // ← если есть — обновляем, если нет — создаём
    initialChanges,     // ← изменения из черновика
    onBack,
    onSessionSaved,     // ← callback с id созданной/обновлённой сессии
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState(null);
    const [changes, setChanges] = useState({});

    // Выделение диапазона
    // selection: { defId, startRow, endRow } | null
    const [selection, setSelection] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [draftSessionId, setDraftSessionId] = useState(sessionId || null);
    const [draftName, setDraftName] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const dragStart = useRef(null); // { defId, rowIdx }

    useEffect(() => {
        if (initialChanges && Object.keys(initialChanges).length > 0) {
            setChanges(initialChanges);
        }
    }, []);

    useEffect(() => {
        if (!productIds?.length) return;
        setLoading(true);
        setError(null);

        fetch(`${API_BASE}/products/specs-bulk/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({ product_ids: productIds }),
        })
            .then(r => r.json())
            .then(json => {
                if (json.success) setData(json.data);
                else setError(json.error || 'Ошибка загрузки');
            })
            .catch(() => setError('Ошибка сети'))
            .finally(() => setLoading(false));
    }, [productIds]);

    // Снять выделение по клику вне таблицы
    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest('table')) setSelection(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Paste: вставка в выделенные ячейки ───────────────────────────────────
    useEffect(() => {
        const handlePaste = (e) => {
            if (!selection || !data) return;

            e.preventDefault();
            const text = e.clipboardData.getData('text').trim();
            if (!text) return;

            const { defId, startRow, endRow } = selection;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);

            setChanges(prev => {
                const next = { ...prev };
                for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
                    const product = data.products[rowIdx];
                    const spec = product.specs[defId];
                    const key = `${product.id}:${defId}`;
                    next[key] = {
                        product_id: product.id,
                        definition_id: defId,
                        spec_id: spec?.spec_id ?? null,
                        value: text,
                    };
                }
                return next;
            });
            setSaveResult(null);
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [selection, data]);

    const handleCellChange = (productId, defId, specId, value) => {
        const key = `${productId}:${defId}`;
        setChanges(prev => ({
            ...prev,
            [key]: { product_id: productId, definition_id: defId, spec_id: specId, value },
        }));
        setSaveResult(null);
    };

    // ── Drag для выделения диапазона ─────────────────────────────────────────

    const handleMouseDown = (e, defId, rowIdx) => {
        if (e.button !== 0 || e.target.tagName === 'INPUT') return;
        e.preventDefault();
        // Снимаем фокус с любого активного input чтобы paste сработал
        document.activeElement?.blur();
        dragStart.current = { defId, rowIdx };
        setIsDragging(true);
        setSelection({ defId, startRow: rowIdx, endRow: rowIdx });
    };

    const handleMouseEnter = (defId, rowIdx) => {
        if (!isDragging || !dragStart.current) return;
        // Drag только в том же столбце
        if (dragStart.current.defId !== defId) return;
        setSelection({
            defId,
            startRow: dragStart.current.rowIdx,
            endRow: rowIdx,
        });
    };

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStart.current = null;
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseUp]);

    const isSelected = (defId, rowIdx) => {
        if (!selection || selection.defId !== defId) return false;
        const min = Math.min(selection.startRow, selection.endRow);
        const max = Math.max(selection.startRow, selection.endRow);
        return rowIdx >= min && rowIdx <= max;
    };

    // ── Сохранение ────────────────────────────────────────────────────────────

    const handleSaveDraft = async () => {
        if (!data) return;
        setSavingDraft(true);
        setDraftSaved(false);

        const sessionData = {
            page: 'spec-editor',
            product_type_id: data.product_type_id,
            product_ids: productIds,
            changes,
        };

        try {
            let result;
            if (draftSessionId) {
                // Обновляем существующую сессию
                result = await sessionsApi.update(draftSessionId, { data: sessionData });
            } else {
                // Создаём новую и сразу делаем активной
                const name = draftName.trim() || `Редактор ${new Date().toLocaleDateString('ru')}`;
                result = await sessionsApi.create('spec_editor', name, sessionData);
                if (result.id) {
                    await sessionsApi.activate(result.id);
                    setDraftSessionId(result.id);
                    onSessionSaved?.(result.id);
                }
            }
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 3000);
        } catch {
            // ошибка — покажем в UI
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSave = async () => {
        if (!Object.keys(changes).length) return;
        setSaving(true);
        setSaveResult(null);

        try {
            const res = await fetch(`${API_BASE}/products/specs-bulk-save/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenStorage.getAccess()}`,
                },
                body: JSON.stringify({
                    product_type_id: data.product_type_id,
                    changes: Object.values(changes),
                }),
            });
            const json = await res.json();
            if (json.success) {
                setSaveResult(json.data);
                setData(prev => {
                    const updated = { ...prev };
                    updated.products = prev.products.map(product => {
                        const newSpecs = { ...product.specs };
                        Object.values(changes).forEach(change => {
                            if (change.product_id !== product.id) return;
                            if (!change.value.trim()) return;
                            newSpecs[change.definition_id] = {
                                spec_id: change.spec_id || newSpecs[change.definition_id]?.spec_id,
                                value: change.value,
                                is_manual: true,
                            };
                        });
                        return { ...product, specs: newSpecs };
                    });
                    return updated;
                });
                setChanges({});
            } else {
                setSaveResult({ error: json.error });
            }
        } catch {
            setSaveResult({ error: 'Ошибка сети' });
        } finally {
            setSaving(false);
        }
    };

    const changesCount = Object.keys(changes).length;

    // ── Подсказка о выделении ─────────────────────────────────────────────────

    const selectionInfo = selection
        ? `Выделено: ${Math.abs(selection.endRow - selection.startRow) + 1} ячеек — скопируйте значение и нажмите Ctrl+V`
        : null;

    // ── Рендер ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 text-sm">
                Загрузка...
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <button onClick={onBack}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700
                     dark:hover:text-gray-300 mb-4">
                    ← Назад
                </button>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-600
                        dark:text-red-400 text-sm">
                    {error}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { definitions, products } = data;

    return (
        <div className="space-y-4" style={{ userSelect: 'none' }}>

            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack}
                        className="text-sm text-gray-500 dark:text-gray-400
                       hover:text-gray-700 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Редактор характеристик
                        </h1>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {products.length} изделий · {definitions.length} характеристик
                            {selectionInfo && (
                                <span className="ml-3 text-violet-500">{selectionInfo}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {saveResult && !saveResult.error && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            ✓ Сохранено: {saveResult.created} создано, {saveResult.updated} обновлено
                            {saveResult.skipped > 0 && `, ${saveResult.skipped} пропущено`}
                        </span>
                    )}
                    {saveResult?.error && (
                        <span className="text-xs text-red-500">{saveResult.error}</span>
                    )}

                    {/* Название черновика — только если сессия ещё не сохранена */}
                    {!draftSessionId && (
                        <input
                            type="text"
                            value={draftName}
                            onChange={e => setDraftName(e.target.value)}
                            placeholder="Название черновика..."
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                 focus:outline-none focus:ring-1 focus:ring-violet-500 w-48"
                        />
                    )}

                    <button
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
               bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white"
                    >
                        {savingDraft ? 'Сохраняю...' : draftSaved ? '✓ Черновик сохранён' : '💾 Сохранить черновик'}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!changesCount || saving}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
               bg-blue-600 hover:bg-blue-700 disabled:opacity-40
               text-white disabled:cursor-not-allowed"
                    >
                        {saving
                            ? 'Сохраняю...'
                            : `Сохранить всё${changesCount ? ` (${changesCount})` : ''}`
                        }
                    </button>
                </div>
            </div>

            {/* Таблица */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500
                             dark:text-gray-400 uppercase tracking-wide sticky left-0
                             bg-white dark:bg-gray-900 z-10 min-w-48">
                                Изделие
                            </th>
                            {definitions.map(def => (
                                <th key={def.id}
                                    className="text-left px-3 py-3 text-xs font-medium text-gray-500
                             dark:text-gray-400 uppercase tracking-wide
                             whitespace-nowrap min-w-36">
                                    {def.display_name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product, rowIdx) => (
                            <tr
                                key={product.id}
                                className={`border-b border-gray-100 dark:border-gray-800
                  ${rowIdx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                            >
                                {/* Название — липкая колонка */}
                                <td className="px-4 py-1.5 sticky left-0 z-10
                               bg-white dark:bg-gray-900
                               text-gray-900 dark:text-white font-medium text-sm
                               border-r border-gray-100 dark:border-gray-800">
                                    {product.name}
                                </td>

                                {/* Ячейки характеристик */}
                                {definitions.map(def => {
                                    const key = `${product.id}:${def.id}`;
                                    const spec = product.specs[def.id];
                                    const changed = changes[key];
                                    const currentValue = changed !== undefined
                                        ? changed.value
                                        : (spec?.value ?? '');
                                    const isDirty = changed !== undefined
                                        && changed.value !== (spec?.value ?? '');
                                    const selected = isSelected(def.id, rowIdx);

                                    return (
                                        <td
                                            key={def.id}
                                            className={`px-3 py-1 transition-colors
                        ${selected ? 'bg-violet-100 dark:bg-violet-900/30' : ''}
                      `}
                                            onMouseDown={e => handleMouseDown(e, def.id, rowIdx)}
                                            onMouseEnter={() => handleMouseEnter(def.id, rowIdx)}
                                        >
                                            <input
                                                type="text"
                                                value={currentValue}
                                                onChange={e => handleCellChange(
                                                    product.id,
                                                    def.id,
                                                    spec?.spec_id ?? null,
                                                    e.target.value,
                                                )}
                                                onFocus={() => setSelection(null)}
                                                className={`
                          w-full px-2 py-1 text-sm rounded border transition-colors
                          focus:outline-none focus:ring-1 focus:ring-blue-500
                          bg-transparent
                          text-gray-900 dark:text-white
                          ${isDirty
                                                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-gray-200 dark:border-gray-700'
                                                    }
                        `}
                                                placeholder="—"
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}