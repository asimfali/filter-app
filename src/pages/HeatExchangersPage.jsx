import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mediaApi } from '../api/media';
import { can } from '../utils/permissions';
import CreateFilterModal from '../components/media/CreateFilterModal.jsx';
import DirectProductsPanel from '../components/media/DirectProductsPanel';
import FiltersPanel from '../components/media/FiltersPanel';
import SmartSelect from '../components/common/SmartSelect';

// ── Хук загрузки ─────────────────────────────────────────────────────────

function useHeatExchangers() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, data } = await mediaApi.getHeatExchangers();
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
    const [docTypes, setDocTypes] = useState([]);  // ← добавить

    useEffect(() => {
        mediaApi.getFormData().then(({ ok, data }) => {
            if (ok) {
                setAxes(data.axes || []);
                setDocTypes(data.doc_types || []);  // ← добавить
            }
        });
    }, []);
    return { axes, docTypes };  // ← добавить
}

// ── Форма создания / редактирования ──────────────────────────────────────

const EMPTY_FORM = {
    mark: '',
    overall_length: '', overall_width: '', overall_height: '',
    body_length: '', body_height: '',
    water_volume: '', row_count: '',
    tube_thickness: '', fin_pitch: '', fin_thickness: '',
    circuit_count: '', collector_type: '', configuration: '',
};

const FIELDS = [
    {
        group: 'Основное',
        cols: 3,
        fields: [
            { key: 'mark', label: 'Марка', placeholder: 'ТЕРМА 01' },
            { key: 'collector_type', label: 'Коллектор', placeholder: 'L' },
            { key: 'configuration', label: 'Конфигурация', placeholder: 'S22-10' },
        ],
    },
    {
        group: 'Габариты изделия, мм',
        cols: 3,
        fields: [
            { key: 'overall_length', label: 'Длина', type: 'number' },
            { key: 'overall_width', label: 'Ширина', type: 'number' },
            { key: 'overall_height', label: 'Высота', type: 'number' },
        ],
    },
    {
        group: 'Тело теплообменника',
        cols: 4,
        fields: [
            { key: 'body_length', label: 'Длина тела, мм', type: 'number' },
            { key: 'body_height', label: 'Высота тела, мм', type: 'number' },
            { key: 'water_volume', label: 'Объём воды, л', type: 'number', step: '0.01' },
            { key: 'row_count', label: 'Рядов', type: 'number' },
        ],
    },
    {
        group: 'Конструктив',
        cols: 4,
        fields: [
            { key: 'tube_thickness', label: 'Трубка, мм', type: 'number', step: '0.01' },
            { key: 'fin_pitch', label: 'Шаг рёбер, мм', type: 'number', step: '0.01' },
            { key: 'fin_thickness', label: 'Ребро, мм', type: 'number', step: '0.01' },
            { key: 'circuit_count', label: 'Контуры', type: 'number' },
        ],
    },
];

function HeatExchangerForm({ initial = null, onSaved, onCancel }) {
    const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY_FORM });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const inp = "w-full border-b border-gray-300 dark:border-gray-600 px-0 py-0.5 text-sm " +
        "bg-transparent text-gray-900 dark:text-white " +
        "focus:outline-none focus:border-blue-500";

    const lbl = "block text-xs text-gray-400 dark:text-gray-500 mb-0.5 whitespace-nowrap";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { ok, data } = initial
            ? await mediaApi.updateHeatExchanger(initial.id, form)
            : await mediaApi.createHeatExchanger(form);
        if (ok && data.success) onSaved(data.data);
        else setError(data.error || 'Ошибка сохранения');
        setLoading(false);
    };

    const INLINE_FIELDS = [
        { k: 'mark', label: 'Марка', w: '120px' },
        { k: 'overall_length', label: 'Длина изд.', w: '60px', type: 'number' },
        { k: 'overall_width', label: 'Ширина', w: '55px', type: 'number' },
        { k: 'overall_height', label: 'Высота', w: '55px', type: 'number' },
        { k: 'body_length', label: 'Тело длина', w: '60px', type: 'number' },
        { k: 'body_height', label: 'Тело высота', w: '60px', type: 'number' },
        { k: 'water_volume', label: 'V, л', w: '55px', type: 'number', step: '0.01' },
        { k: 'row_count', label: 'Рядов', w: '45px', type: 'number' },
        { k: 'tube_thickness', label: 'Трубка', w: '55px', type: 'number', step: '0.01' },
        { k: 'fin_pitch', label: 'Шаг рёбер', w: '65px', type: 'number', step: '0.01' },
        { k: 'fin_thickness', label: 'Ребро', w: '55px', type: 'number', step: '0.01' },
        { k: 'circuit_count', label: 'Контуры', w: '55px', type: 'number' },
        { k: 'collector_type', label: 'Коллектор', w: '65px' },
        { k: 'configuration', label: 'Конфиг.', w: '75px' },
    ];

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-5 py-3">
                {INLINE_FIELDS.map(({ k, label, w, type = 'text', step }) => (
                    <div key={k} style={{ width: w }} className="shrink-0">
                        <label className={lbl}>{label}</label>
                        <input
                            required type={type} step={step}
                            value={form[k] ?? ''}
                            onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                            className={inp}
                        />
                    </div>
                ))}

                {/* Кнопки в той же строке */}
                <div className="flex items-end gap-2 ml-2 pb-0.5">
                    <button type="submit" disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                   text-white text-xs font-medium px-3 py-1.5
                                   rounded-lg transition-colors whitespace-nowrap">
                        {loading ? '···' : initial ? 'Сохранить' : 'Создать'}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="text-xs text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300 px-2 py-1.5 transition-colors">
                        Отмена
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-5 mb-3 text-xs text-red-600 bg-red-50 dark:bg-red-950
                                border border-red-200 dark:border-red-800 px-3 py-2 rounded">
                    {error}
                </div>
            )}
        </form>
    );
}

