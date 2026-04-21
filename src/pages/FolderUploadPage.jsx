// src/pages/FolderUploadPage.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { mediaApi } from '../api/media';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../utils/permissions';
import { filterLatestPassports } from '../utils/filterLatestPassports';

function buildDocumentName(template, docTypeName, item) {
    const byAxisCode = {};
    for (const f of item.filters) {
        // используем axis_code если есть, иначе транслитерируем axis name
        const code = f.axis_code || f.axis.toLowerCase().replace(/\s+/g, '_');
        byAxisCode[code] = f.values.join(', ');
    }

    // Заменяем {doc_type}
    let result = template.replace('{doc_type}', docTypeName || '');

    // Заменяем любые {axis_code} динамически
    result = result.replace(/\{(\w+)\}/g, (match, key) => {
        return byAxisCode[key] ?? '';
    });

    return result.replace(/\s+/g, ' ').trim();
}

function FilterCell({ axisId, axisName, filters, allFilters, onAdd, onRemove }) {
    const [open, setOpen] = useState(false);
    const [axisFilters, setAxisFilters] = useState(null); // все фильтры этой оси
    const ref = useRef(null);

    // Закрытие по клику вне
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = async () => {
        if (!axisFilters) {
            const { ok, data } = await mediaApi.getFilters(axisId);
            if (ok) {
                const normalized = (data.filters || []).map(f => ({
                    id: f.id,
                    axis_id: f.axis?.id ?? f.axis_id,
                    axis: f.axis?.name ?? f.axis,
                    values: f.values.map(v => typeof v === 'object' ? v.value : v),
                    label: f.label,
                }));
                setAxisFilters(normalized);
            }
        }
        setOpen(o => !o);
    };

    const currentIds = new Set(filters.map(f => f.id));

    return (
        <div ref={ref} className="relative">
            <div className="flex flex-wrap gap-1">
                {/* Существующие теги */}
                {filters.map(f => (
                    <button key={f.id} onClick={handleOpen}
                        className="inline-flex items-center px-2 py-0.5 rounded
                         bg-blue-50 dark:bg-blue-900/30
                         text-blue-700 dark:text-blue-300 text-xs
                         hover:bg-blue-100 dark:hover:bg-blue-900/50
                         transition-colors cursor-pointer">
                        {f.values.map(v => v.value ?? v).join(', ')}
                    </button>
                ))}
                {/* Пустая ячейка — кнопка добавить */}
                {filters.length === 0 && (
                    <button onClick={handleOpen}
                        className="inline-flex items-center px-2 py-0.5 rounded
                         border border-dashed border-gray-300 dark:border-gray-600
                         text-gray-400 text-xs hover:border-blue-400
                         hover:text-blue-500 transition-colors">
                        + добавить
                    </button>
                )}
            </div>

            {/* Дропдаун с доступными фильтрами */}
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50 min-w-40
                          bg-white dark:bg-neutral-900
                          border border-gray-200 dark:border-gray-700
                          rounded-lg shadow-lg overflow-hidden">
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400
                            border-b border-gray-100 dark:border-gray-800">
                        {axisName}
                    </div>
                    {axisFilters === null ? (
                        <div className="px-3 py-2 text-xs text-gray-400">Загрузка...</div>
                    ) : axisFilters.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">Нет фильтров</div>
                    ) : (
                        <ul className="max-h-48 overflow-y-auto">
                            {axisFilters.map(f => {
                                const active = currentIds.has(f.id);
                                return (
                                    <li key={f.id}>
                                        <button
                                            onClick={() => {
                                                if (active) onRemove(f);
                                                else onAdd(f);
                                                setOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-xs
                                    transition-colors
                                    ${active
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'
                                                }`}>
                                            {active ? '✓ ' : ''}{f.values.map(v => v.value ?? v).join(', ')}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default function FolderUploadPage({ onBack }) {
    const { user } = useAuth();

    const [docTypes, setDocTypes] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    const [docTypeId, setDocTypeId] = useState('');
    const [productTypeId, setProductTypeId] = useState('');

    const [items, setItems] = useState([]); // [{file, path, external_id, filters}]
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(null); // {done, total, errors}
    const [excludeFolders, setExcludeFolders] = useState('Архив, archive');
    const [folderMarker, setFolderMarker] = useState('ПАСПОРТ');
    const exclude = excludeFolders.split(',').map(s => s.trim()).filter(Boolean);
    const [nameTemplate, setNameTemplate] = useState('{doc_type} {series}{heating} {design}');

    // Загружаем типы документов и типы продукции
    useEffect(() => {
        mediaApi.getFormData().then(({ ok, data }) => {
            if (!ok) return;
            setDocTypes(data.doc_types || []);
        });
        // Типы продукции из catalog
        fetch('/api/v1/catalog/product-types/')
            .then(r => r.json())
            .then(data => {
                const types = data.results || data;
                setProductTypes(Array.isArray(types) ? types : []);
            });
    }, []);

    const availableCodes = useMemo(() => {
        const codes = new Set();
        for (const item of items) {
            for (const f of item.filters) {
                const code = f.axis_code || f.axis.toLowerCase().replace(/\s+/g, '_');
                codes.add(code);
            }
        }
        return Array.from(codes);
    }, [items]);

    // Динамические колонки осей из результатов парсинга
    const axisColumns = useMemo(() => {
        const map = new Map(); // axis_id → {axis_id, axis}
        for (const item of items) {
            for (const f of item.filters) {
                if (!map.has(f.axis_id)) {
                    map.set(f.axis_id, { axis_id: f.axis_id, axis: f.axis });
                }
            }
        }
        return Array.from(map.values());
    }, [items]);

    const handleUpdateFilters = (path, newFilters) => {
        setItems(prev => prev.map(item =>
            item.path === path ? { ...item, filters: newFilters } : item
        ));
    };

    const handleFolderChange = async (e) => {
        const exclude = excludeFolders.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        // Шаг 1 — исключаем архивные папки
        const withoutExcluded = Array.from(e.target.files).filter(f => {
            if (!f.name.toLowerCase().endsWith('.pdf')) return false;
            const segments = f.webkitRelativePath.split('/').map(s => s.toLowerCase());
            return !segments.some(s => exclude.includes(s));
        });

        // Шаг 2 — из оставшихся берём только последнюю маркер-папку
        const files = filterLatestPassports(withoutExcluded, folderMarker);

        if (!files.length) return;

        setLoading(true);
        setItems([]);
        setProgress(null);

        const paths = files.map(f => f.webkitRelativePath);
        const { ok, data } = await mediaApi.parseFolderPaths(
            paths,
            productTypeId || null,
            exclude,
        );

        if (!ok || !data.success) {
            setLoading(false);
            return;
        }

        const parsed = files.map((file, i) => ({
            file,
            ...data.results[i],
        }));

        setItems(parsed);
        setLoading(false);
    };

    const handleUpload = async () => {
        if (!docTypeId || !items.length) return;
        setUploading(true);
        setProgress({ done: 0, total: items.length, errors: [] });
        const docTypeName = docTypes.find(dt => dt.id === +docTypeId)?.name || '';

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                // Шаг 1 — загружаем файл
                const generatedName = buildDocumentName(nameTemplate, docTypeName, item);
                const { ok, data } = await mediaApi.uploadDocument(
                    docTypeId,
                    item.external_id,
                    item.file,
                    generatedName,
                );

                if (!ok || !data.success) {
                    setProgress(prev => ({
                        ...prev,
                        done: prev.done + 1,
                        errors: [...prev.errors, `${item.external_id}: ${data?.error || 'Ошибка'}`],
                    }));
                    setItems(prev => prev.map((it, idx) =>
                        idx === i ? { ...it, status: 'error', statusMsg: data?.error } : it
                    ));
                    continue;
                }

                const docId = data.document?.id;

                // Шаг 2 — привязываем все фильтры одним запросом
                if (docId && item.filters.length) {
                    const filterIds = item.filters.map(f => f.id);
                    await mediaApi.bulkSetDocumentFilters(docId, filterIds);
                }

                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, status: 'ok' } : it
                ));
                setProgress(prev => ({ ...prev, done: prev.done + 1 }));

            } catch {
                setProgress(prev => ({
                    ...prev,
                    done: prev.done + 1,
                    errors: [...prev.errors, `${item.external_id}: Ошибка сети`],
                }));
                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, status: 'error', statusMsg: 'Ошибка сети' } : it
                ));
            }
        }

        setUploading(false);
    };

    const done = progress?.done ?? 0;
    const total = progress?.total ?? 0;
    const allDone = !uploading && progress && done === total;

    const sel = "border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="space-y-4">

            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack}
                            className="text-sm text-gray-500 dark:text-gray-400
                         hover:text-gray-700 dark:hover:text-gray-300">
                            ← Назад
                        </button>
                    )}
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Загрузка из папки
                    </h1>
                </div>
            </div>

            {/* Панель управления */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                <div className="flex flex-wrap items-end gap-4">

                    {/* Тип документа */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500
                               dark:text-gray-400 mb-1">
                            Тип документа
                        </label>
                        <select value={docTypeId} onChange={e => setDocTypeId(e.target.value)}
                            className={sel}>
                            <option value="">— выберите —</option>
                            {docTypes.map(dt => (
                                <option key={dt.id} value={dt.id}>{dt.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Тип продукции */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500
                               dark:text-gray-400 mb-1">
                            Тип продукции
                        </label>
                        <select value={productTypeId}
                            onChange={e => setProductTypeId(e.target.value)}
                            className={sel}>
                            <option value="">— все —</option>
                            {productTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Исключить папки
                        </label>
                        <input
                            value={excludeFolders}
                            onChange={e => setExcludeFolders(e.target.value)}
                            placeholder="Архив, archive"
                            className={`${sel} w-48`}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Маркер актуальной папки
                        </label>
                        <input
                            value={folderMarker}
                            onChange={e => setFolderMarker(e.target.value)}
                            placeholder="ПАСПОРТ"
                            className={`${sel} w-36`}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Шаблон имени документа
                        </label>
                        <input
                            value={nameTemplate}
                            onChange={e => setNameTemplate(e.target.value)}
                            className={`${sel} w-72`}
                            placeholder="{doc_type} {series} {heating} {design}"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                            Переменные: {'{doc_type}'}
                            {availableCodes.map(c => ` {${c}}`).join('')}
                        </div>
                    </div>

                    {/* Выбор папки */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500
                               dark:text-gray-400 mb-1">
                            Папка
                        </label>
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-2
                               rounded-lg border transition-colors text-sm
                               ${loading
                                ? 'border-blue-400 text-blue-500'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                            }`}>
                            <input type="file" className="hidden"
                                // @ts-ignore
                                webkitdirectory="" multiple accept=".pdf"
                                onChange={handleFolderChange} />
                            {loading ? '⏳ Анализ...' : '📁 Выбрать папку'}
                        </label>
                    </div>

                    {/* Счётчик */}
                    {items.length > 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 self-end pb-2">
                            {items.length} файлов
                        </div>
                    )}

                    {/* Кнопка загрузки */}
                    {items.length > 0 && (
                        <div className="ml-auto self-end">
                            <button
                                onClick={handleUpload}
                                disabled={uploading || !docTypeId || allDone}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700
                           disabled:opacity-50 text-white text-sm
                           font-medium rounded-lg transition-colors">
                                {uploading
                                    ? `Загрузка ${done}/${total}...`
                                    : allDone
                                        ? '✓ Готово'
                                        : `Загрузить ${items.length} файлов`}
                            </button>
                        </div>
                    )}
                </div>

                {/* Прогресс-бар */}
                {progress && (
                    <div className="mt-3 space-y-1">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className="bg-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                        </div>
                        {progress.errors.length > 0 && (
                            <div className="text-xs text-red-500">
                                Ошибок: {progress.errors.length}
                            </div>
                        )}
                        {allDone && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">
                                ✓ Загрузка завершена
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Таблица */}
            {items.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 text-xs font-medium
                               text-gray-500 dark:text-gray-400 uppercase
                               tracking-wide min-w-64">
                                    Файл
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium
               text-gray-500 dark:text-gray-400 uppercase
               tracking-wide min-w-48">
                                    Имя документа
                                </th>
                                {axisColumns.map(col => (
                                    <th key={`axis-col-${col.axis_id}`}
                                        className="text-left px-4 py-3 text-xs font-medium
                               text-blue-500 dark:text-blue-400 uppercase
                               tracking-wide whitespace-nowrap">
                                        {col.axis}
                                    </th>
                                ))}
                                <th className="text-left px-4 py-3 text-xs font-medium
                               text-gray-500 dark:text-gray-400 uppercase
                               tracking-wide w-24">
                                    Статус
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <TableRow
                                    key={item.path}
                                    item={item}
                                    idx={idx}
                                    axisColumns={axisColumns}
                                    onUpdateFilters={handleUpdateFilters}
                                    docTypeName={docTypes.find(dt => dt.id === +docTypeId)?.name || ''}
                                    nameTemplate={nameTemplate}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function TableRow({ item, idx, axisColumns, onUpdateFilters, docTypeName, nameTemplate }) {
    const generatedName = buildDocumentName(nameTemplate, docTypeName, item);
    const filtersByAxis = useMemo(() => {
        const map = {};
        for (const f of item.filters) {
            if (!map[f.axis_id]) map[f.axis_id] = [];
            map[f.axis_id].push(f);
        }
        return map;
    }, [item.filters]);

    const handleAdd = (axisId, filter) => {
        const newFilters = [...item.filters, filter];
        onUpdateFilters(item.path, newFilters);
    };

    const handleRemove = (axisId, filter) => {
        const newFilters = item.filters.filter(f => f.id !== filter.id);
        onUpdateFilters(item.path, newFilters);
    };

    return (
        <tr className={`border-b border-gray-100 dark:border-gray-800
                      ${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-800/30'}`}>

            <td className="px-4 py-2">
                <div className="text-gray-900 dark:text-white font-mono text-xs">
                    {item.external_id}
                </div>
                <div className="text-gray-400 text-xs mt-0.5 max-w-xs" title={item.path}>
                    {item.path.split('/').slice(0, -1).join(' / ')}
                </div>
            </td>

            {/* Имя документа */}
            <td className="px-4 py-2">
                <span className="text-sm text-gray-900 dark:text-white">
                    {generatedName || <span className="text-gray-400">—</span>}
                </span>
            </td>
            {axisColumns.map(col => (
                <td key={`cell-${col.axis_id}`} className="px-4 py-2">
                    <FilterCell
                        axisId={col.axis_id}
                        axisName={col.axis}
                        filters={filtersByAxis[col.axis_id] || []}
                        onAdd={(f) => handleAdd(col.axis_id, f)}
                        onRemove={(f) => handleRemove(col.axis_id, f)}
                    />
                </td>
            ))}

            <td className="px-4 py-2 whitespace-nowrap">
                {item.status === 'ok' && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓ Загружено</span>
                )}
                {item.status === 'error' && (
                    <span className="text-red-500 text-xs" title={item.statusMsg}>✗ Ошибка</span>
                )}
                {!item.status && (
                    <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                )}
            </td>
        </tr>
    );
}