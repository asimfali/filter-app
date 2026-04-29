import React, { useState, useEffect, useCallback, useRef } from 'react';
import { catalogApi } from '../api/catalog';
import { useAuth } from '../contexts/AuthContext';
import SmartSelect from '../components/common/SmartSelect';

// ─── Хук пагинированного списка ───────────────────────────────────────────

function useProductList(fetcher) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');
    const [productTypeId, setPtId] = useState(null);
    const [extra, setExtra] = useState({});

    const load = useCallback(async (overrides = {}) => {
        setLoading(true);
        const opts = { q, productTypeId, page, ...extra, ...overrides };
        const { ok, data } = await fetcher(opts);
        if (ok && data.success) {
            setItems(data.data.items);
            setTotal(data.data.total);
        }
        setLoading(false);
    }, [q, productTypeId, page, extra, fetcher]);

    const search = useCallback((val) => {
        setQ(val);
        setPage(1);
        load({ q: val, page: 1 });
    }, [load]);

    const changePage = useCallback((p) => {
        setPage(p);
        load({ page: p });
    }, [load]);

    const changeProductType = useCallback((id) => {
        setPtId(id);
        setPage(1);
    }, []);

    const changeExtra = useCallback((patch) => {
        const next = { ...extra, ...patch };
        setExtra(next);
        setPage(1);
        load({ ...next, page: 1 });
    }, [extra, load]);

    useEffect(() => { load(); }, [productTypeId]);

    return {
        items, total, page, loading, q, productTypeId,
        load, search, changePage, changeProductType, changeExtra,
    };
}

// ─── Пагинация ────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize = 50, onChange }) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between text-xs
                        text-gray-500 dark:text-gray-400 pt-2">
            <span>{total} изделий</span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onChange(page - 1)}
                    disabled={page === 1}
                    className="px-2 py-1 rounded disabled:opacity-40
                               hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    ←
                </button>
                <span className="px-1">{page} / {totalPages}</span>
                <button
                    onClick={() => onChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-2 py-1 rounded disabled:opacity-40
                               hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    →
                </button>
            </div>
        </div>
    );
}

// ─── Панель (переиспользуемая обёртка колонки) ────────────────────────────

function Panel({ title, badge, toolbar, footer, children }) {
    return (
        <div className="flex flex-col border border-gray-200 dark:border-gray-700
                        rounded-xl overflow-hidden h-full">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800
                            bg-gray-50 dark:bg-neutral-800/50 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {title}
                    </span>
                    {badge}
                </div>
                {toolbar}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                {children}
            </div>
            {footer && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
                    {footer}
                </div>
            )}
        </div>
    );
}

// ─── Строка изделия ───────────────────────────────────────────────────────

function ProductRow({ product, checked, onClick, onToggle, active }) {
    const base = 'flex items-center gap-2 px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors';
    const cls = active
        ? `${base} bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100`
        : `${base} hover:bg-neutral-50 dark:hover:bg-neutral-800`;

    return (
        <div className={cls} onClick={onClick}>
            {onToggle && (
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onToggle}
                    onClick={e => e.stopPropagation()}
                    className="rounded shrink-0"
                />
            )}
            <div className="min-w-0 flex-1">
                <div className="truncate text-gray-900 dark:text-gray-100">
                    {product.name}
                </div>
                {product.external_name && (
                    <div className="text-gray-400 truncate">→ {product.external_name}</div>
                )}
                {product.external_id && !product.external_name && (
                    <div className="text-gray-400 truncate">{product.external_id}</div>
                )}
            </div>
            {product.variants_count > 0 && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full
                                 bg-blue-100 dark:bg-blue-900/30
                                 text-blue-700 dark:text-blue-300">
                    {product.variants_count}
                </span>
            )}
        </div>
    );
}

// ─── Флэш-сообщение ───────────────────────────────────────────────────────

function useFlash() {
    const [msg, setMsg] = useState(null);
    const flash = useCallback((text, ok = true) => {
        setMsg({ text, ok });
        setTimeout(() => setMsg(null), 3000);
    }, []);
    return { msg, flash };
}

// ─── Главная страница ─────────────────────────────────────────────────────