function BulkImportForm({ onImported }) {
    const [json, setJson] = useState('');
    const [updateExisting, setUpdateExisting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setJson(ev.target.result);
        reader.readAsText(file, 'UTF-8');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        try {
            const items = JSON.parse(json);
            const { ok, data } = await mediaApi.bulkCreateHeatExchangers(items, updateExisting);
            setResult({ ok, data });
            if (ok && data.success && data.data.created > 0) onImported();
        } catch (err) {
            setResult({ ok: false, data: { error: 'Невалидный JSON: ' + err.message } });
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    JSON файл
                </label>
                <input type="file" accept=".json"
                    onChange={handleFile}
                    className="text-sm text-gray-600 dark:text-gray-400" />
            </div>

            {json && (
                <div className="text-xs text-gray-400 font-mono bg-neutral-50
                                dark:bg-neutral-800 px-3 py-2 rounded max-h-32 overflow-auto">
                    {json.slice(0, 300)}...
                </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600
                               dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={updateExisting}
                    onChange={e => setUpdateExisting(e.target.checked)}
                    className="rounded" />
                Обновить существующие
            </label>

            {result && (
                <div className={`text-xs px-3 py-2 rounded border ${result.ok && result.data.success
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    }`}>
                    {result.ok && result.data.success ? (
                        <>
                            ✓ Создано: {result.data.data.created}
                            {result.data.data.updated > 0 && ` · Обновлено: ${result.data.data.updated}`}
                            {result.data.data.skipped > 0 && ` · Пропущено: ${result.data.data.skipped}`}
                            {result.data.data.errors?.map((e, i) => (
                                <div key={i} className="mt-1 text-red-500">✗ {e}</div>
                            ))}
                        </>
                    ) : (
                        <>✗ {result.data?.error}</>
                    )}
                </div>
            )}

            <button type="submit" disabled={loading || !json}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                           text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {loading ? 'Загрузка...' : 'Импортировать'}
            </button>
        </form>
    );
}

function DrawingPanel({ item, canWrite, drawingDocTypeId }) {
    console.log('DrawingPanel:', { drawingDocTypeId, canWrite });
    const [drawingFiles, setDrawingFiles] = useState(item.drawing_files || []);
    const [draggingOver, setDraggingOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Поиск существующих документов типа heart_exchanger
    useEffect(() => {
        if (!drawingDocTypeId || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        const t = setTimeout(async () => {
            setSearching(true);
            const { ok, data } = await mediaApi.searchDocuments(
                String(drawingDocTypeId), searchQuery
            );
            if (ok) setSearchResults(data.results || []);
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery, drawingDocTypeId]);

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingOver(false);
        const file = e.dataTransfer.files[0];
        if (!file) return;
        setUploading(true);
        setUploadMsg(null);
        const { ok, data } = await mediaApi.uploadHeatExchangerDrawing(item.id, file);
        if (ok && data.success) {
            const { ok: ok2, data: d2 } = await mediaApi.getHeatExchangers();
            if (ok2) {
                const updated = (d2.data || []).find(h => h.id === item.id);
                if (updated) setDrawingFiles(updated.drawing_files || []);
            }
            setUploadMsg({ ok: true, text: '✓ Загружен' });
        } else {
            setUploadMsg({ ok: false, text: data.error || 'Ошибка' });
        }
        setUploading(false);
    };

    const handleClick = async (e, relPath) => {
        e.preventDefault();
        const res = await mediaApi.downloadFile(relPath);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    const handleDetach = async () => {
        // Отвязываем чертёж — PATCH с drawing_id: null
        const { ok, data } = await mediaApi.updateHeatExchanger(item.id, { drawing_id: null });
        if (ok && data.success) {
            setDrawingFiles([]);
            setUploadMsg({ ok: true, text: '✓ Чертёж отвязан' });
        }
    };

    const handleAttach = async (doc) => {
        // Привязываем существующий документ
        const { ok, data } = await mediaApi.updateHeatExchanger(item.id, { drawing_id: doc.id });
        if (ok && data.success) {
            // Перезагружаем файлы
            const { ok: ok2, data: d2 } = await mediaApi.getHeatExchangers();
            if (ok2) {
                const updated = (d2.data || []).find(h => h.id === item.id);
                if (updated) setDrawingFiles(updated.drawing_files || []);
            }
            setShowSearch(false);
            setSearchQuery('');
            setUploadMsg({ ok: true, text: `✓ Привязан: ${doc.external_id}` });
        }
    };

    return (
        <div className="mx-5 mb-3 space-y-2">
            {/* Файлы чертежа */}
            <div
                className={`rounded-lg border-2 border-dashed transition-colors
                    ${draggingOver
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'}`}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
                onDrop={handleDrop}
            >
                {uploading ? (
                    <div className="px-3 py-2 text-xs text-gray-400">Загрузка...</div>
                ) : drawingFiles.length > 0 ? (
                    <div className="space-y-0.5 py-1">
                        {drawingFiles.map(f => (
                            <div key={f.rel_path}
                                className="flex items-center justify-between px-3 py-1.5
                                           hover:bg-neutral-50 dark:hover:bg-neutral-800
                                           rounded-lg group transition-colors">
                                <a href="#" onClick={e => handleClick(e, f.rel_path)}
                                    className="flex items-center gap-2 min-w-0">
                                    <span className="text-red-400 shrink-0">📄</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                        {f.name}
                                    </span>
                                </a>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="text-xs text-gray-400">{f.size}</span>
                                    {canWrite && (
                                        <button onClick={handleDetach}
                                            className="text-xs text-gray-300 hover:text-red-500
                                                       opacity-0 group-hover:opacity-100
                                                       transition-all">
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            Чертёж
                        </span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">
                            {draggingOver ? 'Отпустите для загрузки' : 'Перетащите файл'}
                        </span>
                    </div>
                )}
            </div>

            {/* Кнопки управления */}
            {canWrite && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSearch(o => !o)}
                        className="text-xs text-blue-500 hover:text-blue-700
                                   transition-colors">
                        {showSearch ? '✕ Отмена' : '🔗 Привязать существующий'}
                    </button>
                </div>
            )}

            {/* Поиск существующего документа */}
            {showSearch && (
                <SmartSelect
                    endpoint={`/api/v1/media/documents/search/?doc_type_id=${drawingDocTypeId}`}
                    onSelect={handleAttach}
                    placeholder="Поиск по external_id..."
                    renderItem={doc => (
                        <>
                            <span className="text-gray-900 dark:text-white font-medium block">
                                {doc.external_id}
                            </span>
                            {doc.name && (
                                <span className="text-gray-400">{doc.name}</span>
                            )}
                        </>
                    )}
                />
            )}

            {uploadMsg && (
                <div className={`text-xs px-1 ${uploadMsg.ok
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500'}`}>
                    {uploadMsg.text}
                </div>
            )}
        </div>
    );
}

// ── Карточка теплообменника ───────────────────────────────────────────────

function HeatExchangerCard({ item, canWrite, axes, drawingDocTypeId, onUpdated, onDeleted }) {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [editData, setEditData] = useState(null);

    if (editing) {
        return (
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                            border border-gray-200 dark:border-gray-700 p-5">
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                    Редактирование: {item.mark}
                </div>
                <HeatExchangerForm
                    initial={editData}
                    onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
                    onCancel={() => setEditing(false)}
                />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                        border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Марка */}
            <div className="px-5 pt-3 pb-1 text-sm font-medium
                        text-gray-900 dark:text-white">
                {item.mark}
            </div>

            <FiltersPanel
                entityId={item.id}
                entityType="heat-exchanger"
                initialFilters={item.filters || []}
                axes={axes}
                canWrite={canWrite}
            />

            <DirectProductsPanel
                entityId={item.id}
                entityType="heat-exchanger"
                canWrite={canWrite}
            />

            {/* Характеристики */}
            <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    {[
                        ['Габариты', item.overall_dimensions],
                        ['Тело', item.body_dimensions],
                        ['V', `${item.water_volume} л`],
                        ['Рядов', item.row_count],
                        ['Трубка', `${item.tube_thickness} мм`],
                        ['Шаг рёбер', `${item.fin_pitch} мм`],
                        ['Ребро', `${item.fin_thickness} мм`],
                        ['Контуры', item.circuit_count],
                        ['Коллектор', item.collector_type],
                        ['Конфиг.', item.configuration],
                    ].map(([label, value]) => (
                        <div key={label} className="flex items-baseline gap-1.5 shrink-0">
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                {label}
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Чертёж */}
            <DrawingPanel
                item={item}
                canWrite={canWrite}
                drawingDocTypeId={drawingDocTypeId}
            />
        </div>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function HeatExchangersPage() {
    const { user } = useAuth();
    const canWrite = can(user, 'portal.heat_exchanger.write');
    const { items, loading, error, reload } = useHeatExchangers();
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState('');
    const [createMode, setCreateMode] = useState('single'); // 'single' | 'import'

    const { axes, docTypes } = useFormData();

    // ← вычислять после загрузки
    const drawingDocTypeId = docTypes.find(dt => dt.code === 'heart_exchanger')?.id;

    const filtered = search.trim()
        ? items.filter(i =>
            i.mark.toLowerCase().includes(search.toLowerCase()) ||
            i.configuration.toLowerCase().includes(search.toLowerCase())
        )
        : items;

    const handleUpdated = (updated) => {
        // Обновляем карточку без перезагрузки списка
        reload();
    };

    return (
        <div className="space-y-4">
            {/* Шапка */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4
                            flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Теплообменники
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Справочник марок теплообменников и их привязка к изделиям
                    </p>
                </div>
                {canWrite && (
                    <button onClick={() => setShowCreate(o => !o)}
                        className={`text-sm px-4 py-2 rounded-lg transition-colors ${showCreate
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}>
                        {showCreate ? '← Назад' : '+ Добавить'}
                    </button>
                )}
            </div>

            {showCreate ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5 max-w-2xl">
                    <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800
                        p-1 rounded-lg w-fit mb-4">
                        <button onClick={() => setCreateMode('single')}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${createMode === 'single'
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400'}`}>
                            Добавить вручную
                        </button>
                        <button onClick={() => setCreateMode('import')}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${createMode === 'import'
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400'}`}>
                            Импорт JSON
                        </button>
                    </div>

                    {createMode === 'single' ? (
                        <HeatExchangerForm
                            onSaved={() => { reload(); setShowCreate(false); }}
                            onCancel={() => setShowCreate(false)}
                        />
                    ) : (
                        <BulkImportForm onImported={() => { reload(); }} />
                    )}
                </div>
            ) : (
                <>
                    {/* Поиск */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
                        <input
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по марке, конфигурации..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                                       px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                       text-gray-900 dark:text-white
                                       placeholder-gray-400 dark:placeholder-gray-500
                                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

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
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8
                                        text-center">
                            <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                                {search ? 'Ничего не найдено' : 'Теплообменников пока нет'}
                            </p>
                            {!search && canWrite && (
                                <button onClick={() => setShowCreate(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white
                                               text-sm px-4 py-2 rounded-lg transition-colors">
                                    + Добавить первый
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                {filtered.length} теплообменников
                                {search && (
                                    <button onClick={() => setSearch('')}
                                        className="ml-3 text-blue-500 hover:text-blue-700">
                                        Сбросить ×
                                    </button>
                                )}
                            </div>
                            {filtered.map(item => (
                                <HeatExchangerCard
                                    key={item.id}
                                    item={item}
                                    canWrite={canWrite}
                                    axes={axes}
                                    drawingDocTypeId={drawingDocTypeId}  // ← добавить
                                    onUpdated={handleUpdated}
                                    onDeleted={reload}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}