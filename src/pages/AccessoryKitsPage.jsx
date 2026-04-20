import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mediaApi } from '../api/media';
import { catalogApi } from '../api/catalog';
import { can } from '../utils/permissions';
import FiltersPanel from '../components/media/FiltersPanel';
import DirectProductsPanel from '../components/media/DirectProductsPanel';

// ── Хук загрузки ─────────────────────────────────────────────────────────

function useAccessoryKits() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, data } = await mediaApi.getAccessoryKits();
            if (ok) setItems(data.data || []);
            else setError('Ошибка загрузки');
        } catch {
            setError('Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    return { items, loading, error, reload: load };
}

function useFormData() {
    const [axes, setAxes] = useState([]);
    useEffect(() => {
        mediaApi.getFormData().then(({ ok, data }) => {
            if (ok) setAxes(data.axes || []);
        });
    }, []);
    return { axes };
}

// ── Форма создания набора ─────────────────────────────────────────────────

function KitCreateForm({ onSaved, onCancel }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        const { ok, data } = await mediaApi.createAccessoryKit({ name, description });
        if (ok && data.success) onSaved(data.data);
        else setError(data.error || 'Ошибка сохранения');
        setLoading(false);
    };

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 " +
        "text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Название набора
                </label>
                <input
                    autoFocus required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Автоматика базовая серия 100 E"
                    className={inp}
                />
            </div>
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Описание (необязательно)
                </label>
                <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Краткое описание"
                    className={inp}
                />
            </div>
            {error && (
                <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950
                                border border-red-200 dark:border-red-800 px-3 py-2 rounded">
                    {error}
                </div>
            )}
            <div className="flex gap-2">
                <button type="submit" disabled={loading || !name.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               text-white text-sm font-medium px-4 py-2
                               rounded-lg transition-colors">
                    {loading ? '···' : 'Создать'}
                </button>
                <button type="button" onClick={onCancel}
                    className="text-sm text-gray-400 hover:text-gray-600
                               dark:hover:text-gray-300 px-3 py-2">
                    Отмена
                </button>
            </div>
        </form>
    );
}

// ── Позиции набора ────────────────────────────────────────────────────────

