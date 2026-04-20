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
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.is_required
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

// ── Правила набора ────────────────────────────────────────────────────────

function RuleItem({ kitId, ruleId, item, canWrite, onDeleted }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        await mediaApi.deleteAccessoryKitRuleItem(kitId, ruleId, item.id);
        onDeleted(item.id);
        setDeleting(false);
    };

    return (
        <div className="flex items-center justify-between py-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-gray-900 dark:text-white truncate">
                    {item.name}
                </span>
                {item.sku && (
                    <span className="text-xs text-gray-400 font-mono shrink-0">
                        {item.sku}
                    </span>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded-full
                                 bg-neutral-100 dark:bg-neutral-800 text-gray-500 shrink-0">
                    ×{item.quantity}
                </span>
            </div>
            {canWrite && (
                <button onClick={handleDelete} disabled={deleting}
                    className="text-xs text-gray-300 hover:text-red-500
                               dark:text-gray-600 dark:hover:text-red-400
                               transition-colors shrink-0">
                    {deleting ? '···' : '✕'}
                </button>
            )}
        </div>
    );
}

function RuleCard({ kitId, rule, canWrite, onUpdated, onDeleted }) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [items, setItems] = useState(rule.rule_items || []);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!search || search.length < 2) { setResults([]); return; }
        setSearching(true);
        catalogApi.searchProducts(search, { limit: 10 })
            .then(({ ok, data }) => { if (ok) setResults(data.data || []); })
            .finally(() => setSearching(false));
    }, [search]);

    const handleAddItem = async (product) => {
        const { ok, data } = await mediaApi.addAccessoryKitRuleItem(kitId, rule.id, {
            accessory_id: product.id,
            quantity: 1,
        });
        if (ok && data.success) {
            setItems(prev => [...prev, data.item]);
            setSearch('');
            setResults([]);
            setAdding(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        await mediaApi.deleteAccessoryKitRule(kitId, rule.id);
        onDeleted(rule.id);
    };

    // Метка правила
    const ruleParts = [];
    if (rule.quantity_from != null || rule.quantity_to != null) {
        const from = rule.quantity_from ?? '1';
        const to = rule.quantity_to ?? '∞';
        ruleParts.push(`Кол-во: ${from}–${to}`);
    }
    if (rule.is_manual != null) {
        ruleParts.push(rule.is_manual ? 'Ручное' : 'Авто');
    }
    if (rule.power_from != null || rule.power_to != null) {
        const from = rule.power_from ?? '0';
        const to = rule.power_to ?? '∞';
        ruleParts.push(`Мощность: ${from}–${to} кВт`);
    }
    if (ruleParts.length === 0) ruleParts.push('Всегда');

    return (
        <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
            {/* Шапка правила */}
            <div className="flex items-center justify-between px-3 py-2
                            bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex flex-wrap gap-1.5">
                    {ruleParts.map((part, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full
                                                  bg-blue-50 dark:bg-blue-950
                                                  border border-blue-200 dark:border-blue-800
                                                  text-blue-700 dark:text-blue-300">
                            {part}
                        </span>
                    ))}
                    {rule.priority > 0 && (
                        <span className="text-xs text-gray-400">
                            приор. {rule.priority}
                        </span>
                    )}
                </div>
                {canWrite && (
                    <button onClick={handleDelete} disabled={deleting}
                        className="text-xs text-gray-300 hover:text-red-500
                                   dark:text-gray-600 dark:hover:text-red-400
                                   transition-colors ml-2 shrink-0">
                        {deleting ? '···' : '✕'}
                    </button>
                )}
            </div>

            {/* Позиции правила */}
            <div className="px-3 py-2 space-y-0.5">
                {items.map(item => (
                    <RuleItem
                        key={item.id}
                        kitId={kitId}
                        ruleId={rule.id}
                        item={item}
                        canWrite={canWrite}
                        onDeleted={(id) => setItems(prev => prev.filter(i => i.id !== id))}
                    />
                ))}

                {/* Добавить изделие в правило */}
                {canWrite && (
                    adding ? (
                        <div className="pt-1 space-y-1">
                            <div className="relative">
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Поиск изделия..."
                                    className="w-full border border-gray-200 dark:border-gray-700
                                               rounded px-2 py-1 text-xs bg-white dark:bg-neutral-800
                                               text-gray-900 dark:text-white focus:outline-none
                                               focus:ring-1 focus:ring-blue-500"
                                />
                                {searching && (
                                    <span className="absolute right-2 top-1.5 text-xs
                                                     text-gray-400 animate-pulse">···</span>
                                )}
                            </div>
                            {results.length > 0 && (
                                <div className="border border-gray-100 dark:border-gray-800
                                                rounded overflow-hidden">
                                    {results.map(p => (
                                        <button key={p.id} onClick={() => handleAddItem(p)}
                                            className="flex items-center justify-between w-full
                                                       px-2 py-1.5 text-left hover:bg-neutral-50
                                                       dark:hover:bg-neutral-800 transition-colors
                                                       border-b border-gray-50 dark:border-gray-800
                                                       last:border-0">
                                            <span className="text-xs text-gray-900 dark:text-white">
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
                                className="text-xs text-gray-400 hover:text-gray-600">
                                Отмена
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setAdding(true)}
                            className="text-xs text-blue-500 hover:text-blue-600
                                       dark:hover:text-blue-400 transition-colors pt-1">
                            + Добавить изделие
                        </button>
                    )
                )}
            </div>
        </div>
    );
}

function RulesPanel({ kitId, initialRules, canWrite }) {
    const [rules, setRules] = useState(initialRules || []);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        quantity_from: '', quantity_to: '',
        is_manual: '',
        power_from: '', power_to: '',
        priority: 0,
    });
    const [saving, setSaving] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            quantity_from: form.quantity_from || null,
            quantity_to: form.quantity_to || null,
            is_manual: form.is_manual === '' ? null : form.is_manual === 'true',
            power_from: form.power_from || null,
            power_to: form.power_to || null,
            priority: Number(form.priority) || 0,
        };
        const { ok, data } = await mediaApi.createAccessoryKitRule(kitId, payload);
        if (ok && data.success) {
            setRules(prev => [...prev, data.rule]);
            setShowForm(false);
            setForm({ quantity_from: '', quantity_to: '', is_manual: '', power_from: '', power_to: '', priority: 0 });
        }
        setSaving(false);
    };

    const inp = "border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-1 focus:ring-blue-500";

    return (
        <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    Правила подбора
                </span>
                {canWrite && !showForm && (
                    <button onClick={() => setShowForm(true)}
                        className="text-xs text-blue-500 hover:text-blue-600
                                   dark:hover:text-blue-400 transition-colors">
                        + Добавить правило
                    </button>
                )}
            </div>

            {/* Форма нового правила */}
            {showForm && (
                <form onSubmit={handleCreate}
                    className="mb-3 p-3 border border-gray-200 dark:border-gray-700
                               rounded-lg bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
                    <div className="flex flex-wrap gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Кол-во от</label>
                            <input type="number" min="1" value={form.quantity_from}
                                onChange={e => setForm(f => ({ ...f, quantity_from: e.target.value }))}
                                placeholder="—" className={inp} style={{ width: 70 }} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Кол-во до</label>
                            <input type="number" min="1" value={form.quantity_to}
                                onChange={e => setForm(f => ({ ...f, quantity_to: e.target.value }))}
                                placeholder="∞" className={inp} style={{ width: 70 }} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Управление</label>
                            <select value={form.is_manual}
                                onChange={e => setForm(f => ({ ...f, is_manual: e.target.value }))}
                                className={inp} style={{ width: 100 }}>
                                <option value="">Любое</option>
                                <option value="false">Авто</option>
                                <option value="true">Ручное</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Мощность от, кВт</label>
                            <input type="number" step="0.01" value={form.power_from}
                                onChange={e => setForm(f => ({ ...f, power_from: e.target.value }))}
                                placeholder="—" className={inp} style={{ width: 80 }} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Мощность до, кВт</label>
                            <input type="number" step="0.01" value={form.power_to}
                                onChange={e => setForm(f => ({ ...f, power_to: e.target.value }))}
                                placeholder="∞" className={inp} style={{ width: 80 }} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Приоритет</label>
                            <input type="number" min="0" value={form.priority}
                                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                className={inp} style={{ width: 60 }} />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="submit" disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                       text-white text-xs font-medium px-3 py-1.5
                                       rounded-lg transition-colors">
                            {saving ? '···' : 'Создать'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
                            Отмена
                        </button>
                    </div>
                </form>
            )}

            {/* Список правил */}
            {rules.length === 0 && !showForm ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">Правил нет</p>
            ) : (
                <div className="space-y-2">
                    {rules.map(rule => (
                        <RuleCard
                            key={rule.id}
                            kitId={kitId}
                            rule={rule}
                            canWrite={canWrite}
                            onDeleted={(id) => setRules(prev => prev.filter(r => r.id !== id))}
                        />
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
    const [isManual, setIsManual] = useState(item.is_manual);

    const handleToggleManual = async () => {
        const { ok } = await mediaApi.updateAccessoryKit(item.id, { is_manual: !isManual });
        if (ok) setIsManual(v => !v);
    };

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

            {/* Переключатель режима */}
            {canWrite && (
                <div className="px-5 pb-3 flex items-center gap-2">
                    <button
                        onClick={handleToggleManual}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer
                        rounded-full border-2 border-transparent transition-colors
                        ${isManual
                                ? 'bg-blue-600'
                                : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full
                              bg-white shadow transform transition-transform
                              ${isManual ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isManual ? 'Ручное управление набором' : 'Автоподбор по правилам'}
                    </span>
                </div>
            )}

            <RulesPanel
                kitId={item.id}
                initialRules={item.rules || []}
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