import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../api/auth';
import { parseError, translitSlug } from '../utils';
import Modal from '../components/common/Modal';
import { useModals } from '../hooks/useModals';
import ChainOperationModal from '../components/catalog/ChainOperationModal';
import ChainCheckModal from '../components/catalog/ChainCheckModal';
import { catalogApi } from '../api/catalog';

const API = '/api/v1/catalog';

function parseApiError(data, status) {
    // 401 — не авторизован (parseError общего назначения такого случая не знает)
    if (status === 401) return 'Необходима авторизация';
    // 403 — нет прав, с более подробным дефолтным текстом, чем в parseError
    if (status === 403 && !data?.detail) return 'Недостаточно прав для выполнения операции';
    return parseError(data, status);
}

// ── Хук загрузки данных ───────────────────────────────────────────────────

function useProductTypes() {
    const [types, setTypes] = useState([]);
    useEffect(() => {
        apiFetch(`${API}/product-types/`)
            .then(r => r.json())
            .then(data => setTypes(Array.isArray(data) ? data : (data.results || [])));
    }, []);
    return types;
}

// Счётчик ошибок цепочки по типам: {typeId: errors[]}
function useChainSummary() {
    const [summary, setSummary] = useState({});
    const reload = useCallback(() => {
        catalogApi.chainSummary().then(({ ok, data }) => {
            const list = ok ? (Array.isArray(data) ? data : data?.data) : null;
            if (Array.isArray(list)) setSummary(Object.fromEntries(list.map(t => [t.id, t.errors ?? []])));
        }).catch(() => {});
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return [summary, reload];
}

// Следующий order для оси в типе: справочная — в конец, классификационная — после последней
// классификационной. Возвращает { order, last }.
export function nextAxisOrder(typeAxes, axisType) {
    const pool = axisType === 'reference' ? typeAxes : typeAxes.filter(a => a.axis_type !== 'reference');
    const last = pool.reduce((m, a) => (!m || a.order > m.order ? a : m), null);
    return { order: last ? last.order + 1 : 0, last };
}

function AxisOrderPanel({ axis, onChainChanged }) {
    const [orders, setOrders] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    const [addTypeId, setAddTypeId] = useState('');
    const [addOrder, setAddOrder] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState(null);   // { last, typeAxes } для выбранного типа
    const [chainOp, setChainOp] = useState(null);   // { op, typeId, typeName } — диалог операции с цепочкой
    const hintReq = useRef(0);
    const isClassifier = axis.axis_type !== 'reference';

    // Оси выбранного типа: собственные + общие через AxisOrder (кроме текущей)
    const selectType = async (typeId) => {
        setAddTypeId(typeId);
        setHint(null);
        const req = ++hintReq.current;
        if (!typeId) { setAddOrder(0); return; }
        try {
            const [r1, r2] = await Promise.all([
                apiFetch(`${API}/parameter-axes/?product_type=${typeId}`),
                apiFetch(`${API}/axis-orders/?product_type=${typeId}`),
            ]);
            const [own, shared] = (await Promise.all([r1.json(), r2.json()]))
                .map(d => (Array.isArray(d) ? d : (d.results || [])));
            if (req !== hintReq.current) return;
            const typeAxes = [
                ...own.map(a => ({ id: a.id, name: a.name, order: a.order, axis_type: a.axis_type })),
                ...shared.map(o => ({ id: o.axis, name: o.axis_name, order: o.order, axis_type: o.axis_type })),
            ].filter(a => a.id !== axis.id);
            const next = nextAxisOrder(typeAxes, axis.axis_type);
            setHint({ last: next.last, typeAxes });
            setAddOrder(next.order);
        } catch { /* order остаётся ручным */ }
    };

    const load = async () => {
        const [r1, r2] = await Promise.all([
            apiFetch(`${API}/axis-orders/?axis=${axis.id}`),  // ← нужен фильтр по axis
            apiFetch(`${API}/product-types/`),
        ]);
        const d1 = await r1.json();
        const d2 = await r2.json();
        setOrders(Array.isArray(d1) ? d1 : (d1.results || []));
        setProductTypes(Array.isArray(d2) ? d2 : (d2.results || []));
    };

    useEffect(() => { load(); }, [axis.id]);

    const handleAdd = async () => {
        if (!addTypeId) return;
        // Классификационная ось встаёт в цепочку только структурной операцией
        if (isClassifier) {
            const pt = productTypes.find(t => String(t.id) === String(addTypeId));
            setChainOp({ op: 'insert', typeId: addTypeId, typeName: pt?.name });
            return;
        }
        setLoading(true);
        await apiFetch(`${API}/axis-orders/`, {
            method: 'POST',
            body: JSON.stringify({
                product_type: addTypeId,
                axis: axis.id,
                order: addOrder,
            }),
        });
        setAddTypeId('');
        setAddOrder(0);
        setHint(null);
        await load();
        setLoading(false);
    };

    const taken = hint?.typeAxes.find(a => a.order === addOrder);

    const handleDelete = async (o) => {
        if (isClassifier) {
            setChainOp({ op: 'remove', typeId: o.product_type, typeName: o.product_type_name });
            return;
        }
        await apiFetch(`${API}/axis-orders/${o.id}/`, { method: 'DELETE' });
        await load();
    };

    const inp = "border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Привязка к типам продукции (AxisOrder)
            </div>

            {/* Существующие привязки */}
            {orders.length === 0 ? (
                <div className="text-xs text-gray-400 mb-3">Нет привязок</div>
            ) : (
                <div className="space-y-1 mb-3">
                    {orders.map(o => (
                        <div key={o.id}
                            className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-950
                                       border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {o.product_type_name}
                                {!isClassifier && <span className="ml-2 text-xs text-gray-400">order: {o.order}</span>}
                            </span>
                            <button
                                onClick={() => handleDelete(o)}
                                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Добавить привязку */}
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Тип продукции</label>
                    <select
                        value={addTypeId}
                        onChange={e => selectType(e.target.value)}
                        className={`w-full ${inp}`}
                    >
                        <option value="">— выберите —</option>
                        {productTypes
                            .filter(pt => !orders.find(o => o.product_type === pt.id))
                            .map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                            ))}
                    </select>
                </div>
                {!isClassifier && <div className="w-20">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Order</label>
                    <input
                        type="number"
                        value={addOrder}
                        onChange={e => setAddOrder(parseInt(e.target.value) || 0)}
                        className={`w-full ${inp}`}
                    />
                </div>}
                <button
                    onClick={handleAdd}
                    disabled={!addTypeId || loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                               text-white text-xs px-3 py-2 rounded-lg transition-colors"
                >
                    {loading ? '...' : '+ Добавить'}
                </button>
            </div>
            {hint && !isClassifier && (
                <div className="mt-1 text-xs text-gray-400">
                    {hint.last ? `последняя ось: ${hint.last.name} (order ${hint.last.order})` : 'у типа ещё нет осей'}
                    {taken && (
                        <span className="ml-2 text-amber-500">
                            ⚠ order {addOrder} уже у {taken.axis_type === 'reference' ? 'справочной' : 'классификационной'} оси «{taken.name}»
                        </span>
                    )}
                </div>
            )}
            {chainOp && (
                <ChainOperationModal {...chainOp} axis={axis}
                    onClose={() => setChainOp(null)}
                    onApplied={() => { setAddTypeId(''); setHint(null); load(); onChainChanged?.(); }} />
            )}
        </div>
    );
}


function FilterRulesEditor({ value, onChange, productTypeId }) {
    const [axes, setAxes] = useState([]);
    const [axisValues, setAxisValues] = useState([]);
    const [selectedAxisId, setSelectedAxisId] = useState('');
    const [selectedValues, setSelectedValues] = useState(value?.allowedValues || []);

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    // Загружаем все classifier-оси
    useEffect(() => {
        apiFetch(`${API}/parameter-axes/`)
            .then(r => r.json())
            .then(data => {
                const all = Array.isArray(data) ? data : (data.results || []);
                const filtered = all.filter(a => a.axis_type === 'classifier');
                setAxes(filtered);
                // Восстанавливаем выбранную ось из value.parentParam
                if (value?.parentParam) {
                    const found = filtered.find(a => a.code === value.parentParam);
                    if (found) setSelectedAxisId(String(found.id));
                }
            });
    }, []);

    // Загружаем значения при смене оси
    useEffect(() => {
        if (!selectedAxisId) { setAxisValues([]); return; }
        apiFetch(`${API}/parameter-values/?axis=${selectedAxisId}&is_active=true`)
            .then(r => r.json())
            .then(data => setAxisValues(Array.isArray(data) ? data : (data.results || [])));
    }, [selectedAxisId]);

    const handleAxisChange = (axisId) => {
        setSelectedAxisId(axisId);
        setSelectedValues([]);
        const axis = axes.find(a => String(a.id) === axisId);
        onChange({
            parentAxisId: axis?.id,      // ← добавь
            parentParam: axis?.code || '',
            allowedValues: [],
        });
    };

    const toggleValue = (val) => {
        const axis = axes.find(a => String(a.id) === selectedAxisId);
        const next = selectedValues.includes(val)
            ? selectedValues.filter(v => v !== val)
            : [...selectedValues, val];
        setSelectedValues(next);
        onChange({
            parentAxisId: axis?.id,      // ← добавь
            parentParam: axis?.code || '',
            allowedValues: next,
        });
    };

    const selectedAxis = axes.find(a => String(a.id) === selectedAxisId);

    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Правила фильтрации
            </label>

            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Родительская ось
                </label>
                <select
                    value={selectedAxisId}
                    onChange={e => handleAxisChange(e.target.value)}
                    className={inp}
                >
                    <option value="">— выберите ось —</option>
                    {axes.map(a => (
                        <option key={a.id} value={a.id}>
                            {a.product_type_name
                                ? `${a.name} — ${a.product_type_name} (${a.code})`
                                : `${a.name} (${a.code})`}
                        </option>
                    ))}
                </select>
            </div>

            {selectedAxisId && axisValues.length > 0 && (
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Показывать только при значениях <span className="text-gray-400">(мультивыбор)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {axisValues.map(v => {
                            const isSelected = selectedValues.includes(v.value);
                            return (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => toggleValue(v.value)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all
                                        ${isSelected
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-neutral-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-neutral-200'
                                        }`}
                                >
                                    {v.value}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {selectedAxisId && (
                <div className="bg-neutral-50 dark:bg-neutral-950 rounded-lg px-3 py-2 font-mono text-xs text-gray-500">
                    {JSON.stringify({ parentParam: selectedAxis?.code, allowedValues: selectedValues }, null, 2)}
                </div>
            )}
        </div>
    );
}

// ── Форма оси ─────────────────────────────────────────────────────────────

function AxisForm({ productTypeId, isGlobal, axis, axes = [], onSave, onClose }) {
    const [form, setForm] = useState({
        name: axis?.name || '',
        code: axis?.code || '',
        order: axis?.order ?? nextAxisOrder(axes, 'classifier').order,
        axis_type: axis?.axis_type || 'classifier',
        filter_rules: axis?.filter_rules || {},
        ...(!isGlobal && { product_type: productTypeId }),
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inChain = !!axis && axis.axis_type !== 'reference' && axis.is_active !== false;
    const orderTouched = useRef(false);

    // Новая классификационная ось встаёт только в конец цепочки: order = длина цепочки (с учётом общих осей)
    useEffect(() => {
        if (axis || isGlobal || !productTypeId) return;
        catalogApi.chainAnalyze(productTypeId).then(({ ok, data }) => {
            const len = ok ? data?.data?.chain?.length : null;
            if (Number.isInteger(len) && !orderTouched.current) setForm(f => (f.axis_type === 'reference' ? f : { ...f, order: len }));
        }).catch(() => {});
    }, [axis, isGlobal, productTypeId]);

    // Автогенерация code из name (только при создании)
    const handleNameChange = (e) => {
        const name = e.target.value;
        setForm(f => ({
            ...f,
            name,
            // code — транслит названия (можно поправить руками)
            ...(!axis && { code: translitSlug(name) }),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const url = axis ? `${API}/parameter-axes/${axis.id}/` : `${API}/parameter-axes/`;
        const method = axis ? 'PATCH' : 'POST';
        // У оси, уже стоящей в цепочке, order/тип/тип продукции меняет только операция с цепочкой — не шлём
        const body = { ...form };
        if (axis && inChain) { delete body.order; delete body.axis_type; delete body.product_type; }

        try {
            const res = await apiFetch(url, { method, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) { onSave(data); onClose(); }
            else setError(parseApiError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Название</label>
                <input required value={form.name} onChange={handleNameChange}
                    placeholder="Дизайн" className={inp} />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">
                    Код <span className="text-gray-400 dark:text-gray-500 font-normal">(латиница, используется в API)</span>
                </label>
                <input required value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="design" className={inp} />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Порядок (order)</label>
                <input type="number" required value={form.order} disabled={inChain}
                    onChange={e => { orderTouched.current = true; setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 })); }}
                    className={`${inp} disabled:opacity-50`} />
                {inChain && (
                    <p className="mt-1 text-xs text-gray-400">Ось в цепочке — порядок меняется кнопками ↑ ↓ ⇅ в списке осей.</p>
                )}
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Тип оси
                </label>
                <select
                    value={form.axis_type || 'classifier'}
                    disabled={!!axis && axis.axis_type !== 'reference' && axis.is_active !== false}
                    onChange={e => setForm(f => ({
                        ...f,
                        axis_type: e.target.value,
                        // новая ось — предлагаем следующий order для выбранного типа
                        ...(!axis && { order: nextAxisOrder(axes, e.target.value).order }),
                    }))}
                    className={inp}
                >
                    <option value="classifier">Классификационная (граф)</option>
                    <option value="reference">Справочная (боковая)</option>
                </select>
            </div>
            {form.axis_type === 'reference' && (
                <FilterRulesEditor
                    value={form.filter_rules}
                    onChange={rules => setForm(f => ({ ...f, filter_rules: rules }))}
                    productTypeId={productTypeId}
                />
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:bg-neutral-950">
                    Отмена
                </button>
                <button type="submit" disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     text-white text-sm py-2 rounded-lg transition-colors">
                    {loading ? 'Сохранение...' : (axis ? 'Сохранить' : 'Создать')}
                </button>
            </div>
        </form>
    );
}

// ── Форма значения ────────────────────────────────────────────────────────

function ValueForm({ axisId, value, nextSort = 0, onSave, onClose }) {
    const [form, setForm] = useState({
        axis: axisId,
        value: value?.value || '',
        sort_order: value?.sort_order ?? nextSort,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const url = value ? `${API}/parameter-values/${value.id}/` : `${API}/parameter-values/`;
        const method = value ? 'PATCH' : 'POST';

        try {
            const res = await apiFetch(url, { method, body: JSON.stringify(form) });
            const data = await res.json();
            if (res.ok) { onSave(data); onClose(); }
            else setError(parseApiError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Значение</label>
                <input required autoFocus value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="Комфорт" className={inp} />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Порядок сортировки</label>
                <input type="number" value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className={inp} />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:bg-neutral-950">
                    Отмена
                </button>
                <button type="submit" disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                     text-white text-sm py-2 rounded-lg transition-colors">
                    {loading ? 'Сохранение...' : (value ? 'Сохранить' : 'Добавить')}
                </button>
            </div>
        </form>
    );
}

// ── Панель значений оси ───────────────────────────────────────────────────

function ValuesPanel({ axis }) {
    const [values, setValues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'add' | value-object
    const { showConfirm, modals } = useModals();

    const load = async () => {
        setLoading(true);
        const res = await apiFetch(`${API}/parameter-values/?axis=${axis.id}`);
        const data = await res.json();
        setValues(
            (Array.isArray(data) ? data : (data.results || []))
                .sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value))
        );
        setLoading(false);
    };

    useEffect(() => { load(); }, [axis.id]);

    // Следующий sort_order — после максимального из уже введённых
    const nextSort = values.length ? Math.max(...values.map(v => v.sort_order ?? 0)) + 1 : 0;

    const handleDelete = (id) => {
        showConfirm('Удалить значение?', async () => {
            await apiFetch(`${API}/parameter-values/${id}/`, { method: 'DELETE' });
            setValues(v => v.filter(x => x.id !== id));
        });
    };

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Значения оси <span className="text-blue-600">«{axis.name}»</span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">code: {axis.code}</span>
                </span>
                <button onClick={() => setModal('add')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs
                     px-3 py-1.5 rounded-lg transition-colors">
                    + Добавить значение
                </button>
            </div>

            {loading ? (
                <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Загрузка...</div>
            ) : values.length === 0 ? (
                <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center border-2 border-dashed
                        border-gray-200 dark:border-gray-700 rounded-lg">
                    Нет значений. Добавьте первое.
                </div>
            ) : (
                <div className="space-y-1">
                    {values.map(v => (
                        <div key={v.id}
                            className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-700 dark:bg-neutral-800
                         border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 group transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">{v.sort_order}</span>
                                <span className="text-sm text-gray-800 dark:text-gray-200">{v.value}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setModal(v)}
                                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1
                             hover:bg-blue-50 rounded transition-colors">
                                    Изменить
                                </button>
                                <button onClick={() => handleDelete(v.id)}
                                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1
                             hover:bg-red-50 rounded transition-colors">
                                    Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Быстрое добавление нескольких значений */}
            <BulkAddValues axisId={axis.id} startOrder={nextSort} onAdded={load} />

            {/* Модалки */}
            {modal === 'add' && (
                <Modal title="Новое значение" onClose={() => setModal(null)}>
                    <ValueForm axisId={axis.id} nextSort={nextSort}
                        onSave={v => { setValues(vs => [...vs, v]); load(); }}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal && modal !== 'add' && (
                <Modal title="Редактировать значение" onClose={() => setModal(null)}>
                    <ValueForm axisId={axis.id} value={modal}
                        onSave={() => load()}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
            {modals}
        </div>
    );
}

// ── Быстрое массовое добавление ───────────────────────────────────────────

function BulkAddValues({ axisId, startOrder = 0, onAdded }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleBulk = async () => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;

        setLoading(true);
        setResult(null);

        let created = 0;
        let errors = 0;
        let lastError = '';  // ← была не объявлена

        for (let i = 0; i < lines.length; i++) {
            const res = await apiFetch(`${API}/parameter-values/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ axis: axisId, value: lines[i], sort_order: startOrder + i }),
            });
            if (res.ok) {
                created++;
            } else {
                errors++;
                if (!lastError) {
                    const data = await res.json();
                    lastError = parseApiError(data, res.status);
                }
            }
        }  // ← эта закрывающая скобка отсутствовала

        setResult({ created, errors, errorMessage: lastError });
        setLoading(false);
        if (created > 0) { setText(''); onAdded(); }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="mt-3 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 underline">
                Добавить несколько значений сразу
            </button>
        );
    }

    return (
        <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-950">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500">
                    Массовое добавление — каждое значение с новой строки
                </span>
                <button onClick={() => { setOpen(false); setResult(null); }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 text-sm">✕</button>
            </div>
            <textarea
                value={text} onChange={e => setText(e.target.value)}
                rows={5} placeholder={"Комфорт\nОптима\nПремиум\nЭконом"}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                     bg-neutral-50 dark:bg-neutral-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            {result && (
                <div className="mt-1 space-y-1">
                    {result.created > 0 && (
                        <div className="text-xs text-emerald-700">
                            ✓ Добавлено: {result.created}
                        </div>
                    )}
                    {result.errors > 0 && (
                        <div className="text-xs text-red-600">
                            ✗ Ошибок: {result.errors} — {result.errorMessage}
                        </div>
                    )}
                </div>
            )}
            <button onClick={handleBulk} disabled={loading || !text.trim()}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                     text-white text-sm py-2 rounded-lg transition-colors">
                {loading ? 'Добавляю...' : `Добавить ${text.split('\n').filter(l => l.trim()).length} значений`}
            </button>
        </div>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function ParameterEditorPage({ onChainChanged }) {
    const productTypes = useProductTypes();
    const [chainSummary, reloadSummary] = useChainSummary();
    const [chainOp, setChainOp] = useState(null);     // { op, axis } — диалог операции
    const [checkOpen, setCheckOpen] = useState(false);
    const [mode, setMode] = useState('typed');
    const [typeId, setTypeId] = useState('');
    const [axes, setAxes] = useState([]);
    const [selectedAxis, setSelectedAxis] = useState(null);
    const [loadingAxes, setLoadingAxes] = useState(false);
    const [modal, setModal] = useState(null); // null | 'add-axis' | axis-object
    const { showConfirm, modals } = useModals();

    const [axesVersion, setAxesVersion] = useState(0);
    const reloadAxes = () => { setAxesVersion(v => v + 1); reloadSummary(); onChainChanged?.(); };

    // Загрузка осей при выборе типа
    useEffect(() => {
        if (mode === 'typed' && !typeId) { setAxes([]); setSelectedAxis(null); return; }
        setLoadingAxes(true);
        setSelectedAxis(null);

        const url = mode === 'global'
            ? `${API}/parameter-axes/?product_type=global`   // ← новый query param
            : `${API}/parameter-axes/?product_type=${typeId}`;

        apiFetch(url)
            .then(r => r.json())
            .then(data => {
                const list = (Array.isArray(data) ? data : (data.results || []))
                    .sort((a, b) => a.order - b.order);
                setAxes(list);
                setLoadingAxes(false);
            });
    }, [typeId, mode, axesVersion]);

    const handleDeleteAxis = async (axis) => {
        // Сначала пробуем обычное удаление
        const res = await apiFetch(`${API}/parameter-axes/${axis.id}/`, { method: 'DELETE' });

        if (res.ok || res.status === 204) {
            setAxes(ax => ax.filter(a => a.id !== axis.id));
            if (selectedAxis?.id === axis.id) setSelectedAxis(null);
            return;
        }

        // Если 409/400 — есть привязки, предлагаем force delete
        const errData = await res.json().catch(() => ({}));
        // Ось стоит в цепочке типа — удаление только операцией «убрать из цепочки»
        if (errData?.error?.code === 'CHAIN_OPERATION_REQUIRED') {
            setChainOp({ op: 'remove', axis, typeId: mode === 'typed' ? typeId : errData.error.product_types?.[0]?.id });
            return;
        }
        showConfirm(
            `Ось «${axis.name}» имеет привязки к товарам.\n\n` +
            `Удалить ось вместе со всеми привязками товаров?`,
            async () => {
                const res2 = await apiFetch(`${API}/parameter-axes/${axis.id}/force-delete/`, {
                    method: 'DELETE',
                });
                const data2 = await res2.json();
                if (data2?.error?.code === 'CHAIN_OPERATION_REQUIRED') {
                    setChainOp({ op: 'remove', axis, typeId: mode === 'typed' ? typeId : data2.error.product_types?.[0]?.id });
                    return;
                }
                if (res2.ok && data2.success) {
                    setAxes(ax => ax.filter(a => a.id !== axis.id));
                    if (selectedAxis?.id === axis.id) setSelectedAxis(null);
                }
            }
        );
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        Редактор осей и значений
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0">
                        Создавайте оси параметров и заполняйте допустимые значения
                    </p>
                </div>

                {/* Переключатель режимов */}
                <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('typed')}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${mode === 'typed'
                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        По типу продукции
                    </button>
                    <button
                        onClick={() => setMode('global')}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${mode === 'global'
                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Общие оси
                    </button>
                </div>

                {/* Селектор типа — только в режиме typed */}
                {mode === 'typed' && (
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Тип продукции</label>
                        <select
                            value={typeId}
                            onChange={e => setTypeId(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600
                                       bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                                       rounded-lg px-3 py-2 text-sm focus:outline-none
                                       focus:ring-2 focus:ring-blue-500 min-w-48"
                        >
                            <option value="">— выберите —</option>
                            {productTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>
                                    {pt.name}{chainSummary[pt.id]?.length ? ` ⚠ ${chainSummary[pt.id].length}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {mode === 'typed' && typeId && (
                    <button onClick={() => setCheckOpen(true)}
                        title={(chainSummary[typeId] ?? []).map(e => e.message).join('\n')}
                        className={`self-end border text-sm px-3 py-2 rounded-lg transition-colors ${chainSummary[typeId]?.length
                            ? 'border-red-300 text-red-500 hover:bg-red-50'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                        Проверить цепочку{chainSummary[typeId]?.length ? ` (${chainSummary[typeId].length})` : ''}
                    </button>
                )}
            </div>

            {/* Заглушка если typed и не выбран тип */}
            {mode === 'typed' && !typeId && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                    Выберите тип продукции
                </div>
            )}

            {(mode === 'global' || (mode === 'typed' && typeId)) && (
                <div className="flex gap-4">
                    {/* Список осей — без изменений, только кнопка + Ось */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 w-64 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Оси параметров</span>
                            <button onClick={() => setModal('add-axis')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors">
                                + Ось
                            </button>
                        </div>
                        {/* остальное без изменений */}
                        {loadingAxes ? (
                            <div className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                        ) : axes.length === 0 ? (
                            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Нет осей</div>
                        ) : (
                            <div className="space-y-1">
                                {axes.map(axis => (
                                    <div key={axis.id}
                                        onClick={() => setSelectedAxis(axis)}
                                        className={`flex items-center justify-between rounded-lg px-3 py-2.5
                                            cursor-pointer group transition-colors ${selectedAxis?.id === axis.id
                                                ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800'
                                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'}`}>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{axis.name}</div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                                order: {axis.order} · {axis.values_count ?? '?'} зн.
                                                {axis.is_active === false && <span className="ml-1 text-amber-500">· не в цепочке</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                                            {mode === 'typed' && axis.axis_type !== 'reference' && (axis.is_active === false ? (
                                                <button onClick={e => { e.stopPropagation(); setChainOp({ op: 'insert', axis, typeId }); }}
                                                    className="text-xs text-emerald-500 hover:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40"
                                                    title="Вставить в цепочку">в цепочку</button>
                                            ) : (
                                                <>
                                                    <button onClick={e => { e.stopPropagation(); setChainOp({ op: 'move', axis, typeId, direction: 'up' }); }}
                                                        className="text-gray-400 hover:text-emerald-500 px-1 rounded hover:bg-emerald-500/10" title="Выше в цепочке">↑</button>
                                                    <button onClick={e => { e.stopPropagation(); setChainOp({ op: 'move', axis, typeId, direction: 'down' }); }}
                                                        className="text-gray-400 hover:text-emerald-500 px-1 rounded hover:bg-emerald-500/10" title="Ниже в цепочке">↓</button>
                                                    <button onClick={e => { e.stopPropagation(); setChainOp({ op: 'move', axis, typeId }); }}
                                                        className="text-gray-400 hover:text-emerald-500 px-1 rounded hover:bg-emerald-500/10" title="Переместить после оси…">⇅</button>
                                                </>
                                            ))}
                                            <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                                            <button onClick={e => { e.stopPropagation(); setModal(axis); }}
                                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" title="Редактировать">✎</button>
                                            <button onClick={e => { e.stopPropagation(); handleDeleteAxis(axis); }}
                                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Удалить">✕</button>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 flex-1 min-w-0">
                        {selectedAxis ? <ValuesPanel axis={selectedAxis} /> : (
                            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                                Выберите ось для редактирования значений
                            </div>
                        )}
                        {/* Привязка к типам продукции — только для общих осей */}
                        {selectedAxis && (
                            <AxisOrderPanel axis={selectedAxis} onChainChanged={onChainChanged} />
                        )}
                    </div>
                </div>
            )}

            {/* Модалки — передаём mode чтобы AxisForm знал нужен ли product_type */}
            {modal === 'add-axis' && (
                <Modal title="Новая ось параметра" onClose={() => setModal(null)}>
                    <AxisForm
                        productTypeId={mode === 'global' ? null : typeId}
                        isGlobal={mode === 'global'}
                        axes={axes}
                        onSave={axis => { setAxes(ax => [...ax, axis].sort((a, b) => a.order - b.order)); reloadSummary(); onChainChanged?.(); }}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal && modal !== 'add-axis' && (
                <Modal title="Редактировать ось" onClose={() => setModal(null)}>
                    <AxisForm
                        productTypeId={mode === 'global' ? null : typeId}
                        isGlobal={mode === 'global'}
                        axis={modal}
                        onSave={updated => setAxes(ax =>
                            ax.map(a => a.id === updated.id ? updated : a).sort((a, b) => a.order - b.order)
                        )}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
            {chainOp && (
                <ChainOperationModal
                    typeId={chainOp.typeId}
                    typeName={productTypes.find(t => String(t.id) === String(chainOp.typeId))?.name}
                    op={chainOp.op} axis={chainOp.axis} direction={chainOp.direction}
                    onClose={() => setChainOp(null)}
                    onApplied={reloadAxes} />
            )}
            {checkOpen && (
                <ChainCheckModal typeId={typeId}
                    typeName={productTypes.find(t => String(t.id) === String(typeId))?.name}
                    onClose={() => setCheckOpen(false)}
                    onChanged={reloadAxes} />
            )}
            {modals}
        </div>
    );
}