export default function VariantEditorPage({ onBack }) {
    const [productTypes, setProductTypes] = useState([]);
    useEffect(() => {
        catalogApi.productTypes().then(({ ok, data }) => {
            if (ok) setProductTypes(Array.isArray(data) ? data : (data.data ?? []));
        });
    }, []);

    // Левая панель — свободные изделия
    const free = useProductList(
        useCallback(opts => catalogApi.variantFreeProducts(opts), [])
    );

    // Правая панель — родители
    const [showWithVariants, setShowWithVariants] = useState(false);
    const parents = useProductList(
        useCallback(opts => catalogApi.variantParents(opts), [])
    );

    // Выбор
    const [selected, setSelected] = useState(new Set());
    const [selectedParent, setSelectedParent] = useState(null);
    const [variants, setVariants] = useState([]);
    const [externalName, setExternalName] = useState('');
    const [saving, setSaving] = useState(false);
    const { msg, flash } = useFlash();
    const [globalTypeId, setGlobalTypeId] = useState(null);

    const handleTypeChange = (id) => {
        setGlobalTypeId(id);
        setSelected(new Set());
        setSelectedParent(null);
        setVariants([]);
        free.changeProductType(id);
        parents.changeProductType(id);
    };

    const loadVariants = useCallback(async (parent) => {
        const { ok, data } = await catalogApi.variantParents({ parentId: parent.id });
        if (ok && data.success) setVariants(data.data.variants || []);
    }, []);

    const selectParent = useCallback(async (parent) => {
        setSelectedParent(parent);
        setExternalName(parent.external_name || '');
        await loadVariants(parent);
    }, [loadVariants]);

    const toggleSelect = (id) =>
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const toggleAll = () =>
        setSelected(
            selected.size === free.items.length && free.items.length > 0
                ? new Set()
                : new Set(free.items.map(p => p.id))
        );

    const handleLink = async () => {
        if (!selected.size || !selectedParent) return;
        setSaving(true);
        const { ok, data } = await catalogApi.variantLink(
            [...selected], selectedParent.id, externalName || null,
        );
        if (ok && data.success) {
            flash(`✓ Привязано: ${data.data.linked}`);
            setSelected(new Set());
            free.load();
            parents.load();
            await loadVariants(selectedParent);
        } else {
            flash(data.error || 'Ошибка', false);
        }
        setSaving(false);
    };

    const handleUnlink = async (productId) => {
        const { ok, data } = await catalogApi.variantUnlink([productId]);
        if (ok && data.success) {
            flash('✓ Отвязано');
            free.load();
            parents.load();
            await loadVariants(selectedParent);
        } else {
            flash(data.error || 'Ошибка', false);
        }
    };

    const handleSaveExternalName = async () => {
        if (!selectedParent) return;
        const { ok } = await catalogApi.variantSetExternalName(selectedParent.id, externalName);
        if (ok) flash('✓ Название сохранено');
    };

    const inputCls = `w-full px-3 py-1.5 text-sm rounded-lg border
                      border-gray-200 dark:border-gray-700
                      bg-white dark:bg-neutral-800
                      text-gray-900 dark:text-white
                      focus:outline-none focus:ring-1 focus:ring-blue-500`;

    return (
        <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 80px)' }}>

            {/* Шапка */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack}
                        className="text-gray-400 hover:text-gray-600
                       dark:hover:text-gray-300 text-lg">
                        ←
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Редактор исполнений
                    </h1>

                    {/* ← Глобальный фильтр типа продукции */}
                    <select
                        value={globalTypeId || ''}
                        onChange={e => handleTypeChange(e.target.value || null)}
                        className="px-3 py-1.5 text-sm rounded-lg border
                       border-gray-200 dark:border-gray-700
                       bg-white dark:bg-neutral-800
                       text-gray-900 dark:text-white
                       focus:outline-none">
                        <option value="">Все типы продукции</option>
                        {productTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
                {msg && (
                    <span className={`text-xs px-3 py-1.5 rounded-lg ${msg.ok
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                        {msg.text}
                    </span>
                )}
            </div>

            {/* Три колонки */}
            <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">

                {/* ── Левая: свободные ── */}
                <Panel
                    title="Свободные изделия"
                    badge={selected.size > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                            {selected.size} выбрано
                        </span>
                    )}
                    toolbar={
                        <div className="space-y-1.5">
                            <input
                                placeholder="Поиск..."
                                onChange={e => free.search(e.target.value)}
                                className={inputCls}
                            />
                            <label className="flex items-center gap-2 text-xs
                                              text-gray-500 dark:text-gray-400 cursor-pointer pt-0.5">
                                <input
                                    type="checkbox"
                                    checked={selected.size === free.items.length && free.items.length > 0}
                                    onChange={toggleAll}
                                    className="rounded"
                                />
                                Выбрать все на странице
                            </label>
                        </div>
                    }
                    footer={
                        <Pagination
                            page={free.page}
                            total={free.total}
                            onChange={free.changePage}
                        />
                    }
                >
                    {free.loading && (
                        <p className="text-xs text-gray-400 text-center py-4">Загрузка...</p>
                    )}
                    {!free.loading && free.items.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">
                            Нет свободных изделий
                        </p>
                    )}
                    {!free.loading && free.items.map(p => (
                        <ProductRow
                            key={p.id}
                            product={p}
                            checked={selected.has(p.id)}
                            onToggle={() => toggleSelect(p.id)}
                            onClick={() => toggleSelect(p.id)}
                        />
                    ))}
                </Panel>

                {/* ── Центр: действия ── */}
                <div className="flex flex-col gap-3 overflow-y-auto">

                    {/* Выбор родителя через SmartSelect */}
                    <div className="border border-gray-200 dark:border-gray-700
                                    rounded-xl p-4 space-y-3 shrink-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Родитель
                        </p>
                        <SmartSelect
                            endpoint="/api/v1/catalog/variants/parents/search/"
                            onSelect={selectParent}
                            onClear={() => {
                                setSelectedParent(null);
                                setVariants([]);
                                setExternalName('');
                            }}
                            value={selectedParent}
                            nameKey="name"
                            placeholder="Поиск родителя..."
                            renderItem={item => (
                                <div>
                                    <div className="text-gray-900 dark:text-white
                                                    font-medium truncate">
                                        {item.name}
                                    </div>
                                    {item.variants_count > 0 && (
                                        <div className="text-gray-400 text-xs">
                                            исполнений: {item.variants_count}
                                        </div>
                                    )}
                                </div>
                            )}
                        />
                        <button
                            onClick={handleLink}
                            disabled={!selected.size || !selectedParent || saving}
                            className="w-full px-3 py-2 text-sm font-medium rounded-lg
                                       bg-blue-600 hover:bg-blue-700 text-white
                                       disabled:opacity-40 transition-colors">
                            {saving
                                ? '⏳ Привязка...'
                                : selected.size
                                    ? `Привязать (${selected.size}) → родитель`
                                    : 'Выберите изделия слева'
                            }
                        </button>
                    </div>

                    {/* External name */}
                    {selectedParent && (
                        <div className="border border-gray-200 dark:border-gray-700
                                        rounded-xl p-4 space-y-2 shrink-0">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Название для внешнего сайта
                            </p>
                            <input
                                value={externalName}
                                onChange={e => setExternalName(e.target.value)}
                                placeholder={selectedParent.name}
                                className={inputCls}
                            />
                            <button
                                onClick={handleSaveExternalName}
                                className="w-full px-3 py-1.5 text-xs font-medium
                                           rounded-lg bg-neutral-100 dark:bg-neutral-700
                                           text-gray-700 dark:text-gray-300
                                           hover:bg-neutral-200 dark:hover:bg-neutral-600
                                           transition-colors">
                                Сохранить
                            </button>
                        </div>
                    )}

                    {/* Текущие исполнения выбранного родителя */}
                    {selectedParent && (
                        <div className="border border-gray-200 dark:border-gray-700
                                        rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="px-3 py-2 border-b border-gray-100
                                            dark:border-gray-800 bg-gray-50
                                            dark:bg-neutral-800/50 shrink-0">
                                <span className="text-xs font-medium text-gray-600
                                                 dark:text-gray-300">
                                    Исполнения ({variants.length})
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                                {variants.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-4">
                                        Нет исполнений
                                    </p>
                                )}
                                {variants.map(v => (
                                    <div key={v.id}
                                        className="flex items-center gap-2 px-2 py-1.5
                                                    rounded text-xs group hover:bg-neutral-50
                                                    dark:hover:bg-neutral-800">
                                        <div className="flex-1 min-w-0 truncate
                                                        text-gray-800 dark:text-gray-200">
                                            {v.name}
                                        </div>
                                        <button
                                            onClick={() => handleUnlink(v.id)}
                                            title="Отвязать"
                                            className="opacity-0 group-hover:opacity-100
                                                       text-red-400 hover:text-red-600
                                                       transition-all shrink-0">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Правая: родители ── */}
                <Panel
                    title="Все родители"
                    badge={
                        <label className="flex items-center gap-1.5 text-xs
                                          text-gray-500 dark:text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showWithVariants}
                                onChange={e => {
                                    setShowWithVariants(e.target.checked);
                                    parents.changeExtra({ withVariants: e.target.checked });
                                }}
                                className="rounded"
                            />
                            С исполнениями
                        </label>
                    }
                    toolbar={
                        <div className="space-y-1.5">
                            <input
                                placeholder="Поиск..."
                                onChange={e => parents.search(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    }
                    footer={
                        <Pagination
                            page={parents.page}
                            total={parents.total}
                            onChange={parents.changePage}
                        />
                    }
                >
                    {parents.loading && (
                        <p className="text-xs text-gray-400 text-center py-4">Загрузка...</p>
                    )}
                    {!parents.loading && parents.items.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">
                            Нет родителей
                        </p>
                    )}
                    {!parents.loading && parents.items.map(p => (
                        <ProductRow
                            key={p.id}
                            product={p}
                            active={selectedParent?.id === p.id}
                            onClick={() => selectParent(p)}
                        />
                    ))}
                </Panel>
            </div>
        </div>
    );
}