function KitItemsPanel({ kitId, initialItems, canWrite }) {
    const [items, setItems] = useState(initialItems || []);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editQty, setEditQty] = useState(1);

    useEffect(() => {
        if (!search || search.length < 2) { setResults([]); return; }
        setSearching(true);
        catalogApi.searchProducts(search, { limit: 10 })
            .then(({ ok, data }) => { if (ok) setResults(data.data || []); })
            .finally(() => setSearching(false));
    }, [search]);

    const handleAdd = async (product) => {
        const { ok, data } = await mediaApi.addAccessoryKitItem(kitId, {
            accessory_id: product.id,
            quantity: 1,
            is_required: true,
        });
        if (ok && data.success) {
            setItems(prev => [...prev, data.item]);
            setSearch('');
            setResults([]);
            setAdding(false);
        }
    };

    const handleDelete = async (itemId) => {
        const { ok } = await mediaApi.deleteAccessoryKitItem(kitId, itemId);
        if (ok) setItems(prev => prev.filter(i => i.id !== itemId));
    };

    const handleUpdateQty = async (item) => {
        const { ok, data } = await mediaApi.updateAccessoryKitItem(kitId, item.id, {
            quantity: editQty,
        });
        if (ok && data.success) {
            setItems(prev => prev.map(i => i.id === item.id ? data.item : i));
            setEditingId(null);
        }
    };

    return (
        <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Позиции
                </span>
                {canWrite && !adding && (
                    <button onClick={() => setAdding(true)}
                        className="text-xs text-blue-500 hover:text-blue-600
                                   dark:hover:text-blue-400 transition-colors">
                        + Добавить изделие
                    </button>
                )}
            </div>

            {/* Форма добавления */}
            {adding && (
                <div className="mb-3 space-y-1.5">
                    <div className="relative">
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск изделия..."
                            className="w-full border border-gray-200 dark:border-gray-700
                                       rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white focus:outline-none
                                       focus:ring-1 focus:ring-blue-500"
                        />
                        {searching && (
                            <span className="absolute right-3 top-2 text-xs
                                             text-gray-400 animate-pulse">···</span>
                        )}
                    </div>

                    {results.length > 0 && (
                        <div className="border border-gray-100 dark:border-gray-800
                                        rounded-lg overflow-hidden divide-y
                                        divide-gray-50 dark:divide-gray-800">
                            {results.map(p => (
                                <button key={p.id} onClick={() => handleAdd(p)}
                                    className="flex items-center justify-between w-full
                                               px-3 py-2 text-left hover:bg-neutral-50
                                               dark:hover:bg-neutral-800 transition-colors">
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {p.name}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {p.sku || ''}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button onClick={() => { setAdding(false); setSearch(''); setResults([]); }}
                        className="text-xs text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300">
                        Отмена
                    </button>
                </div>
            )}

            {/* Список позиций */}
            {items.length === 0 && !adding ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">Позиций пока нет</p>
            ) : (
                <div className="space-y-1">
                    {items.map(item => (
                        <div key={item.id}
                            className="flex items-center justify-between py-1.5 gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    item.is_required
                                        ? 'bg-emerald-500'
                                        : 'bg-gray-300 dark:bg-gray-600'
                                }`} title={item.is_required ? 'Обязательное' : 'Опциональное'} />
                                <span className="text-sm text-gray-900 dark:text-white truncate">
                                    {item.name}
                                </span>
                                {item.sku && (
                                    <span className="text-xs text-gray-400 font-mono shrink-0">
                                        {item.sku}
                                    </span>
                                )}
                                {item.notes && (
                                    <span className="text-xs text-gray-400 italic truncate">
                                        {item.notes}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {editingId === item.id ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number" min={1}
                                            value={editQty}
                                            onChange={e => setEditQty(Number(e.target.value))}
                                            className="w-14 border border-blue-400 rounded
                                                       px-1.5 py-0.5 text-sm text-center
                                                       bg-white dark:bg-neutral-800
                                                       focus:outline-none"
                                        />
                                        <button onClick={() => handleUpdateQty(item)}
                                            className="text-xs text-blue-500 hover:text-blue-600">
                                            ✓
                                        </button>
                                        <button onClick={() => setEditingId(null)}
                                            className="text-xs text-gray-400">
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            if (!canWrite) return;
                                            setEditingId(item.id);
                                            setEditQty(item.quantity);
                                        }}
                                        disabled={!canWrite}
                                        className={`text-xs px-2 py-0.5 rounded-full
                                            bg-neutral-100 dark:bg-neutral-800 text-gray-500
                                            ${canWrite
                                                ? 'hover:text-blue-500 cursor-pointer'
                                                : 'cursor-default'}`}
                                    >
                                        ×{item.quantity}
                                    </button>
                                )}

                                {canWrite && (
                                    <button onClick={() => handleDelete(item.id)}
                                        className="text-xs text-gray-300 hover:text-red-500
                                                   dark:text-gray-600 dark:hover:text-red-400
                                                   transition-colors">
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Карточка набора ───────────────────────────────────────────────────────

function AccessoryKitCard({ item, canWrite, axes, onDeleted }) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(item.name);
    const [saving, setSaving] = useState(false);

    const handleDelete = async () => {
        if (!confirming) { setConfirming(true); return; }
        setDeleting(true);
        const { ok } = await mediaApi.deleteAccessoryKit(item.id);
        if (ok) onDeleted();
        else { setDeleting(false); setConfirming(false); }
    };

    const handleSaveName = async () => {
        if (!name.trim() || name === item.name) { setEditing(false); return; }
        setSaving(true);
        const { ok } = await mediaApi.updateAccessoryKit(item.id, { name });
        if (ok) item.name = name;
        setSaving(false);
        setEditing(false);
    };

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                        border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Шапка карточки */}
            <div className="flex items-center justify-between px-5 py-3
                            border-b border-gray-100 dark:border-gray-800">
                {editing ? (
                    <div className="flex items-center gap-2 flex-1 mr-3">
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') { setName(item.name); setEditing(false); }
                            }}
                            className="flex-1 border border-blue-400 rounded px-2 py-0.5
                                       text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white focus:outline-none"
                        />
                        <button onClick={handleSaveName} disabled={saving}
                            className="text-xs text-blue-500 hover:text-blue-600">
                            {saving ? '···' : '✓'}
                        </button>
                        <button onClick={() => { setName(item.name); setEditing(false); }}
                            className="text-xs text-gray-400">✕</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900
                                         dark:text-white truncate">
                            {name}
                        </span>
                        {canWrite && (
                            <button onClick={() => setEditing(true)}
                                className="text-xs text-gray-300 hover:text-blue-500
                                           dark:text-gray-600 dark:hover:text-blue-400
                                           transition-colors shrink-0">
                                ✎
                            </button>
                        )}
                    </div>
                )}

                {canWrite && (
                    <div className="flex items-center gap-2 shrink-0">
                        {confirming ? (
                            <>
                                <button onClick={handleDelete} disabled={deleting}
                                    className="text-xs text-red-600 hover:text-red-800
                                               font-medium transition-colors">
                                    {deleting ? '···' : 'Удалить?'}
                                </button>
                                <button onClick={() => setConfirming(false)}
                                    className="text-xs text-gray-400 hover:text-gray-600">
                                    Отмена
                                </button>
                            </>
                        ) : (
                            <button onClick={handleDelete}
                                className="text-xs text-gray-300 hover:text-red-500
                                           dark:text-gray-600 dark:hover:text-red-400
                                           transition-colors">
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Фильтры по осям */}
            <FiltersPanel
                entityId={item.id}
                entityType="accessory-kit"
                initialFilters={item.filters || []}
                axes={axes}
                canWrite={canWrite}
            />

            {/* Прямая привязка к изделиям */}
            <DirectProductsPanel
                entityId={item.id}
                entityType="accessory-kit"
                canWrite={canWrite}
            />

            {/* Позиции набора */}
            <KitItemsPanel
                kitId={item.id}
                initialItems={item.items || []}
                canWrite={canWrite}
            />
        </div>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function AccessoryKitsPage() {
    const { user } = useAuth();
    const canWrite = can(user, 'catalog.accessory.write');
    const { items, loading, error, reload } = useAccessoryKits();
    const { axes } = useFormData();
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = search.trim()
        ? items.filter(i =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.description?.toLowerCase().includes(search.toLowerCase())
        )
        : items;

    return (
        <div className="space-y-4">
            {/* Шапка */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4
                            flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Наборы комплектующих
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Автоматика и дополнительное оборудование для изделий
                    </p>
                </div>
                {canWrite && (
                    <button onClick={() => setShowCreate(o => !o)}
                        className={`text-sm px-4 py-2 rounded-lg transition-colors ${showCreate
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}>
                        {showCreate ? '← Назад' : '+ Создать набор'}
                    </button>
                )}
            </div>

            {showCreate && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5 max-w-lg">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                        Новый набор комплектующих
                    </h3>
                    <KitCreateForm
                        onSaved={() => { reload(); setShowCreate(false); }}
                        onCancel={() => setShowCreate(false)}
                    />
                </div>
            )}

            {/* Поиск */}
            {!showCreate && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
                    <input
                        type="search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по названию..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                                   px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                   text-gray-900 dark:text-white
                                   placeholder-gray-400 dark:placeholder-gray-500
                                   focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            )}

            {loading ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8
                                text-center text-gray-400 text-sm">
                    Загрузка...
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200
                                dark:border-red-800 rounded-lg p-4 text-sm
                                text-red-700 dark:text-red-400">
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center">
                    <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                        {search ? 'Ничего не найдено' : 'Наборов пока нет'}
                    </p>
                    {!search && canWrite && (
                        <button onClick={() => setShowCreate(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white
                                       text-sm px-4 py-2 rounded-lg transition-colors">
                            + Создать первый набор
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                        {filtered.length} наборов
                        {search && (
                            <button onClick={() => setSearch('')}
                                className="ml-3 text-blue-500 hover:text-blue-700">
                                Сбросить ×
                            </button>
                        )}
                    </div>
                    {filtered.map(item => (
                        <AccessoryKitCard
                            key={item.id}
                            item={item}
                            canWrite={canWrite}
                            axes={axes}
                            onDeleted={reload}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}