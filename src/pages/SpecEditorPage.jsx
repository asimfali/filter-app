import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tokenStorage } from '../api/auth';
import { sessionsApi } from '../api/sessions';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../utils/permissions';
import { catalogApi } from '../api/catalog';
import { IconSave } from '../components/common/Icons';

const API_BASE = '/api/v1/catalog';

export default function SpecEditorPage({
    productIds,
    sessionId,          // ← если есть — обновляем, если нет — создаём
    initialChanges,     // ← изменения из черновика
    onBack,
    onReset,
    onSessionSaved,     // ← callback с id созданной/обновлённой сессии
}) {
    const { user } = useAuth();
    const canPushTo1C = can(user, 'catalog.push_to_1c');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState(null);
    const [changes, setChanges] = useState({});
    const [pushing, setPushing] = useState(false);
    const [pushResult, setPushResult] = useState(null);
    const [pushTaskId, setPushTaskId] = useState(null);

    // Выделение диапазона
    // selection: { defId, startRow, endRow } | null
    const [selection, setSelection] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [draftSessionId, setDraftSessionId] = useState(sessionId || null);
    const [draftName, setDraftName] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const dragStart = useRef(null); // { defId, rowIdx }
    const anchorCell = useRef(null); // { defId, rowIdx } — точка отсчёта для Shift

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
            if (!e.target.closest('table')) setSelection([]);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Paste: вставка в выделенные ячейки ───────────────────────────────────
    useEffect(() => {
        const handlePaste = (e) => {
            if (!selection.length || !data) return;
    
            e.preventDefault();
            const text = e.clipboardData.getData('text').trim();
            if (!text) return;
    
            setChanges(prev => {
                const next = { ...prev };
                selection.forEach(({ defId, rowIdx }) => {
                    const product = data.products[rowIdx];
                    const spec = product.specs[defId];
                    const key = `${product.id}:${defId}`;
                    next[key] = {
                        product_id: product.id,
                        definition_id: defId,
                        spec_id: spec?.spec_id ?? null,
                        value: text,
                    };
                });
                return next;
            });
            setSaveResult(null);
        };
    
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [selection, data]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selection.length || !data) return;
            // Не перехватываем если фокус в input
            if (document.activeElement?.tagName === 'INPUT') return;
    
            const { defId, startRow, endRow } = selection;
            const defIdx = definitions.indexOf(definitions.find(d => d.id === defId));
            const currentEnd = endRow;
            const rowCount = data.products.length;
            const defCount = definitions.length;
    
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+↓ — расширяем вниз
                    setSelection(prev => ({
                        ...prev,
                        endRow: Math.min(currentEnd + 1, rowCount - 1),
                    }));
                } else {
                    // ↓ — перемещаем курсор
                    const next = Math.min(currentEnd + 1, rowCount - 1);
                    anchorCell.current = { defId, rowIdx: next };
                    setSelection({ defId, startRow: next, endRow: next });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (e.shiftKey) {
                    setSelection(prev => ({
                        ...prev,
                        endRow: Math.max(currentEnd - 1, 0),
                    }));
                } else {
                    const next = Math.max(currentEnd - 1, 0);
                    anchorCell.current = { defId, rowIdx: next };
                    setSelection({ defId, startRow: next, endRow: next });
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (defIdx < defCount - 1) {
                    const nextDef = definitions[defIdx + 1];
                    const row = e.shiftKey ? endRow : Math.min(startRow, endRow);
                    anchorCell.current = { defId: nextDef.id, rowIdx: row };
                    setSelection({ defId: nextDef.id, startRow: row, endRow: row });
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (defIdx > 0) {
                    const nextDef = definitions[defIdx - 1];
                    const row = Math.min(startRow, endRow);
                    anchorCell.current = { defId: nextDef.id, rowIdx: row };
                    setSelection({ defId: nextDef.id, startRow: row, endRow: row });
                }
            } else if (e.key === 'Escape') {
                setSelection(null);
                anchorCell.current = null;
            }
        };
    
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selection, data]);

    // Опрос статуса задачи
    useEffect(() => {
        if (!pushTaskId) return;

        const interval = setInterval(async () => {
            const { ok, data } = await catalogApi.taskStatus(pushTaskId);
            if (!ok || !data.success) return;

            if (data.data.ready) {
                clearInterval(interval);
                setPushTaskId(null);
                setPushing(false);
                const result = data.data.result;
                setPushResult({
                    ok: result.success,
                    message: result.success
                        ? `✓ Выгружено ${result.pushed} из ${result.total} товаров${result.errors?.length ? `, ошибок: ${result.errors.length}` : ''}`
                        : `✗ Ошибка: ${result.error}`,
                });
                setTimeout(() => setPushResult(null), 5000);
            } else if (data.data.status === 'FAILURE') {
                clearInterval(interval);
                setPushTaskId(null);
                setPushing(false);
                setPushResult({ ok: false, message: '✗ Задача завершилась с ошибкой' });
                setTimeout(() => setPushResult(null), 5000);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [pushTaskId]);


    const handlePushTo1C = async () => {
        if (!confirm(
            `Отправить характеристики ${products.length} товаров в 1С?\n\n` +
            `Это обновит дополнительные реквизиты номенклатуры. Действие нельзя отменить.`
        )) return;

        setPushing(true);
        setPushResult(null);

        try {
            const res = await fetch(`${API_BASE}/products/push-to-1c/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenStorage.getAccess()}`,
                },
                body: JSON.stringify({ product_ids: productIds }),
            });
            const json = await res.json();
            if (json.success) {
                setPushTaskId(json.data.task_id);  // ← запускаем опрос
                setPushResult({
                    ok: true,
                    message: ` Выгрузка запущена (${json.data.total} товаров)...`,
                });
            } else {
                setPushing(false);
                setPushResult({ ok: false, message: json.error || 'Ошибка' });
            }
        } catch {
            setPushing(false);
            setPushResult({ ok: false, message: 'Ошибка сети' });
        }
    };

    const handleCellChange = (productId, defId, specId, value) => {
        const key = `${productId}:${defId}`;
        setChanges(prev => ({
            ...prev,
            [key]: { product_id: productId, definition_id: defId, spec_id: specId, value },
        }));
        setSaveResult(null);
    };

    const handleReset = async () => {
        if (!confirm('Сбросить сессию и выйти из редактора?')) return;
        if (draftSessionId) {
            await sessionsApi.remove(draftSessionId);
        }
        onBack();
    };

    // ── Drag для выделения диапазона ─────────────────────────────────────────

    const handleMouseDown = (e, defId, rowIdx) => {
        if (e.button !== 0 || e.target.tagName === 'INPUT') return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        document.activeElement?.blur();
    
        anchorCell.current = { defId, rowIdx };
        dragStart.current = { defId, rowIdx };
        setIsDragging(true);
        setSelection([{ defId, rowIdx }]);
    };

    const handleMouseEnter = (defId, rowIdx) => {
        if (!isDragging || !dragStart.current) return;
        if (dragStart.current.defId !== defId) return;
    
        const min = Math.min(dragStart.current.rowIdx, rowIdx);
        const max = Math.max(dragStart.current.rowIdx, rowIdx);
        const cells = [];
        for (let i = min; i <= max; i++) {
            cells.push({ defId, rowIdx: i });
        }
        setSelection(cells);
    };

    const handleCellClick = (e, defId, rowIdx) => {
        if (e.target.tagName === 'INPUT') return;
    
        if (e.shiftKey && anchorCell.current && anchorCell.current.defId === defId) {
            // Shift — диапазон от anchor до текущей в той же колонке
            const min = Math.min(anchorCell.current.rowIdx, rowIdx);
            const max = Math.max(anchorCell.current.rowIdx, rowIdx);
            const cells = [];
            for (let i = min; i <= max; i++) {
                cells.push({ defId, rowIdx: i });
            }
            setSelection(cells);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl — добавляем/убираем одну ячейку
            anchorCell.current = { defId, rowIdx };
            setSelection(prev => {
                const exists = prev.some(s => s.defId === defId && s.rowIdx === rowIdx);
                if (exists) return prev.filter(s => !(s.defId === defId && s.rowIdx === rowIdx));
                return [...prev, { defId, rowIdx }];
            });
        }
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
        return selection.some(s => s.defId === defId && s.rowIdx === rowIdx);
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
        ? `Выделено: ${selection.length} ячеек — скопируйте значение и нажмите Ctrl+V`
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
                    {draftSessionId && (
                        <button
                            onClick={handleReset}
                            className="text-sm text-red-400 hover:text-red-600
                   dark:text-red-500 dark:hover:text-red-400 transition-colors">
                            ✕ Сбросить сессию
                        </button>
                    )}
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
                 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                 focus:outline-none focus:ring-1 focus:ring-violet-500 w-48"
                        />
                    )}

                    <button
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
               bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white"
                    >
                        {savingDraft ? 'Сохраняю...' : draftSaved ? '✓ Черновик сохранён' : <><IconSave className="w-4 h-4 inline mr-1" />Сохранить черновик</>}
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
                    {canPushTo1C && (
                        <button
                            onClick={handlePushTo1C}
                            disabled={pushing}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
               bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white"
                        >
                            {pushing ? 'Отправка...' : '📤 Выгрузить в 1С'}
                        </button>
                    )}
                    {pushResult && (
                        <span className={`text-xs ${pushResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pushResult.message}
                        </span>
                    )}
                </div>
            </div>

            {/* Таблица */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500
                             dark:text-gray-400 uppercase tracking-wide sticky left-0
                             bg-white dark:bg-neutral-900 z-10 min-w-48">
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
                  ${rowIdx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-800/30'}`}
                            >
                                {/* Название — липкая колонка */}
                                <td className="px-4 py-1.5 sticky left-0 z-10
                               bg-white dark:bg-neutral-900
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
                                            onClick={e => handleCellClick(e, def.id, rowIdx)}
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
                                                onFocus={() => setSelection([])}
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