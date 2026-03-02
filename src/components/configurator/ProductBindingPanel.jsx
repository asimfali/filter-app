import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../api/auth';
import { catalogApi } from '../../api/catalog';

const API = '/api/v1/catalog';

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
}) {
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(new Set()); // Set<productId>
    const lastClickedIdx = useRef(null);

    // ── Загрузка товаров ───────────────────────────────────────────────────
    useEffect(() => {
        if (search.length < 2) {
            setProducts([]);
            return;
        }
    
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const { ok, data } = await catalogApi.searchProducts(search, {
                    productTypeId,
                    limit: 50,
                });
                setProducts(ok && data.success ? data.data : []);
            } finally {
                setLoading(false);
            }
        }, 300);
    
        return () => clearTimeout(t);
    }, [search, productTypeId]);
    // ── Мультиселект ───────────────────────────────────────────────────────

    const handleClick = (e, productId, idx) => {
        setSelected(prev => {
            const next = new Set(prev);

            if (e.shiftKey && lastClickedIdx.current !== null) {
                // Диапазон от последнего клика до текущего
                const from = Math.min(lastClickedIdx.current, idx);
                const to = Math.max(lastClickedIdx.current, idx);
                for (let i = from; i <= to; i++) {
                    next.add(products[i].id);
                }
            } else if (e.ctrlKey || e.metaKey) {
                // Добавить/убрать один
                if (next.has(productId)) next.delete(productId);
                else next.add(productId);
            } else {
                // Обычный клик — только этот
                if (next.has(productId) && next.size === 1) {
                    next.clear(); // снять если уже единственный выделенный
                } else {
                    next.clear();
                    next.add(productId);
                }
            }

            onSelectionChange?.([...next]);
            return next;
        });
        lastClickedIdx.current = idx;
    };

    const handleSelectAll = () => {
        if (selected.size === products.length) {
            setSelected(new Set());
            onSelectionChange?.([]);
        } else {
            const all = new Set(products.map(p => p.id));
            setSelected(all);
            onSelectionChange?.([...all]);
        }
    };

    // ── Drag ───────────────────────────────────────────────────────────────

    const handleDragStart = (e, productId) => {
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
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow">

            {/* Поиск */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск товаров..."
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                               px-3 py-1.5 text-sm focus:outline-none focus:ring-2
                               focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                />
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
                                draggable
                                onDragStart={e => handleDragStart(e, product.id)}
                                onClick={e => handleClick(e, product.id, idx)}
                                className={`
                                    flex items-start gap-2 px-3 py-2 cursor-grab active:cursor-grabbing
                                    border-b border-gray-50 dark:border-gray-800 select-none
                                    transition-colors
                                    ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }
                                `}
                            >
                                {/* Чекбокс */}
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    onClick={e => e.stopPropagation()}
                                    className="mt-0.5 rounded shrink-0 pointer-events-none"
                                />

                                {/* Контент */}
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-gray-800
                                                    dark:text-gray-200 truncate leading-tight">
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
                Shift+клик — диапазон · Ctrl+клик — добавить
            </div>
        </div>
    );
}