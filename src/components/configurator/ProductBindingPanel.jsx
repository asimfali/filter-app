import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../api/auth';
import { catalogApi } from '../../api/catalog';
import { useMultiSelect } from '../../hooks/useMultiSelect';

const API = '/api/v1/catalog';


export function ChainProductsPanel({ products, partialProducts = [], loading, filters, onDrop, onDetach, onPartialDragStart }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const fullSelect = useMultiSelect(products);
    const partialSelect = useMultiSelect(partialProducts);

    // Del — удаление выделенных
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Delete' && selected.size > 0) {
                onDetach?.([...selected]);
                setSelected(new Set());
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fullSelect.selected, onDetach]);

    return (
        <div
            className={`w-44 shrink-0 flex flex-col bg-white dark:bg-neutral-900
                        rounded-lg shadow overflow-hidden transition-colors
                        ${isDragOver ? 'ring-2 ring-emerald-400' : ''}`}
            style={{ maxHeight: 600 }}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
                e.preventDefault();
                setIsDragOver(false);
                let productIds = [];
                try { productIds = JSON.parse(e.dataTransfer.getData('productIds')); } catch { return; }
                if (productIds.length) onDrop?.(productIds);
            }}
        >
            {/* Неполные товары */}
            {partialProducts.length > 0 && (
                <>
                    <div className="px-2 py-1.5 border-t border-dashed border-amber-200
                                    bg-amber-50 dark:bg-amber-900/10 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                Неполные · {partialProducts.length} шт.
                            </span>
                            <button
                                onClick={partialSelect.selectAll}
                                className="text-[10px] text-amber-500 hover:text-amber-700"
                            >
                                Все
                            </button>
                        </div>
                        {partialSelect.selected.size > 0 && (
                            <span className="text-[10px] text-amber-400">
                                {partialSelect.selected.size} выбрано · Shift/Ctrl
                            </span>
                        )}
                    </div>
                    <div className="overflow-y-auto max-h-48 shrink-0">
                        {partialProducts.map((p, idx) => {
                            const isSelected = partialSelect.selected.has(p.id);
                            return (
                                <div
                                    key={p.id}
                                    draggable
                                    onDragStart={e => {
                                        const ids = partialSelect.selected.has(p.id) && partialSelect.selected.size > 1
                                            ? [...partialSelect.selected]
                                            : [p.id];
                                        const allMissing = partialProducts
                                            .filter(pp => ids.includes(pp.id))
                                            .map(pp => pp.missing_axes)
                                            .reduce((acc, axes) => acc.filter(a => axes.includes(a)));
                                        e.dataTransfer.setData('productIds', JSON.stringify(ids));
                                        e.dataTransfer.effectAllowed = 'copy';
                                        onPartialDragStart?.(allMissing);
                                        if (!partialSelect.selected.has(p.id)) {
                                            partialSelect.setSelected(new Set([p.id]));
                                        }
                                    }}
                                    onDragEnd={() => onPartialDragStart?.([])}
                                    onClick={e => partialSelect.handleClick(e, p.id, idx)}
                                    className={`px-2 py-1.5 border-b border-gray-50 dark:border-gray-800
                                               cursor-grab select-none transition-colors
                                               ${isSelected
                                            ? 'bg-amber-100 dark:bg-amber-900/30'
                                            : 'bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-100/50'
                                        }`}
                                >
                                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate" title={p.name}>
                                        {p.name}
                                    </div>
                                    <div className="text-[10px] text-amber-500 truncate">
                                        нет: {p.missing_axes.join(', ')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Полные товары */}
            <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        В цепочке
                        {!loading && (
                            <span className="ml-1 font-normal">
                                {products.length === 500 ? '500+' : products.length} шт.
                            </span>
                        )}
                    </span>
                    {products.length > 0 && (
                        <button
                            onClick={fullSelect.selectAll}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                        >
                            Все
                        </button>
                    )}
                </div>
                {fullSelect.selected.size > 0 && (
                    <span className="text-[10px] text-blue-500">
                        {fullSelect.selected.size} выбрано · Shift/Ctrl
                    </span>
                )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                    <div className="p-3 text-center text-gray-400 text-xs">Загрузка...</div>
                ) : products.length === 0 ? (
                    <div className="p-3 text-center text-gray-400 text-xs">Нет изделий</div>
                ) : (
                    products.map((p, idx) => {
                        const isSelected = fullSelect.selected.has(p.id);
                        return (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={e => {  // ← добавь
                                    const ids = fullSelect.selected.has(p.id) && fullSelect.selected.size > 1
                                        ? [...fullSelect.selected]
                                        : [p.id];
                                    e.dataTransfer.setData('productIds', JSON.stringify(ids));
                                    e.dataTransfer.effectAllowed = 'copy';
                                    if (!fullSelect.selected.has(p.id)) {
                                        fullSelect.setSelected(new Set([p.id]));
                                    }
                                }}
                                onClick={e => fullSelect.handleClick(e, p.id, idx)}
                                className={`px-2 py-1.5 border-b border-gray-50 dark:border-gray-800
                                           cursor-pointer select-none transition-colors
                                           ${isSelected
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-100'
                                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                <div className="text-xs text-gray-800 dark:text-gray-200 truncate leading-tight" title={p.name}>
                                    {p.name}
                                </div>
                                {p.sku && (
                                    <div className="text-[10px] text-gray-400 truncate">{p.sku}</div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            <div className="px-2 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 text-center">
                {isDragOver ? '+ Отпустите' : 'Перетащите товар · Shift/Ctrl'}
            </div>
        </div>
    );
}

/**
 * Панель товаров для редактора привязок.
 * 
 * Возможности:
 * - Поиск по строке (debounce 300ms)
 * - Мультиселект: клик = выделить, Ctrl+клик = добавить, Shift+клик = диапазон
 * - Отображение уже накопленных назначений (pendingAssignments)
 * - Drag выделенных товаров наружу (вызывает onDragStart)
 */
export default function ProductBindingPanel({
    productTypeId,      // uuid — тип продукции
    filterValueIds,     // string[] — выбранные теги (фильтр)
    pendingAssignments, // { [productId]: { axisId, valueId, axisName, valueName }[] }
    onDragStart,        // (productIds: string[]) => void — начало drag
    onSelectionChange,  // (productIds: string[]) => void — уведомить родителя
    readOnly = false,
}) {
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [regexMode, setRegexMode] = useState(false);
    const [noParams, setNoParams] = useState(false);
    const { selected, setSelected, handleClick, selectAll } = useMultiSelect(products);

    // ── Загрузка товаров ───────────────────────────────────────────────────
    useEffect(() => {
        if (search.length < 2 && !noParams) {
            setProducts([]);
            return;
        }

        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const { ok, data } = await catalogApi.searchProducts(search, {
                    productTypeId,
                    limit: 50,
                    regex: regexMode,
                    noParams,
                });
                setProducts(ok && data.success ? data.data : []);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [search, productTypeId, regexMode, noParams]);
    // ── Мультиселект ───────────────────────────────────────────────────────

    const handleSelectAll = () => {
        if (readOnly) return;
        if (selected.size === products.length) {
            setSelected(new Set());
            onSelectionChange?.([]);
        } else {
            selectAll();
            onSelectionChange?.([...products.map(p => p.id)]);
        }
    };

    const handleClickWithCallback = (e, productId, idx) => {
        if (readOnly) return;
        handleClick(e, productId, idx);
        // selected обновится асинхронно — используем setTimeout
        setTimeout(() => onSelectionChange?.([...selected]), 0);
    };

    // ── Drag ───────────────────────────────────────────────────────────────

    const handleDragStart = (e, productId) => {
        if (readOnly) { e.preventDefault(); return; }
        // Если тащим невыделенный — выделяем только его
        const dragIds = selected.has(productId)
            ? [...selected]
            : [productId];

        if (!selected.has(productId)) {
            setSelected(new Set([productId]));
            onSelectionChange?.([productId]);
        }

        // Передаём ids через dataTransfer и через колбэк
        e.dataTransfer.setData('productIds', JSON.stringify(dragIds));
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart?.(dragIds);
    };

    // ── Helpers ────────────────────────────────────────────────────────────

    const getPendingLabels = (productId) => {
        const assignments = pendingAssignments[productId];
        if (!assignments?.length) return null;
        return assignments.map(a => `${a.axisName}=${a.valueName}`).join(', ');
    };

    const allSelected = products.length > 0 && selected.size === products.length;

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-lg shadow">

            {/* Поиск */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={regexMode ? 'Regex: П2\\d*E' : 'Поиск товаров...'}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                   px-3 py-1.5 text-sm focus:outline-none focus:ring-2
                   focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
                />
                <div className="flex gap-2 mt-1.5">
                    <button
                        onClick={() => { setNoParams(r => !r); }}
                        title="Только без осей"
                        className={`flex-1 py-1 rounded text-xs border transition-colors ${noParams
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:border-red-400'
                            }`}
                    >
                        ∅ Без осей
                    </button>
                    <button
                        onClick={() => setRegexMode(r => !r)}
                        title="Regex поиск"
                        className={`flex-1 py-1 rounded text-xs font-mono border transition-colors ${regexMode
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:border-violet-400'
                            }`}
                    >
                        .* Regex
                    </button>
                </div>
            </div>

            {/* Шапка списка */}
            <div className="flex items-center justify-between px-3 py-1.5
                            text-xs text-gray-500 dark:text-gray-400
                            border-b border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        className="rounded"
                    />
                    Все ({products.length})
                </label>
                {selected.size > 0 && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {selected.size} выбрано
                    </span>
                )}
            </div>

            {/* Список товаров */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-6 text-center text-gray-400 text-sm">Загрузка...</div>
                ) : products.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">
                        {search ? 'Ничего не найдено' : 'Нет товаров'}
                    </div>
                ) : (
                    products.map((product, idx) => {
                        const isSelected = selected.has(product.id);
                        const pendingLabel = getPendingLabels(product.id);

                        return (
                            <div
                                key={product.id}
                                draggable={!readOnly}
                                onDragStart={e => handleDragStart(e, product.id)}
                                onClick={e => handleClick(e, product.id, idx)}
                                className={`
                                    flex items-start gap-2 px-3 py-2 cursor-grab active:cursor-grabbing
                                    border-b border-gray-50 dark:border-gray-800 select-none
                                    transition-colors
                                    ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100'
                                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                    }
                                `}
                            >
                                {/* Чекбокс */}
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    onClick={e => e.stopPropagation()}
                                    disabled={readOnly}
                                    className="mt-0.5 rounded shrink-0 pointer-events-none"
                                />

                                {/* Контент */}
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-gray-800
                                                    dark:text-gray-200 truncate leading-tight" title={product.name}>
                                        {product.name}
                                    </div>
                                    {product.sku && (
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">
                                            {product.sku}
                                        </div>
                                    )}
                                    {/* Накопленные назначения */}
                                    {pendingLabel && (
                                        <div className="text-[11px] text-emerald-600 mt-0.5 truncate">
                                            ✓ {pendingLabel}
                                        </div>
                                    )}
                                </div>

                                {/* Иконка drag */}
                                <span className="text-gray-300 dark:text-gray-600 text-sm mt-0.5 shrink-0">
                                    ⠿
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Подсказка */}
            <div className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500
                            border-t border-gray-100 dark:border-gray-800 text-center">
                {readOnly ? '[R] Режим только для чтения' : 'Shift+клик — диапазон · Ctrl+клик — добавить'}
            </div>
        </div>
    );
}