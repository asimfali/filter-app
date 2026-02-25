import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/auth';

const API = '/api/v1/catalog';

function parseApiError(data, status) {
    // 403 — нет прав
    if (status === 403) {
        return data?.detail || 'Недостаточно прав для выполнения операции';
    }
    // 401 — не авторизован
    if (status === 401) {
        return 'Необходима авторизация';
    }
    // Стандартные ошибки DRF: { field: ['ошибка'] } или { detail: '...' }
    if (data?.detail) return data.detail;
    if (typeof data === 'object') {
        return Object.values(data).flat().join(', ');
    }
    return 'Неизвестная ошибка';
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

// ── Модальное окно ────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 text-xl leading-none">✕</button>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    );
}

// ── Форма оси ─────────────────────────────────────────────────────────────

function AxisForm({ productTypeId, axis, onSave, onClose }) {
    const [form, setForm] = useState({
        name: axis?.name || '',
        code: axis?.code || '',
        order: axis?.order ?? 0,
        product_type: productTypeId,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Автогенерация code из name (только при создании)
    const handleNameChange = (e) => {
        const name = e.target.value;
        setForm(f => ({
            ...f,
            name,
            // Транслитерация не нужна — просто latin lowercase если редактируем новую
            ...(!axis && { code: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const url = axis ? `${API}/parameter-axes/${axis.id}/` : `${API}/parameter-axes/`;
        const method = axis ? 'PATCH' : 'POST';

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
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
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
                <input type="number" required value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                    className={inp} />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">
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

function ValueForm({ axisId, value, onSave, onClose }) {
    const [form, setForm] = useState({
        axis: axisId,
        value: value?.value || '',
        sort_order: value?.sort_order ?? 0,
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
            console.log('Ответ сервера:', data);
            if (res.ok) { onSave(data); onClose(); }
            else setError(parseApiError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
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
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">
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

    const handleDelete = async (id) => {
        if (!confirm('Удалить значение?')) return;
        await apiFetch(`${API}/parameter-values/${id}/`, { method: 'DELETE' });
        setValues(v => v.filter(x => x.id !== id));
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
                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800
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
            <BulkAddValues axisId={axis.id} onAdded={load} />

            {/* Модалки */}
            {modal === 'add' && (
                <Modal title="Новое значение" onClose={() => setModal(null)}>
                    <ValueForm axisId={axis.id}
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
        </div>
    );
}

// ── Быстрое массовое добавление ───────────────────────────────────────────

function BulkAddValues({ axisId, onAdded }) {
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
                body: JSON.stringify({ axis: axisId, value: lines[i], sort_order: i }),
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
        <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-950">
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

export default function ParameterEditorPage() {
    const productTypes = useProductTypes();
    const [typeId, setTypeId] = useState('');
    const [axes, setAxes] = useState([]);
    const [selectedAxis, setSelectedAxis] = useState(null);
    const [loadingAxes, setLoadingAxes] = useState(false);
    const [modal, setModal] = useState(null); // null | 'add-axis' | axis-object

    // Загрузка осей при выборе типа
    useEffect(() => {
        if (!typeId) { setAxes([]); setSelectedAxis(null); return; }
        setLoadingAxes(true);
        setSelectedAxis(null);
        apiFetch(`${API}/parameter-axes/?product_type=${typeId}`)
            .then(r => r.json())
            .then(data => {
                const list = (Array.isArray(data) ? data : (data.results || []))
                    .sort((a, b) => a.order - b.order);
                setAxes(list);
                setLoadingAxes(false);
            });
    }, [typeId]);

    const handleDeleteAxis = async (axis) => {
        if (!confirm(`Удалить ось «${axis.name}» и все её значения?`)) return;
        await apiFetch(`${API}/parameter-axes/${axis.id}/`, { method: 'DELETE' });
        setAxes(ax => ax.filter(a => a.id !== axis.id));
        if (selectedAxis?.id === axis.id) setSelectedAxis(null);
    };

    return (
        <div className="space-y-4">

            {/* Заголовок + выбор типа */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        Редактор осей и значений
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        Создавайте оси параметров и заполняйте допустимые значения
                    </p>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Тип продукции</label>
                    <select
                        value={typeId}
                        onChange={e => setTypeId(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600
             bg-white dark:bg-gray-800
             text-gray-900 dark:text-white
             rounded-lg px-3 py-2 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
                    >
                        <option value="">— выберите —</option>
                        {productTypes.map(pt => (
                            <option key={pt.id} value={pt.id}>{pt.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!typeId && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                    Выберите тип продукции
                </div>
            )}

            {typeId && (
                <div className="flex gap-4">

                    {/* Список осей */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 w-64 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Оси параметров</span>
                            <button onClick={() => setModal('add-axis')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs
                           px-2.5 py-1.5 rounded-lg transition-colors">
                                + Ось
                            </button>
                        </div>

                        {loadingAxes ? (
                            <div className="text-sm text-gray-400 dark:text-gray-500">Загрузка...</div>
                        ) : axes.length === 0 ? (
                            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                                Нет осей
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {axes.map(axis => (
                                    <div key={axis.id}
                                        onClick={() => setSelectedAxis(axis)}
                                        className={`flex items-center justify-between rounded-lg px-3 py-2.5
                                cursor-pointer group transition-colors ${selectedAxis?.id === axis.id
                                                ? 'bg-blue-50 border border-blue-200'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 border border-transparent'
                                            }`}>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                {axis.name}
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                                order: {axis.order} · {axis.values_count ?? '?'} зн.
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                                            <button
                                                onClick={e => { e.stopPropagation(); setModal(axis); }}
                                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                                                title="Редактировать">
                                                ✎
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDeleteAxis(axis); }}
                                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                                title="Удалить">
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Панель значений */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex-1 min-w-0">
                        {selectedAxis ? (
                            <ValuesPanel axis={selectedAxis} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                                Выберите ось для редактирования значений
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Модалки осей */}
            {modal === 'add-axis' && (
                <Modal title="Новая ось параметра" onClose={() => setModal(null)}>
                    <AxisForm productTypeId={typeId}
                        onSave={axis => setAxes(ax => [...ax, axis].sort((a, b) => a.order - b.order))}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal && modal !== 'add-axis' && (
                <Modal title="Редактировать ось" onClose={() => setModal(null)}>
                    <AxisForm productTypeId={typeId} axis={modal}
                        onSave={updated => setAxes(ax =>
                            ax.map(a => a.id === updated.id ? updated : a)
                                .sort((a, b) => a.order - b.order)
                        )}
                        onClose={() => setModal(null)} />
                </Modal>
            )}
        </div>
    );
}