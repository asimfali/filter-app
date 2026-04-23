import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bomApi } from '../api/bom';
import { can } from '../utils/permissions';
import SmartSelect from '../components/common/SmartSelect';

// ── Константы ─────────────────────────────────────────────────────────────

const VERDICT_LABELS = {
    dispose: 'Утилизировать',
    store_for_paint: 'Складировать под покраску',
};

const VERDICT_COLORS = {
    dispose: 'text-red-600 dark:text-red-400',
    store_for_paint: 'text-yellow-600 dark:text-yellow-400',
};

const EMPTY_FORM = {
    act_number: '',
    date: new Date().toISOString().slice(0, 10),
    part: null,
    drawing_number: '',
    quantity: 1,
    defect_type: null,
    verdict: 'dispose',
    notes: '',
};

// ── Хук данных ────────────────────────────────────────────────────────────

function useDefectActs(filters) {
    const [acts, setActs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, data } = await bomApi.getDefectActs(filters);
            if (ok && data.success) setActs(data.data || []);
            else setError('Ошибка загрузки');
        } catch {
            setError('Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    }, [filters.date_from, filters.date_to, filters.q]);

    useEffect(() => { load(); }, [load]);

    return { acts, loading, error, reload: load };
}

// ── Форма создания/редактирования ─────────────────────────────────────────

function DefectActForm({ initial = null, onSaved, onCancel }) {
    const [form, setForm] = useState(initial ? {
        act_number: initial.act_number,
        date: initial.date,
        part: initial.part ? { id: initial.part.id, name: initial.part.name } : null,
        drawing_number: initial.drawing_number || '',
        quantity: initial.quantity,
        defect_type: initial.defect_type ? { id: initial.defect_type.id, name: initial.defect_type.name } : null,
        verdict: initial.verdict,
        notes: initial.notes || '',
    } : { ...EMPTY_FORM });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const inp = `w-full border border-gray-200 dark:border-gray-700 rounded-lg
                 px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                 text-gray-900 dark:text-white
                 focus:outline-none focus:ring-1 focus:ring-blue-500`;

    const lbl = `block text-xs text-gray-500 dark:text-gray-400 mb-1`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.part) { setError('Выберите изделие/деталь'); return; }
        if (!form.defect_type) { setError('Укажите описание дефекта'); return; }

        setLoading(true);
        setError('');

        const payload = {
            act_number: form.act_number,
            date: form.date,
            part: form.part.id,
            drawing_number: form.drawing_number,
            quantity: form.quantity,
            defect_type: form.defect_type.id,
            verdict: form.verdict,
            notes: form.notes,
        };

        const { ok, data } = initial
            ? await bomApi.updateDefectAct(initial.id, payload)
            : await bomApi.createDefectAct(payload);

        if (ok && data.success) {
            onSaved(data.data);
        } else {
            const err = data.error;
            setError(
                typeof err === 'string' ? err :
                    typeof err === 'object' ? Object.values(err).flat().join(', ') :
                        'Ошибка сохранения'
            );
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* № акта */}
                <div>
                    <label className={lbl}>№ акта</label>
                    <input
                        required
                        value={form.act_number}
                        onChange={e => setForm(f => ({ ...f, act_number: e.target.value }))}
                        placeholder="525"
                        className={inp}
                    />
                </div>

                {/* Дата */}
                <div>
                    <label className={lbl}>Дата</label>
                    <input
                        required
                        type="date"
                        value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className={inp}
                    />
                </div>

                {/* Кол-во */}
                <div>
                    <label className={lbl}>Кол-во</label>
                    <input
                        required
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={e => setForm(f => ({ ...f, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 1 }))}
                        className={inp}
                    />
                </div>

                {/* Чертёж */}
                <div>
                    <label className={lbl}>Чертёж</label>
                    <input
                        value={form.drawing_number}
                        onChange={e => setForm(f => ({ ...f, drawing_number: e.target.value }))}
                        placeholder="нет данных"
                        className={inp}
                    />
                </div>
            </div>

            {/* Изделие / деталь */}
            <div>
                <label className={lbl}>Тип изделия (детали)</label>
                <SmartSelect
                    endpoint="/api/v1/bom/parts/"
                    placeholder="Найти деталь / изделие..."
                    nameKey="onec_name"
                    value={form.part}
                    onSelect={part => setForm(f => ({
                        ...f,
                        part: { id: part.id, name: part.onec_name }
                    }))}
                    onClear={() => setForm(f => ({ ...f, part: null }))}
                />
            </div>

            {/* Описание дефекта */}
            <div>
                <label className={lbl}>Описание дефекта</label>
                <SmartSelect
                    endpoint="/api/v1/bom/defect-types/"
                    placeholder="Повреждение ПП, Механические повреждения..."
                    allowCreate
                    createEndpoint="/api/v1/bom/defect-types/"
                    value={form.defect_type}
                    onSelect={dt => setForm(f => ({ ...f, defect_type: dt }))}
                    onClear={() => setForm(f => ({ ...f, defect_type: null }))}
                />
            </div>

            {/* Заключение */}
            <div>
                <label className={lbl}>Заключение</label>
                <div className="flex gap-3">
                    {Object.entries(VERDICT_LABELS).map(([value, label]) => (
                        <label key={value}
                            className="flex items-center gap-2 cursor-pointer text-sm
                                       text-gray-700 dark:text-gray-300">
                            <input
                                type="radio"
                                name="verdict"
                                value={value}
                                checked={form.verdict === value}
                                onChange={() => setForm(f => ({ ...f, verdict: value }))}
                                className="accent-blue-600"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            {/* Примечания */}
            <div>
                <label className={lbl}>Примечания</label>
                <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={inp}
                    placeholder="Необязательно"
                />
            </div>

            {error && (
                <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950
                    border border-red-200 dark:border-red-800
                    px-3 py-2 rounded-lg">
                    {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               text-white text-sm font-medium px-4 py-2
                               rounded-lg transition-colors">
                    {loading ? '···' : initial ? 'Сохранить' : 'Создать'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-sm text-gray-500 hover:text-gray-700
                               dark:hover:text-gray-300 px-3 py-2 transition-colors">
                    Отмена
                </button>
            </div>
        </form>
    );
}

// ── Строка таблицы ────────────────────────────────────────────────────────

function ActRow({ act, canWrite, onEdit, onDelete }) {
    const [confirming, setConfirming] = useState(false);

    return (
        <tr className="border-b border-gray-100 dark:border-gray-800
                       hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group">
            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                {act.act_number}
            </td>
            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {act.date}
            </td>
            <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {act.drawing_number || '—'}
            </td>
            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white max-w-[200px] truncate">
                {act.part?.name || '—'}
            </td>
            <td className="px-3 py-2 text-sm text-center text-gray-700 dark:text-gray-300">
                {act.quantity}
            </td>
            <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                {act.defect_type?.name || '—'}
            </td>
            <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap
                            ${VERDICT_COLORS[act.verdict]}`}>
                {VERDICT_LABELS[act.verdict]}
            </td>
            {canWrite && (
                <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onEdit(act)}
                            className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                            Изм.
                        </button>
                        {confirming ? (
                            <div className="flex gap-1 items-center">
                                <button
                                    onClick={() => { onDelete(act.id); setConfirming(false); }}
                                    className="text-xs text-red-500 hover:text-red-700">
                                    Да
                                </button>
                                <span className="text-gray-300">/</span>
                                <button
                                    onClick={() => setConfirming(false)}
                                    className="text-xs text-gray-400 hover:text-gray-600">
                                    Нет
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirming(true)}
                                className="text-xs text-gray-300 hover:text-red-500 transition-colors">
                                Удалить
                            </button>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function DefectActPage() {
    const { user } = useAuth();
    const canWrite = can(user, 'bom.defect.write');

    // Фильтры
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    const [q, setQ] = useState('');

    const filters = { date_from: dateFrom, date_to: dateTo, q };
    const { acts, loading, error, reload } = useDefectActs(filters);

    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null);

    const handleSaved = () => {
        reload();
        setShowCreate(false);
        setEditing(null);
    };

    const handleDelete = async (id) => {
        const { ok } = await bomApi.deleteDefectAct(id);
        if (ok) reload();
    };

    const handlePrint = async () => {
        const res = await bomApi.downloadDefectActsPdf({
            date_from: dateFrom,
            date_to: dateTo,
            q,
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    return (
        <div className="space-y-4">
            {/* Шапка */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4
                            flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Ведомость дефектов
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Акты дефектации изделий и деталей
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="text-sm px-3 py-2 rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800
                                   transition-colors">
                        🖨 Печать
                    </button>
                    {canWrite && (
                        <button
                            onClick={() => { setShowCreate(o => !o); setEditing(null); }}
                            className={`text-sm px-4 py-2 rounded-lg transition-colors ${showCreate
                                ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}>
                            {showCreate ? '← Назад' : '+ Добавить'}
                        </button>
                    )}
                </div>
            </div>

            {/* Форма создания */}
            {showCreate && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                        Новый акт дефектации
                    </div>
                    <DefectActForm
                        onSaved={handleSaved}
                        onCancel={() => setShowCreate(false)}
                    />
                </div>
            )}

            {/* Форма редактирования */}
            {editing && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                        Редактирование акта № {editing.act_number}
                    </div>
                    <DefectActForm
                        initial={editing}
                        onSaved={handleSaved}
                        onCancel={() => setEditing(null)}
                    />
                </div>
            )}

            {/* Фильтры */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Дата с
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg
                                       px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Дата по
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg
                                       px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Поиск
                        </label>
                        <input
                            type="search"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Деталь, дефект..."
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg
                                       px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    {q && (
                        <button
                            onClick={() => setQ('')}
                            className="text-xs text-blue-500 hover:text-blue-700 pb-1.5">
                            Сбросить ×
                        </button>
                    )}
                </div>
            </div>

            {/* Таблица */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-sm text-gray-400">Загрузка...</div>
                ) : error ? (
                    <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950
                                    border border-red-200 dark:border-red-800 rounded-lg m-4">
                        {error}
                    </div>
                ) : acts.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        {q ? 'Ничего не найдено' : 'Актов за выбранный период нет'}
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800
                                        text-xs text-gray-500 dark:text-gray-400">
                            {acts.length} записей
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700
                                                   bg-neutral-50 dark:bg-neutral-800/50">
                                        {['№', 'Дата', 'Чертёж', 'Тип изделия (детали)',
                                            'Кол-во', 'Описание дефекта', 'Заключение',
                                            ...(canWrite ? [''] : [])
                                        ].map(h => (
                                            <th key={h}
                                                className="px-3 py-2 text-xs font-medium
                                                           text-gray-500 dark:text-gray-400
                                                           whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {acts.map(act => (
                                        <ActRow
                                            key={act.id}
                                            act={act}
                                            canWrite={canWrite}
                                            onEdit={setEditing}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}