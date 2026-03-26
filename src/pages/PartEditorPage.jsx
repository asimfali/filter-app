import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sessionsApi } from '../api/sessions';
import { bomApi } from '../api/bom';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../utils/permissions';
import { createPortal } from 'react-dom';

const SESSION_TYPE = 'bom_editor';

// ─── Хук сессии ───────────────────────────────────────────────────────────────
function useBomSession() {
    const [sessionId, setSessionId] = useState(null);

    // Восстановить сессию при монтировании
    const restore = useCallback(async () => {
        const data = await sessionsApi.list(SESSION_TYPE);

        // Один объект напрямую
        const session = data?.id ? data : (Array.isArray(data) ? data[0] : data?.results?.[0]);

        if (session?.id) {
            setSessionId(session.id);
            return session.data || {};
        }
        return {};
    }, []);

    // Сохранить состояние
    const save = useCallback(async (state) => {
        if (sessionId) {
            await sessionsApi.update(sessionId, { data: state });
        } else {
            const created = await sessionsApi.create(SESSION_TYPE, 'BOM редактор', state);
            if (created?.id) {
                setSessionId(created.id);
                await sessionsApi.activate(created.id);  // ← активируем
            }
        }
    }, [sessionId]);

    return { restore, save };
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ─── Константы ───────────────────────────────────────────────────────────────

const STATUS_LABEL = {
    draft: 'Черновик',
    ready: 'Готова к загрузке',
    pushing: 'Загружается...',
    pushed: 'Загружена в 1С',
    push_error: 'Ошибка загрузки',
};

const STATUS_COLOR = {
    draft: 'text-gray-500 dark:text-gray-400',
    ready: 'text-emerald-600 dark:text-emerald-400',
    pushing: 'text-blue-500 dark:text-blue-400',
    pushed: 'text-emerald-700 dark:text-emerald-300',
    push_error: 'text-red-600 dark:text-red-400',
};

const PROCESS_TYPES = [
    'Сборка',
    'Изготовление, сборка',
    'Ремонт',
    'Разборка',
    'БезСпецификаций',
];

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function PartEditorPage() {
    const { user } = useAuth();
    const canWrite = can(user, 'bom.spec.write');
    const canPush = can(user, 'bom.spec.push');

    const [view, setView] = useState('list'); // list | editor
    const [specs, setSpecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpec, setSelectedSpec] = useState(null);

    const { restore, save } = useBomSession();

    useEffect(() => {
        restore().then(async (saved) => {
            if (saved?.spec_id) {
                const { ok, data } = await bomApi.getSpec(saved.spec_id);
                if (ok && data.success) {
                    setSelectedSpec(data.data);
                    setView('editor');
                    if (canWrite) await bomApi.lockSpec(saved.spec_id);
                }
            }
        });
    }, []);

    const loadSpecs = useCallback(async (q = '') => {
        setLoading(true);
        const { ok, data } = await bomApi.getSpecs({ q });
        if (ok && data.success) setSpecs(data.data);
        setLoading(false);
    }, []);

    const handleSearch = useRef(
        debounce((q) => loadSpecs(q), 400)
    ).current;

    useEffect(() => { loadSpecs(); }, [loadSpecs]);

    const handleOpenSpec = async (specId) => {
        const { ok, data } = await bomApi.getSpec(specId);
        if (ok && data.success) {
            setSelectedSpec(data.data);
            setView('editor');
            if (canWrite) await bomApi.lockSpec(specId);
            await save({ spec_id: specId });  // ← сохраняем
        }
    };

    const handleCloseEditor = async () => {
        if (selectedSpec) await bomApi.unlockSpec(selectedSpec.id);
        setSelectedSpec(null);
        setView('list');
        await save({});  // ← очищаем
        loadSpecs();
    };

    const handleSpecSaved = (updated) => {
        setSelectedSpec(updated);
        loadSpecs();
    };

    if (view === 'editor' && selectedSpec) {
        return (
            <SpecEditor
                spec={selectedSpec}
                onClose={handleCloseEditor}
                onSaved={handleSpecSaved}
                canWrite={canWrite}
                canPush={canPush}
            />
        );
    }

    return (
        <SpecList
            specs={specs}
            loading={loading}
            canWrite={canWrite}
            onOpen={handleOpenSpec}
            onRefresh={loadSpecs}
            onSearch={handleSearch}
        />
    );
}

// ─── MaterialGroupsModal ──────────────────────────────────────────────────────

function MaterialGroupsModal({ onClose }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null); // открытая группа
    const [creating, setCreating] = useState(false);

    const loadGroups = useCallback(async () => {
        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroups();
        if (ok && data.success) setGroups(data.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const handleDelete = async (id) => {
        if (!confirm('Удалить группу?')) return;
        await bomApi.deleteMaterialGroup(id);
        if (selected?.id === id) setSelected(null);
        loadGroups();
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl
                            max-h-[90vh] flex flex-col">
                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Группы материалов
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Настройка вариантов выбора материала 1С для каждого типа/толщины
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSelected(null); setCreating(true); }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600
                                       hover:bg-emerald-700 text-white transition-colors">
                            + Новая группа
                        </button>
                        <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Тело — два столбца */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Список групп */}
                    <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700
                                    overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-sm text-gray-400 text-center">Загрузка...</div>
                        ) : groups.length === 0 ? (
                            <div className="p-4 text-sm text-gray-400 text-center">Нет групп</div>
                        ) : (
                            groups.map(g => (
                                <div key={g.id}
                                    onClick={() => { setSelected(g); setCreating(false); }}
                                    className={`px-4 py-3 cursor-pointer border-b
                                                border-gray-100 dark:border-gray-800
                                                hover:bg-gray-50 dark:hover:bg-gray-800
                                                transition-colors
                                                ${selected?.id === g.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                                            : ''
                                        }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {g.material_type}
                                                {g.thickness && (
                                                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                                                        {g.thickness}мм
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                {g.parts.length} явных
                                                {g.parts_from_folder_count > 0 && (
                                                    <span> + {g.parts_from_folder_count} из папки</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDelete(g.id); }}
                                            className="text-gray-300 dark:text-gray-600
                                                       hover:text-red-500 transition-colors text-base">
                                            ×
                                        </button>
                                    </div>
                                    {g.folder_path && (
                                        <div className="text-[11px] text-gray-400 mt-1 truncate"
                                            title={g.folder_path}>
                                            📁 {g.folder_path.split(' / ').slice(-2).join(' / ')}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Правая панель */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {creating && (
                            <GroupForm
                                onSaved={(g) => { loadGroups(); setCreating(false); setSelected(g); }}
                                onCancel={() => setCreating(false)}
                            />
                        )}
                        {selected && !creating && (
                            <GroupDetail
                                group={selected}
                                onUpdated={(g) => { setSelected(g); loadGroups(); }}
                            />
                        )}
                        {!selected && !creating && (
                            <div className="flex items-center justify-center h-full
                                            text-sm text-gray-400 dark:text-gray-500">
                                Выберите группу или создайте новую
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── GroupForm — создание новой группы ───────────────────────────────────────

function GroupForm({ onSaved, onCancel }) {
    const [form, setForm] = useState({ material_type: '', thickness: '', notes: '' });
    const [folder, setFolder] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!form.material_type.trim()) { setError('Укажите тип материала'); return; }
        setSaving(true);
        setError('');
        const { ok, data } = await bomApi.createMaterialGroup({
            material_type: form.material_type.trim(),
            thickness: form.thickness || null,
            folder_id: folder?.id || null,
            notes: form.notes,
        });
        if (ok && data.success) {
            onSaved(data.data);
        } else {
            setError(data.error || 'Ошибка создания');
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Новая группа материалов
            </h4>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Тип материала *
                    </label>
                    <input
                        value={form.material_type}
                        onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}
                        placeholder="АЛР оц, Нерж, Труба..."
                        className={inputCls}
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Толщина, мм
                    </label>
                    <input
                        value={form.thickness}
                        onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))}
                        placeholder="0.70 (пусто = любая)"
                        className={inputCls}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Папка 1С (все Parts из папки войдут в группу автоматически)
                </label>
                <FolderPicker value={folder} onChange={setFolder} />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Примечания
                </label>
                <input
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Необязательно"
                    className={inputCls}
                />
            </div>

            {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-2">
                <button onClick={onCancel}
                    className="flex-1 border border-gray-200 dark:border-gray-700
                               text-gray-600 dark:text-gray-400 text-sm py-2 rounded-lg
                               hover:bg-gray-50 dark:hover:bg-gray-800">
                    Отмена
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700
                               text-white text-sm py-2 rounded-lg
                               disabled:opacity-50 transition-colors">
                    {saving ? 'Создание...' : 'Создать'}
                </button>
            </div>
        </div>
    );
}

// ─── GroupDetail — просмотр и редактирование группы ──────────────────────────

function GroupDetail({ group, onUpdated }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [partSearch, setPartSearch] = useState('');
    const [partResults, setPartResults] = useState([]);
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [editFolder, setEditFolder] = useState(false);
    const [folder, setFolder] = useState(null);
    const [savingFolder, setSavingFolder] = useState(false);
    const partInputRef = useRef(null);

    const loadDetail = useCallback(async () => {
        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroupDetail(group.id);
        if (ok && data.success) setDetail(data.data);
        setLoading(false);
    }, [group.id]);

    useEffect(() => { loadDetail(); }, [loadDetail]);

    const handlePartSearch = async (q) => {
        setPartSearch(q);
        if (q.length < 2) { setPartResults([]); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10, is_synced: true });
        if (ok && data.success) setPartResults(data.data);
    };

    const handleAddPart = async (part) => {
        setAdding(true);
        const { ok, data } = await bomApi.addPartToGroup(group.id, part.id);
        if (ok && data.success) {
            await loadDetail();
            onUpdated(data.data);
        }
        setPartSearch('');
        setPartResults([]);
        setAdding(false);
    };

    const handleRemovePart = async (partId) => {
        setRemoving(partId);
        const { ok, data } = await bomApi.removePartFromGroup(group.id, partId);
        if (ok && data.success) {
            await loadDetail();
            onUpdated(data.data);
        }
        setRemoving(null);
    };

    const handleSaveFolder = async () => {
        setSavingFolder(true);
        const { ok, data } = await bomApi.updateMaterialGroup(group.id, {
            folder_id: folder?.id || null,
        });
        if (ok && data.success) {
            onUpdated(data.data);
            setEditFolder(false);
            loadDetail();
        }
        setSavingFolder(false);
    };

    if (loading) return (
        <div className="text-sm text-gray-400 text-center py-8">Загрузка...</div>
    );
    if (!detail) return null;

    return (
        <div className="space-y-5">
            {/* Заголовок */}
            <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                    {detail.material_type}
                    {detail.thickness && <span className="ml-1 text-gray-500"> {detail.thickness}мм</span>}
                </h4>
                {detail.notes && (
                    <p className="text-xs text-gray-400 mt-0.5">{detail.notes}</p>
                )}
            </div>

            {/* Папка 1С */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Папка 1С
                    </span>
                    <button
                        onClick={() => setEditFolder(e => !e)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        {editFolder ? 'Отмена' : 'Изменить'}
                    </button>
                </div>
                {editFolder ? (
                    <div className="space-y-2">
                        <FolderPicker
                            value={folder || (detail.folder_path ? { path: detail.folder_path } : null)}
                            onChange={setFolder}
                        />
                        <button onClick={handleSaveFolder} disabled={savingFolder}
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600
                                       hover:bg-blue-700 text-white disabled:opacity-50">
                            {savingFolder ? '...' : 'Сохранить папку'}
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {detail.folder_path
                            ? <span>📁 {detail.folder_path}</span>
                            : <span className="text-gray-400 italic">Не задана</span>
                        }
                    </div>
                )}
            </div>

            {/* Все материалы группы */}
            <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Все материалы группы ({detail.all_parts?.length ?? 0})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detail.all_parts?.map(p => (
                        <div key={p.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg
                                       bg-gray-50 dark:bg-gray-800 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                {p.from_folder
                                    ? <span className="text-gray-400 text-xs shrink-0">📁</span>
                                    : <span className="text-blue-500 text-xs shrink-0">★</span>
                                }
                                <span className="text-gray-800 dark:text-gray-200 truncate">
                                    {p.onec_name}
                                </span>
                            </div>
                            {!p.from_folder && (
                                <button
                                    onClick={() => handleRemovePart(p.id)}
                                    disabled={removing === p.id}
                                    className="text-gray-300 dark:text-gray-600
                                               hover:text-red-500 transition-colors
                                               shrink-0 ml-2 disabled:opacity-50">
                                    {removing === p.id ? '...' : '×'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Добавить явный Part */}
            <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Добавить материал явно (★)
                </div>
                <div className="relative">
                    <input
                        ref={partInputRef}
                        value={partSearch}
                        onChange={e => handlePartSearch(e.target.value)}
                        placeholder="Поиск по номенклатуре 1С..."
                        className={inputCls}
                        disabled={adding}
                    />
                    <Dropdown
                        anchorRef={partInputRef}
                        items={partResults}
                        onSelect={part => handleAddPart(part)}
                        renderItem={part => (
                            <div>
                                <div className="text-gray-900 dark:text-white">{part.onec_name}</div>
                                {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                            </div>
                        )}
                    />
                </div>
            </div>
        </div>
    );
}

function FolderPicker({ value, onChange, folderType = 'nomenclature', rootPath = '' }) {
    const [query, setQuery] = useState(value?.path || '');
    const [results, setResults] = useState([]);
    const [allFolders, setAllFolders] = useState([]);  // ← кэш для spec
    const [creating, setCreating] = useState(false);
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const handleEvent = (e) => {
            const isInsideDropdown = e.target.closest('[data-dropdown="true"]');
            const isInsideInput = containerRef.current && containerRef.current.contains(e.target);

            if (!isInsideDropdown && !isInsideInput) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleEvent);
        window.addEventListener('scroll', handleEvent, true);
        window.addEventListener('wheel', handleEvent, true);

        return () => {
            document.removeEventListener('mousedown', handleEvent);
            window.removeEventListener('scroll', handleEvent, true);
            window.removeEventListener('wheel', handleEvent, true);
        };
    }, [open]);

    // Для spec — загрузить все папки один раз при монтировании
    useEffect(() => {
        if (folderType !== 'spec') return;
        bomApi.getFolders('spec').then(({ ok, data }) => {
            if (ok && data.success) {
                const folders = rootPath
                    ? data.data.filter(f => f.path.toLowerCase().startsWith(rootPath.toLowerCase()))
                    : data.data;
                setAllFolders(folders);
            }
        });
    }, [folderType, rootPath]);

    // Хлебные крошки из текущего query
    const breadcrumbs = query.trim()
        ? query.trim().split(' / ').filter(Boolean)
        : [];

    const handleSearch = async (q) => {
        setQuery(q);
        setOpen(true); // Открываем список при вводе // <---

        if (folderType === 'spec') {
            if (q.trim().length < 1) {
                setResults(allFolders.slice(0, 30)); // Показываем корень если пусто // <---
                return;
            }
            setResults(
                allFolders
                    .filter(f => f.path.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 30)
            );
            return;
        }

        const effectiveRoot = folderType === 'manufacture' ? "ПРОИЗВОДСТВО" : rootPath;

        if (q.trim().length < 2) { setResults([]); return; }
        const { ok, data } = await bomApi.searchFolders(folderType, q.trim(), effectiveRoot);
        if (ok && data.success) setResults(data.data);
    };

    const handleSelect = (folder) => {
        setQuery(folder.path);
        setResults([]);
        setOpen(false); // Закрываем при выборе // <---
        onChange(folder);
    };

    // Клик по части пути — подставляет путь до этой части
    const handleBreadcrumbClick = (idx) => {
        const newPath = breadcrumbs.slice(0, idx + 1).join(' / ');
        setQuery(newPath);
        setResults([]);
        // Не вызываем onChange — пользователь ещё не выбрал, просто навигирует
    };

    const handleCreate = async () => {
        if (!query.trim()) return;
        setCreating(true);
        const parts = query.trim().split(' / ').filter(Boolean);
        const name = parts[parts.length - 1].trim();
        const parentPath = parts.slice(0, -1).join(' / ').trim();

        // Ищем parent_code по parentPath в результатах поиска
        let parentCode = '';
        if (parentPath) {
            const { ok, data } = await bomApi.searchFolders('nomenclature', parentPath);
            if (ok && data.success) {
                const found = data.data.find(f => f.path === parentPath);
                parentCode = found?.onec_code || '';
            }
        }

        const { ok, data } = await bomApi.createFolder({
            name,
            parent_path: parentPath,
            parent_code: parentCode,
            folder_type: folderType,  // ← передаём тип
        });

        if (ok && data.success) {
            const folder = data.data;
            setQuery(folder.path);
            onChange(folder);
            setResults([]);
        }
        setCreating(false);
    };

    const handleFocus = () => {
        // Для spec — показать все при фокусе если query пустой
        if (folderType === 'spec' && !query.trim()) {
            setResults(allFolders.slice(0, 30));
        }
    };

    return (
        <div className="space-y-2" ref={containerRef}>
            {/* Хлебные крошки */}
            {breadcrumbs.length > 0 && (
                <div className="flex items-center flex-wrap gap-0.5 text-xs">
                    {breadcrumbs.map((part, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && (
                                <span className="text-gray-400 px-0.5">/</span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleBreadcrumbClick(idx)}
                                className={`px-1.5 py-0.5 rounded hover:bg-blue-50
                                           dark:hover:bg-blue-900/20 transition-colors
                                           ${idx === breadcrumbs.length - 1
                                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
                                    }`}>
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Поиск */}
            <div className="relative">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Введите 2+ символа для поиска или полный путь для создания"
                    className="w-full px-3 py-1.5 text-sm rounded-lg
                               bg-gray-50 dark:bg-gray-800
                               border border-gray-200 dark:border-gray-700
                               text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                />
                {open && results.length > 0 && (
                    <Dropdown
                        anchorRef={inputRef}
                        items={results}
                        onSelect={handleSelect}
                        renderItem={f => (
                            <div className="text-gray-900 dark:text-white text-xs">{f.path}</div>
                        )}
                    />
                )}
            </div>

            {/* Создать папку */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                    Нет нужной папки? Введите полный путь и нажмите «Создать»
                </span>
                <button
                    onClick={handleCreate}
                    disabled={creating || !query.trim()}
                    className="px-3 py-1 text-xs rounded-lg
                               bg-emerald-600 hover:bg-emerald-700
                               text-white disabled:opacity-50 transition-colors">
                    {creating ? '...' : '+ Создать папку'}
                </button>
            </div>
        </div>
    );
}

function CreateDetailsModal({ onClose, onConfirm, defaultFolderId }) {
    const [selectedFolder, setSelectedFolder] = useState(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Создание деталей в 1С
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ×
                    </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Выберите папку номенклатуры для деталей в 1С.
                    Спецификации деталей будут созданы в папке из настроек профиля.
                </p>

                <div>
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-2">
                        Папка номенклатуры деталей
                        {selectedFolder && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 font-normal">
                                {selectedFolder.path}
                            </span>
                        )}
                    </label>
                    <FolderPicker
                        value={selectedFolder}
                        onChange={setSelectedFolder}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-gray-50 dark:hover:bg-gray-800">
                        Отмена
                    </button>
                    <button
                        onClick={() => onConfirm(selectedFolder?.id || null)}
                        disabled={!selectedFolder}
                        className="px-4 py-2 text-sm rounded-lg
                                   bg-blue-600 hover:bg-blue-700
                                   text-white disabled:opacity-50 transition-colors">
                        Создать детали
                    </button>
                </div>
            </div>
        </div>
    );
}

function Dropdown({ anchorRef, items, onSelect, renderItem }) {
    const [style, setStyle] = useState({ opacity: 0 }); // Начинаем с 0, чтобы не было мерцания
    const dropdownRef = useRef(null);

    // Используем useLayoutEffect, чтобы замерить высоту списка сразу после рендера в DOM
    React.useLayoutEffect(() => {
        if (!anchorRef.current || !dropdownRef.current) return;

        const anchorRect = anchorRef.current.getBoundingClientRect();
        const dropdownHeight = dropdownRef.current.offsetHeight;
        const viewportHeight = window.innerHeight;

        // Свободное место снизу и сверху
        const spaceBelow = viewportHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;

        let top;
        // Если места снизу меньше высоты списка (с запасом 20px) 
        // и сверху места больше, чем снизу — рендерим сверху
        if (spaceBelow < (dropdownHeight + 20) && spaceAbove > spaceBelow) {
            top = anchorRect.top - dropdownHeight - 4; // 4px отступ
        } else {
            top = anchorRect.bottom + 4; // Обычное положение снизу
        }

        setStyle({
            position: 'fixed',
            top: top,
            left: anchorRect.left,
            width: anchorRect.width,
            zIndex: 9999,
            opacity: 1, // Показываем список
        });
    }, [anchorRef, items]); // Пересчитываем при изменении списка элементов

    if (!items.length) return null;

    return createPortal(
        <div
            ref={dropdownRef}
            style={style}
            data-dropdown="true"
            className="bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-700
                        rounded-lg shadow-xl max-h-48 overflow-y-auto
                        transition-opacity duration-75"
        >
            {items.map((item, i) => (
                <button key={i}
                    onMouseDown={e => { e.preventDefault(); onSelect(item); }}
                    className="w-full text-left px-3 py-2 text-xs
                               hover:bg-gray-50 dark:hover:bg-gray-800
                               border-b border-gray-50 dark:border-gray-800 last:border-0">
                    {renderItem(item)}
                </button>
            ))}
        </div>,
        document.body
    );
}

function CreateSpecModal({ onClose, onCreated }) {
    const [partSearch, setPartSearch] = useState('');
    const [partResults, setPartResults] = useState([]);
    const [selectedPart, setSelectedPart] = useState(null);
    const [specName, setSpecName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePartSearch = async (q) => {
        setPartSearch(q);
        setSelectedPart(null);
        if (q.length < 2) { setPartResults([]); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10 });
        if (ok && data.success) setPartResults(data.data);
    };

    const handlePartSelect = (part) => {
        setSelectedPart(part);
        setPartSearch(part.onec_name);
        setSpecName(`${part.onec_name}(Сборка)`);
        setPartResults([]);
    };

    const handleCreate = async () => {
        if (!partSearch.trim()) { setError('Укажите изделие'); return; }
        if (!specName.trim()) { setError('Укажите название спецификации'); return; }
        setLoading(true);
        setError('');

        // Если не выбрали из списка — создаём Part локально
        let partId = selectedPart?.id;
        if (!partId) {
            const { ok, data } = await bomApi.createPart({
                onec_name: partSearch.trim(),
                is_assembly: true,
                unit: 'шт.',
            });
            if (ok && data.success) {
                partId = data.data.id;
            } else {
                setError(data.error || 'Ошибка создания изделия');
                setLoading(false);
                return;
            }
        }

        const { ok, data } = await bomApi.createSpec({
            part: partId,
            onec_name: specName.trim(),
            stage_name: 'Сборка',
            process_type: 'Сборка',
            date_from: new Date().toISOString().slice(0, 10),
            quantity: 1,
        });
        if (ok && data.success) {
            onCreated(data.data);
        } else {
            setError(data.error?.onec_name?.[0] || data.error || 'Ошибка создания');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Новая спецификация
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Поиск изделия */}
                <div className="relative">
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-1">
                        Изделие (номенклатура 1С)
                    </label>
                    <input
                        value={partSearch}
                        onChange={e => handlePartSearch(e.target.value)}
                        placeholder="Начните вводить название..."
                        className="w-full px-3 py-1.5 text-sm rounded-lg
                                   bg-gray-50 dark:bg-gray-800
                                   border border-gray-200 dark:border-gray-700
                                   text-gray-900 dark:text-white
                                   focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                    {partResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50
                                        bg-white dark:bg-gray-900
                                        border border-gray-200 dark:border-gray-700
                                        rounded-lg shadow-lg mt-0.5
                                        max-h-48 overflow-y-auto">
                            {partResults.map(part => (
                                <button key={part.id}
                                    onClick={() => handlePartSelect(part)}
                                    className="w-full text-left px-3 py-2 text-xs
                                               hover:bg-gray-50 dark:hover:bg-gray-800
                                               border-b border-gray-50 last:border-0">
                                    <div className="text-gray-900 dark:text-white">
                                        {part.onec_name}
                                    </div>
                                    {part.sku && (
                                        <div className="text-gray-400 text-[10px]">{part.sku}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Название спецификации */}
                <div>
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-1">
                        Название спецификации
                    </label>
                    <input
                        value={specName}
                        onChange={e => setSpecName(e.target.value)}
                        placeholder="КЭВ-45П5033Е(Сборка)"
                        className="w-full px-3 py-1.5 text-sm rounded-lg
                                   bg-gray-50 dark:bg-gray-800
                                   border border-gray-200 dark:border-gray-700
                                   text-gray-900 dark:text-white
                                   focus:outline-none focus:border-blue-500"
                    />
                </div>

                {error && (
                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-gray-50 dark:hover:bg-gray-800">
                        Отмена
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading || !specName.trim() || !partSearch.trim()}
                        className="px-4 py-2 text-sm rounded-lg
                                   bg-emerald-600 hover:bg-emerald-700
                                   text-white disabled:opacity-50 transition-colors">
                        {loading ? 'Создание...' : 'Создать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ImportExcelModal({ onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState([]);

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setWarnings([]);
        const { ok, data } = await bomApi.importFromExcel(file);
        if (ok && data.success) {
            if (data.meta?.warnings?.length) {
                setWarnings(data.meta.warnings);
                // Показываем предупреждения но не закрываем — даём прочитать
                setTimeout(() => onImported(data.data), 2000);
            } else {
                onImported(data.data);
            }
        } else {
            setError(data.error || 'Ошибка импорта');
            if (data.data?.errors) {
                setWarnings(data.data.errors);
            }
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Импорт маршрутной карты
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300 text-xl leading-none">
                        ×
                    </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Поддерживаются файлы формата .xlsx (маршрутные карты КЭВ).
                    Спецификация будет создана в статусе «Черновик».
                </p>

                {/* Зона загрузки файла */}
                <label className={`flex flex-col items-center justify-center
                                   border-2 border-dashed rounded-lg p-6 cursor-pointer
                                   transition-colors
                                   ${file
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}>
                    <input
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={e => {
                            setFile(e.target.files[0] || null);
                            setError('');
                            setWarnings([]);
                        }}
                    />
                    {file ? (
                        <>
                            <span className="text-2xl mb-1">✓</span>
                            <span className="text-sm font-medium text-emerald-700
                                             dark:text-emerald-300">
                                {file.name}
                            </span>
                            <span className="text-xs text-gray-400 mt-1">
                                {(file.size / 1024).toFixed(1)} KB
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl mb-1 text-gray-400">📄</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Выберите файл или перетащите сюда
                            </span>
                            <span className="text-xs text-gray-400 mt-1">.xlsx</span>
                        </>
                    )}
                </label>

                {/* Ошибки */}
                {error && (
                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                )}

                {/* Предупреждения */}
                {warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3
                                    border border-amber-200 dark:border-amber-800
                                    max-h-32 overflow-y-auto">
                        <p className="text-xs font-medium text-amber-700
                                      dark:text-amber-300 mb-1">
                            Предупреждения ({warnings.length}):
                        </p>
                        {warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600
                                                   dark:text-amber-400">
                                · {w}
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-gray-50 dark:hover:bg-gray-800
                                   transition-colors">
                        Отмена
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || !file}
                        className="px-4 py-2 text-sm rounded-lg
                                   bg-emerald-600 hover:bg-emerald-700
                                   text-white disabled:opacity-50 transition-colors">
                        {loading ? 'Импорт...' : 'Импортировать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Список спецификаций ──────────────────────────────────────────────────────

function SpecList({ specs, loading, canWrite, onOpen, onRefresh, onSearch }) {
    const [pullOpen, setPullOpen] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importPdfOpen, setImportPdfOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);


    return (
        <div className="max-w-5xl mx-auto space-y-4">
            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Редактор спецификаций
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Ресурсные спецификации 1С
                    </p>
                </div>
                {canWrite && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCreateOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg
                       bg-emerald-600 hover:bg-emerald-700
                       text-white transition-colors">
                            + Новая спецификация
                        </button>
                        <button
                            onClick={() => setSyncModalOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            ↻ Синхронизация данных
                        </button>
                        <button
                            onClick={() => setPullOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg
                       bg-blue-600 hover:bg-blue-700
                       text-white transition-colors">
                            ↓ Загрузить из 1С
                        </button>
                        <button
                            onClick={() => setGroupsOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border
                                    border-gray-200 dark:border-gray-700
                                    text-gray-600 dark:text-gray-400
                                    hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            ⚙ Группы материалов
                        </button>

                        {groupsOpen && <MaterialGroupsModal onClose={() => setGroupsOpen(false)} />}
                    </div>

                )}
            </div>

            <div className="flex gap-2">
                <input
                    placeholder="Поиск по названию спецификации или изделия..."
                    onChange={e => onSearch(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg
                               bg-white dark:bg-gray-900
                               border border-gray-200 dark:border-gray-700
                               text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                />
            </div>

            {/* Pull модалка */}
            {pullOpen && (
                <PullModal
                    onClose={() => setPullOpen(false)}
                    onPulled={() => { setPullOpen(false); onRefresh(); }}
                />
            )}

            <button
                onClick={() => setImportOpen(true)}
                className="px-3 py-1.5 text-sm rounded-lg
               bg-emerald-600 hover:bg-emerald-700
               text-white transition-colors">
                ↑ Импорт из Excel
            </button>

            <button
                onClick={() => setImportPdfOpen(true)} // создайте такой state
                className="px-3 py-1.5 text-sm rounded-lg
                        bg-orange-600 hover:bg-orange-700
                        text-white transition-colors">
                📄 Импорт из PDF (спецификация)
            </button>

            {importOpen && (
                <ImportExcelModal
                    onClose={() => setImportOpen(false)}
                    onImported={() => { setImportOpen(false); onRefresh(); }}
                />
            )}

            {importPdfOpen && (
                <ImportPdfModal
                    onClose={() => setImportPdfOpen(false)}
                    onImported={() => { setImportPdfOpen(false); onRefresh(); }}
                />
            )}

            {createOpen && (
                <CreateSpecModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={(spec) => { setCreateOpen(false); onRefresh(); }}
                />
            )}

            {syncModalOpen && (
                <SyncModal
                    onClose={() => setSyncModalOpen(false)}
                    onRefresh={onRefresh}
                />
            )}

            {/* Таблица */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-visible">
                {loading ? (
                    <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                        Загрузка...
                    </div>
                ) : specs.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                        Нет спецификаций. Загрузите из 1С или создайте новую.
                    </div>
                ) : (
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800">
                                <th className="text-left px-4 py-3 text-xs font-medium
                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-80">
                                    Спецификация
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium
                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-48">
                                    Изделие
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium
                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">
                                    Тип процесса
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium
                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">
                                    Статус
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium
                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">
                                    Обновлено
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {specs.map((spec, idx) => (
                                <tr key={spec.id}
                                    onClick={() => onOpen(spec.id)}
                                    className={`border-b border-gray-50 dark:border-gray-800
                                            hover:bg-gray-50 dark:hover:bg-gray-800/50 
                                            transition-colors cursor-pointer
                                            ${idx % 2 === 1 ? 'bg-gray-50/30 dark:bg-gray-800/20' : ''}`}>
                                    <td className="px-4 py-3 truncate">
                                        <div className="font-medium text-gray-900 dark:text-white truncate"
                                            title={spec.onec_name}>
                                            {spec.onec_name}
                                        </div>
                                        {spec.locked_by && (
                                            <div className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                                                🔒 {spec.locked_by_name}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate"
                                        title={spec.part_name}>
                                        {spec.part_name}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                        {spec.process_type || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium ${STATUS_COLOR[spec.status]}`}>
                                            {STATUS_LABEL[spec.status] || spec.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                                        {new Date(spec.created_at).toLocaleDateString('ru-RU')}
                                    </td>
                                    {/* кнопка убрана */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ─── Редактор спецификации ────────────────────────────────────────────────────

function SpecEditor({ spec: initialSpec, onClose, onSaved, canWrite, canPush }) {
    const [spec, setSpec] = useState(initialSpec);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [validation, setValidation] = useState(null);
    const [presets, setPresets] = useState([]);
    const [sheetMappings, setSheetMappings] = useState([]);

    useEffect(() => {
        bomApi.getStagePresets().then(({ ok, data }) => {
            if (ok && data.success) setPresets(data.data);
        });
        bomApi.getSheetMappings().then(({ ok, data }) => {
            if (ok && data.success) setSheetMappings(data.data);
        });
    }, []);

    const reload = async () => {
        const { ok: ok2, data: data2 } = await bomApi.getSpec(spec.id);
        if (ok2 && data2.success) {
            setSpec(data2.data);
            onSaved(data2.data);
        }
    };

    const handleHeaderSave = async (fields) => {
        setSaving(true);
        await bomApi.updateSpec(spec.id, fields);
        await reload();
        setSaving(false);
    };

    const handleMaterialsSave = async (materials) => {
        setSaving(true);
        const payload = materials.map(m => ({
            ...m,
            source_material: m.source_material_id ?? null,
            stage_preset: m.stage_preset_id ?? null,
            // Для покупных: если part_name пустой — берём из source_material_name
            part_name: m.part_name || m.source_material_name || '',
            // Если part не выбран но source_material выбран — используем его как part
            part: m.part ?? (m.in_process ? null : (m.source_material_id ?? null)),
        }));
        await bomApi.updateMaterials(spec.id, payload);
        await reload();
        setSaving(false);
    };

    const handleValidate = async () => {
        setValidating(true);
        setValidation(null);
        const { ok, data } = await bomApi.validateSpec(spec.id);
        if (ok && data.success) setValidation(data.data);
        await reload();
        setValidating(false);
    };

    const handlePush = async () => {
        setPushing(true);
        setValidation(null);
        const { ok, data } = await bomApi.pushSpec(spec.id);
        if (data.data && !data.data.success) setValidation(data.data);
        await reload();
        setPushing(false);
    };

    const handleCreateDetails = async () => {
        setPushing(true);
        setValidation(null);
        const folderId = spec.default_nomenclature_folder || null;
        const { ok, data } = await bomApi.createDetails(spec.id, folderId);
        if (!data.success && data.data?.errors?.length) {
            setValidation({ is_valid: false, errors: data.data.errors, warnings: [] });
        }
        await reload();
        setPushing(false);
    };

    const handlePushAssembly = async () => {
        setPushing(true);
        setValidation(null);
        const { ok, data } = await bomApi.pushSpec(spec.id);
        if (data.data && !data.data.success) setValidation(data.data);
        await reload();
        setPushing(false);
    };

    return (
        <div className="w-full space-y-4">
            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="text-sm text-gray-500 dark:text-gray-400
                                   hover:text-gray-700 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {spec.onec_name}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-medium ${STATUS_COLOR[spec.status]}`}>
                                {STATUS_LABEL[spec.status]}
                            </span>
                            {spec.onec_status && (
                                <span className="text-xs text-gray-400">
                                    · 1С: {spec.onec_status}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {canWrite && (
                        <button onClick={handleValidate} disabled={validating}
                            className="px-3 py-1.5 text-sm rounded-lg border
                       border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-50 dark:hover:bg-gray-800
                       disabled:opacity-50 transition-colors">
                            {validating ? 'Проверка...' : '✓ Проверить'}
                        </button>
                    )}
                    {canPush && (
                        <button
                            onClick={handleCreateDetails}
                            disabled={pushing || !spec.default_nomenclature_folder}
                            title={!spec.default_nomenclature_folder ? 'Выберите папку номенклатуры деталей' : ''}
                            className="px-3 py-1.5 text-sm rounded-lg
                       border border-blue-600
                       text-blue-600 dark:text-blue-400
                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                       disabled:opacity-50 transition-colors">
                            {pushing ? '...' : '⚙ Создать детали'}
                        </button>
                    )}
                    {canPush && (
                        <button
                            onClick={handlePushAssembly}
                            disabled={pushing || spec.status === 'pushing' || !spec.folder || !spec.assembly_nomenclature_folder}
                            title={!spec.folder ? 'Выберите папку спецификации сборки' : ''}
                            className="px-3 py-1.5 text-sm rounded-lg
                   bg-emerald-600 hover:bg-emerald-700
                   text-white disabled:opacity-50 transition-colors">
                            {pushing ? '...' : '↑ Загрузить сборку'}
                        </button>
                    )}
                </div>
            </div>

            {validation && <ValidationReport result={validation} />}

            <SpecHeaderForm
                spec={spec}
                onSave={handleHeaderSave}
                saving={saving}
                canWrite={canWrite}
            />

            {/* Только материалы — без табов */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800
                                flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Материалы ({spec.materials?.length ?? 0})
                    </span>
                    {/* Пресет этапов */}
                    {spec.spec_stages?.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Этапы:</span>
                            {spec.spec_stages.map(s => (
                                <span key={s.id}
                                    className="px-2 py-0.5 rounded bg-gray-100
                                               dark:bg-gray-800 text-gray-600
                                               dark:text-gray-400">
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <MaterialsPanel
                        materials={spec.materials || []}
                        presets={presets}
                        sheetMappings={sheetMappings}
                        onSave={handleMaterialsSave}
                        saving={saving}
                        canWrite={canWrite}
                        validation={validation}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Форма заголовка ──────────────────────────────────────────────────────────

function SpecHeaderForm({ spec, onSave, saving, canWrite }) {
    const [form, setForm] = useState({
        onec_name: spec.onec_name,
        stage_name: spec.stage_name,
        process_type: spec.process_type,
        date_from: spec.date_from,
        quantity: spec.quantity,
        default_nomenclature_folder: spec.default_nomenclature_folder || null,
        folder: spec.folder || null,  // ← папка спецификации сборки
    });
    const [dirty, setDirty] = useState(false);
    const [selectedNomFolder, setSelectedNomFolder] = useState(
        spec.default_nomenclature_folder
            ? { id: spec.default_nomenclature_folder, path: spec.default_nomenclature_folder_path || '' }
            : null
    );
    const [selectedSpecFolder, setSelectedSpecFolder] = useState(
        spec.folder
            ? { id: spec.folder, path: spec.folder_path || '' }
            : null
    );
    const [selectedAssemblyFolder, setSelectedAssemblyFolder] = useState(
        spec.assembly_nomenclature_folder
            ? { id: spec.assembly_nomenclature_folder, path: spec.assembly_nomenclature_folder_path || '' }
            : null
    );

    const set = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
        setDirty(true);
    };

    const handleSave = () => { onSave(form); setDirty(false); };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 space-y-4">
            {/* грид полей без изменений */}

            {canWrite && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Папка номенклатуры деталей — без изменений */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка номенклатуры деталей
                            </span>
                            {!selectedNomFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedNomFolder}
                            onChange={f => { setSelectedNomFolder(f); set('default_nomenclature_folder', f.id); }}
                            folderType="manufacture"
                        />
                    </div>

                    {/* Папка спецификации сборки — новое */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка спецификации сборки
                            </span>
                            {!selectedSpecFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана — «Загрузить сборку» недоступно
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedSpecFolder}
                            onChange={f => { setSelectedSpecFolder(f); set('folder', f.id); }}
                            folderType="spec"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка номенклатуры изделия
                            </span>
                            {!selectedAssemblyFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана — «Загрузить сборку» недоступно
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedAssemblyFolder}
                            onChange={f => {
                                setSelectedAssemblyFolder(f);
                                set('assembly_nomenclature_folder', f.id);
                            }}
                            folderType="nomenclature"
                            rootPath="ГОТОВАЯ ПРОДУКЦИЯ"
                        />
                    </div>
                </div>
            )}

            {canWrite && dirty && (
                <div className="flex justify-end">
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-1.5 text-sm rounded-lg bg-blue-600
                                   hover:bg-blue-700 text-white disabled:opacity-50 transition-colors">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Панель материалов ────────────────────────────────────────────────────────

function MaterialsPanel({ materials, presets, sheetMappings, onSave, saving, canWrite, validation }) {
    const [rows, setRows] = useState(materials);
    const [partSearch, setPartSearch] = useState({});
    const [partResults, setPartResults] = useState({});
    const [matSearch, setMatSearch] = useState({});
    const [matResults, setMatResults] = useState({});
    const partRefs = useRef({});
    const matRefs = useRef({});

    useEffect(() => {
        if (!materials.length) return;
        setRows(materials.map(row => {
            // Не перезаписываем если source_material уже задан
            if (row.source_material_id || !row.thickness || !row.material_type) return row;
            const mapping = sheetMappings.find(m =>
                m.material_type === row.material_type &&
                m.thickness === String(row.thickness)
            );
            return mapping
                ? { ...row, source_material_id: mapping.part_id, source_material_name: mapping.part_name }
                : row;
        }));
    }, [materials, sheetMappings]);

    // Дефолтный пресет
    const defaultPreset = presets.find(p => p.is_default);
    const defaultStageName = defaultPreset?.stages?.[0]?.name || '';

    const update = (idx, field, value) => {
        setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    const addRow = () => setRows(r => [...r, {
        stage_name: defaultStageName,
        part: null, part_name: '',
        quantity: 1, unit: 'шт.', in_process: false,
        sort_order: r.length,
        material_type: '', thickness: null, size1: null, size2: null, weight_calc: null,
        source_material_id: null, source_material_name: '',
    }]);

    const removeRow = (idx) => setRows(r => r.filter((_, i) => i !== idx));

    const handlePartSearch = async (idx, q) => {
        setPartSearch(s => ({ ...s, [idx]: q }));
        update(idx, 'part_name', q);
        update(idx, 'part', null);
        if (q.length < 2) { setPartResults(r => ({ ...r, [idx]: [] })); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10 });
        if (ok && data.success) setPartResults(r => ({ ...r, [idx]: data.data }));
    };

    const handlePartSelect = (idx, part) => {
        update(idx, 'part', part.id);
        update(idx, 'part_name', part.onec_name);
        update(idx, 'unit', part.unit);
        setPartSearch(s => ({ ...s, [idx]: '' }));
        setPartResults(r => ({ ...r, [idx]: [] }));
    };

    const handleMatSearch = async (idx, q) => {
        setMatSearch(s => ({ ...s, [idx]: q }));
        update(idx, 'source_material_name', q);
        update(idx, 'source_material_id', null);
        if (q.length < 2) { setMatResults(r => ({ ...r, [idx]: [] })); return; }

        const row = rows[idx];
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            q,
        );
        if (ok && data.success) setMatResults(r => ({ ...r, [idx]: data.data }));
    };

    const handleMatSelect = (idx, part) => {
        update(idx, 'source_material_id', part.id);
        update(idx, 'source_material_name', part.onec_name);
        setMatSearch(s => ({ ...s, [idx]: undefined }));
        setMatResults(r => ({ ...r, [idx]: [] }));
    };

    const errorMap = {};
    if (validation?.errors) {
        validation.errors.forEach(e => {
            const match = e.field?.match(/^material_(\d+)$/);
            if (match) errorMap[e.part_name] = e.message;
        });
    }

    const dirty = JSON.stringify(rows) !== JSON.stringify(materials);

    return (
        <div className="space-y-3">
            {rows.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                    Нет материалов
                </p>
            ) : (
                <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table style={{ minWidth: '1000px' }} className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase
                                           border-b border-gray-100 dark:border-gray-800">
                                <th className="text-left py-2 pr-3 w-36">Пресет</th>
                                <th className="text-left py-2 pr-3">Деталь</th>
                                <th className="text-left py-2 pr-3 w-24">Чертёж</th>
                                <th className="text-left py-2 pr-3 w-24">Тип мат.</th>
                                <th className="text-left py-2 pr-3 w-28">Т×Р1×Р2</th>
                                <th className="text-left py-2 pr-3 w-16">Вес, кг</th>
                                <th className="text-left py-2 pr-3 min-w-44">Материал 1С</th>
                                <th className="text-left py-2 pr-3 w-20">Кол-во</th>
                                <th className="text-left py-2 pr-3 w-14">Ед.</th>
                                <th className="text-left py-2 pr-3 w-20">В процессе</th>
                                {canWrite && <th className="w-6" />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => {
                                const hasError = errorMap[row.part_name];
                                // Предупреждение: есть толщина но не выбран материал 1С
                                const missingMat = row.thickness && !row.source_material_id;
                                return (
                                    <tr key={idx}
                                        className={`border-b border-gray-50 dark:border-gray-800
                                            ${hasError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>

                                        {/* Пресет */}
                                        <td className="py-1.5 pr-3">
                                            <select
                                                value={row.stage_preset_id || ''}
                                                onChange={e => update(idx, 'stage_preset_id', e.target.value || null)}
                                                disabled={!canWrite}
                                                className={`${inputCls} text-xs`}>
                                                <option value="">—</option>
                                                {presets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Деталь с autocomplete */}
                                        <td className="py-1.5 pr-3 relative">
                                            <div className="flex items-center gap-1">
                                                {row.detail_spec && (
                                                    <span
                                                        title={
                                                            row.detail_spec_status === 'pushed'
                                                                ? 'Уже существует в 1С'
                                                                : 'Спецификация детали создана'
                                                        }
                                                        className={`text-xs shrink-0 ${row.detail_spec_status === 'pushed'
                                                            ? 'text-blue-400'   // ● уже была
                                                            : 'text-emerald-500' // ✓ создана сейчас
                                                            }`}>
                                                        {row.detail_spec_status === 'pushed' ? '●' : '✓'}
                                                    </span>
                                                )}
                                                <input
                                                    ref={el => { if (el) partRefs.current[idx] = el; }}
                                                    value={partSearch[idx] ?? row.part_name}
                                                    onChange={e => handlePartSearch(idx, e.target.value)}
                                                    disabled={!canWrite}
                                                    className={`${inputCls} ${hasError ? 'border-red-300' : ''}`}
                                                    placeholder="Наименование"
                                                />
                                            </div>
                                            <Dropdown
                                                anchorRef={{ current: partRefs.current[idx] }}
                                                items={partResults[idx] || []}
                                                onSelect={part => handlePartSelect(idx, part)}
                                                renderItem={part => (
                                                    <div>
                                                        <div className="text-gray-900 dark:text-white">{part.onec_name}</div>
                                                        {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                                                    </div>
                                                )}
                                            />
                                        </td>

                                        {/* Чертёж — readonly */}
                                        <td className="py-1.5 pr-3">
                                            <span className="text-xs text-gray-400">{row.drawing_number || '—'}</span>
                                        </td>

                                        {/* Тип материала — readonly */}
                                        <td className="py-1.5 pr-3">
                                            <span className="text-xs text-gray-500">{row.material_type || '—'}</span>
                                        </td>

                                        {/* Размеры — readonly */}
                                        <td className="py-1.5 pr-3">
                                            {row.thickness ? (
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                    {row.thickness}×{row.size1}×{row.size2}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                            )}
                                        </td>

                                        {/* Вес — readonly если есть thickness (считается автоматически), иначе редактируемый */}
                                        <td className="py-1.5 pr-3">
                                            {row.thickness ? (
                                                row.weight_calc ? (
                                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                        {parseFloat(row.weight_calc).toFixed(3)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                )
                                            ) : (
                                                <input
                                                    type="number" min={0} step="0.001"
                                                    value={row.weight_calc || ''}
                                                    onChange={e => update(idx, 'weight_calc', e.target.value || null)}
                                                    disabled={!canWrite}
                                                    placeholder="0.000"
                                                    className={inputCls}
                                                />
                                            )}
                                        </td>

                                        {/* Материал 1С — autocomplete, всегда активно */}
                                        <td className="py-1.5 pr-3 relative">
                                            <MaterialCombobox
                                                row={row}
                                                idx={idx}
                                                canWrite={canWrite}
                                                onSelect={handleMatSelect}
                                                matRefs={matRefs}
                                            />
                                        </td>

                                        {/* Количество */}
                                        <td className="py-1.5 pr-3">
                                            <input
                                                type="number" min={0} step="0.001"
                                                value={row.quantity}
                                                onChange={e => update(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                disabled={!canWrite}
                                                className={inputCls}
                                            />
                                        </td>

                                        {/* Единица */}
                                        <td className="py-1.5 pr-3">
                                            <input
                                                value={row.unit}
                                                onChange={e => update(idx, 'unit', e.target.value)}
                                                disabled={!canWrite}
                                                className={inputCls}
                                                placeholder="шт."
                                            />
                                        </td>

                                        {/* В процессе */}
                                        <td className="py-1.5 pr-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={row.in_process}
                                                onChange={e => update(idx, 'in_process', e.target.checked)}
                                                disabled={!canWrite}
                                                className="w-4 h-4 rounded"
                                            />
                                        </td>

                                        {canWrite && (
                                            <td className="py-1.5">
                                                <button onClick={() => removeRow(idx)}
                                                    className="text-gray-300 dark:text-gray-600
                                                               hover:text-red-500 transition-colors
                                                               text-base leading-none">
                                                    ×
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Липкая нижняя панель действий */}
            {canWrite && (
                <div className="sticky bottom-0 left-0 right-0 -mx-4 -mb-4 mt-2
                                bg-white/80 dark:bg-gray-900/80 backdrop-blur-md
                                border-t border-gray-100 dark:border-gray-800
                                p-4 flex items-center justify-between z-20
                                rounded-b-lg shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                                   text-blue-600 dark:text-blue-400 hover:bg-blue-50 
                                   dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                        <span className="text-lg leading-none">+</span>
                        Добавить материал
                    </button>

                    <div className="flex items-center gap-4">
                        {dirty && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                                Есть несохраненные изменения
                            </span>
                        )}
                        <button
                            onClick={() => onSave(rows)}
                            disabled={saving || !dirty}
                            className={`px-6 py-2 text-sm font-semibold rounded-lg shadow-sm
                                        transition-all duration-200
                                        ${dirty
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white scale-105'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                }
                                        disabled:opacity-50`}
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Сохранение...
                                </span>
                            ) : 'Сохранить изменения'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MaterialCombobox ─────────────────────────────────────────────────────────

function MaterialCombobox({ row, idx, canWrite, onSelect, matRefs }) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null); // Реф для контейнера инпута

    const context = row.in_process ? 'detail' : 'assembly';

    // Закрытие по клику вне инпута и вне выпадающего списка
    useEffect(() => {
        if (!open) return;

        // Универсальная функция закрытия
        const closeDropdown = (e) => {
            // Проверяем, не является ли целью клика/скролла сам выпадающий список
            // Используем селектор атрибута, который мы добавили в Dropdown
            const isInsideDropdown = e.target.closest('[data-dropdown="true"]');
            const isInsideInput = containerRef.current && containerRef.current.contains(e.target);

            if (!isInsideDropdown && !isInsideInput) {
                setOpen(false);
            }
        };

        // 1. Клик вне области
        document.addEventListener('mousedown', closeDropdown);

        // 2. Скролл (обязательно с true в конце, чтобы поймать событие на любом уровне)
        window.addEventListener('scroll', closeDropdown, true);

        // 3. Колесо мыши (часто работает лучше чем scroll в браузерах)
        window.addEventListener('wheel', closeDropdown, true);

        // 4. Тач-события для мобильных
        window.addEventListener('touchmove', closeDropdown, true);

        return () => {
            document.removeEventListener('mousedown', closeDropdown);
            window.removeEventListener('scroll', closeDropdown, true);
            window.removeEventListener('wheel', closeDropdown, true);
            window.removeEventListener('touchmove', closeDropdown, true);
        };
    }, [open]);

    const handleFocus = async () => {
        setOpen(true);
        if (options.length) return;
        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            '',
            context,
        );
        if (ok && data.success) setOptions(data.data);
        setLoading(false);
    };

    const handleChange = async (q) => {
        setQuery(q);
        setOpen(true);
        if (q.length < 2) return;

        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            q,
            context,
        );
        if (ok && data.success) setOptions(data.data);
        setLoading(false);
    };

    const handleSelect = (part) => {
        onSelect(idx, part);
        setQuery('');
        setOpen(false);
    };

    const filtered = query.trim()
        ? options.filter(p => p.onec_name.toLowerCase().includes(query.toLowerCase()))
        : options;

    const displayValue = query !== '' ? query : (row.source_material_name || '');

    if (inputRef.current && !matRefs.current[idx]) {
        matRefs.current[idx] = inputRef.current;
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    value={displayValue}
                    onChange={e => handleChange(e.target.value)}
                    onFocus={handleFocus}
                    // onBlur={handleBlur} <-- УДАЛЯЕМ ЭТО
                    disabled={!canWrite}
                    placeholder="Выберите материал..."
                    className={`${inputCls} pr-7 ${row.thickness && !row.source_material_id
                        ? 'border-amber-400'
                        : ''
                        }`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">
                    ▾
                </span>
            </div>

            {open && (
                <Dropdown
                    anchorRef={inputRef}
                    items={loading ? [{ id: '__loading__', onec_name: 'Загрузка...' }] : filtered}
                    onSelect={part => part.id !== '__loading__' && handleSelect(part)}
                    renderItem={part => part.id === '__loading__'
                        ? <span className="text-gray-400 italic">Загрузка...</span>
                        : (
                            <div>
                                <div className="text-gray-900 dark:text-white">{part.onec_name}</div>
                                {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                            </div>
                        )
                    }
                />
            )}
        </div>
    );
}

// ─── Модалка pull из 1С ───────────────────────────────────────────────────────

function PullModal({ onClose, onPulled }) {
    const [mode, setMode] = useState('product'); // product | name
    const [value, setValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePull = async () => {
        if (!value.trim()) return;
        setLoading(true);
        setError('');
        const payload = mode === 'product'
            ? { product_name: value.trim() }
            : { name: value.trim() };
        const { ok, data } = await bomApi.pullSpec(payload);
        if (ok && data.success) {
            onPulled(data.data);
        } else {
            setError(data.error || 'Ошибка загрузки');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Загрузить спецификацию из 1С
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300 text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Режим поиска */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {[
                        { id: 'product', label: 'По изделию' },
                        { id: 'name', label: 'По имени спецификации' },
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setMode(m.id); setValue(''); setError(''); }}
                            className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors
                                ${mode === m.id
                                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                            {m.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <input
                        value={value}
                        onChange={e => { setValue(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handlePull()}
                        placeholder={mode === 'product'
                            ? 'КЭВ-4П1141Е'
                            : 'КЭВ-4П1141Е(Сборка)'
                        }
                        className={`${inputCls} w-full`}
                        autoFocus
                    />
                    {error && (
                        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-gray-50 dark:hover:bg-gray-800
                                   transition-colors">
                        Отмена
                    </button>
                    <button
                        onClick={handlePull}
                        disabled={loading || !value.trim()}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                   hover:bg-blue-700 text-white
                                   disabled:opacity-50 transition-colors">
                        {loading ? 'Загрузка...' : 'Загрузить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Отчёт валидации ──────────────────────────────────────────────────────────

function ValidationReport({ result }) {
    if (!result) return null;

    return (
        <div className={`rounded-lg border p-4 space-y-2
            ${result.is_valid
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
            <div className={`text-sm font-medium
                ${result.is_valid
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                {result.is_valid ? '✓ Проверка пройдена' : `✗ Найдено ошибок: ${result.errors?.length}`}
            </div>

            {result.errors?.length > 0 && (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {result.errors.map((e, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400 flex gap-2">
                            <span className="shrink-0">·</span>
                            <span>
                                {e.part_name && <strong>{e.part_name}: </strong>}
                                {e.message}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {result.warnings?.length > 0 && (
                <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                            <span className="shrink-0">⚠</span>
                            <span>{w.message}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ImportPdfModal({ onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState([]);

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setWarnings([]);

        const { ok, data } = await bomApi.importFromPdf(file);

        if (ok && data.success) {
            if (data.meta?.warnings?.length) {
                setWarnings(data.meta.warnings);
                setTimeout(() => onImported(data.data), 2000);
            } else {
                onImported(data.data);
            }
        } else {
            setError(data.error || 'Ошибка импорта PDF');
            if (data.data?.errors) {
                setWarnings(data.data.errors);
            }
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Импорт чертежа (PDF)
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ×
                    </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Выберите PDF файл с чертежом. Система попытается извлечь таблицу
                    спецификации со страниц "Материалы и элементы".
                </p>

                <label className={`flex flex-col items-center justify-center
                                   border-2 border-dashed rounded-lg p-6 cursor-pointer
                                   transition-colors
                                   ${file
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}>
                    <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => {
                            setFile(e.target.files[0] || null);
                            setError('');
                            setWarnings([]);
                        }}
                    />
                    {file ? (
                        <>
                            <span className="text-2xl mb-1">📄</span>
                            <span className="text-sm font-medium text-orange-700 dark:text-orange-300 text-center">
                                {file.name}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl mb-1 text-gray-400">📤</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Нажмите для выбора PDF
                            </span>
                        </>
                    )}
                </label>

                {error && <p className="text-xs text-red-500">{error}</p>}

                {warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 max-h-32 overflow-y-auto">
                        <p className="text-xs font-medium text-amber-700 mb-1">Предупреждения:</p>
                        {warnings.map((w, i) => <p key={i} className="text-[10px] text-amber-600">· {w}</p>)}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Отмена</button>
                    <button
                        onClick={handleImport}
                        disabled={loading || !file}
                        className="px-4 py-2 text-sm rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
                    >
                        {loading ? 'Обработка...' : 'Импортировать'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SyncModal({ onClose, onRefresh }) {
    const [activeTask, setActiveTask] = useState(null); // { id: '...', label: '...' }
    const [status, setStatus] = useState(''); // 'pending', 'success', 'error'
    const [message, setMessage] = useState('');

    // Функция для периодической проверки статуса задачи Celery
    const pollTaskStatus = async (taskId, label) => {
        const interval = setInterval(async () => {
            const { ok, data } = await bomApi.getTaskStatus(taskId);
            if (ok && data.success) {
                if (data.data.ready) {
                    clearInterval(interval);
                    setStatus('success');
                    setMessage(`${label} успешно завершена`);
                    onRefresh();
                    setTimeout(() => { setActiveTask(null); setStatus(''); }, 3000);
                } else if (data.data.status === 'FAILURE') {
                    clearInterval(interval);
                    setStatus('error');
                    setMessage(`Ошибка при выполнении: ${label}`);
                }
            }
        }, 2000);
    };

    const handleSyncAction = async (actionType, label) => {
        setStatus('pending');
        setMessage(`Запуск: ${label}...`);
        
        let result;
        if (actionType === 'nomenclature') {
            result = await bomApi.syncParts('', 100);
        } else if (actionType === 'production_folders') {
            result = await bomApi.syncNomenclatureFolders('ПРОИЗВОДСТВО');
        } else if (actionType === 'spec_folders') {
            result = await bomApi.syncFolders();
        } else if (actionType === 'all_bom') {
            result = await bomApi.syncFolder({}); // Запуск всех тяжелых конфигов
        }

        const { ok, data } = result;
        if (ok && data.success) {
            if (data.data?.task_id) {
                // Если бэкенд вернул ID фоновой задачи
                setActiveTask({ id: data.data.task_id, label });
                pollTaskStatus(data.data.task_id, label);
            } else {
                // Если бэкенд выполнил всё синхронно
                setStatus('success');
                setMessage(`${label} завершена`);
                onRefresh();
                setTimeout(() => { setStatus(''); setMessage(''); }, 2000);
            }
        } else {
            setStatus('error');
            setMessage(data.error || 'Ошибка при запуске');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Синхронизация данных 1С</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-3">
                    <SyncButton 
                        label="Номенклатура (Детали/Материалы)" 
                        description="Обновляет названия, артикулы и единицы измерения"
                        icon="📦"
                        loading={status === 'pending'}
                        onClick={() => handleSyncAction('nomenclature', 'Синхронизация номенклатуры')}
                    />

                    <SyncButton 
                        label="Пути производства" 
                        description="Обновляет дерево папок в разделе ПРОИЗВОДСТВО"
                        icon="🏭"
                        loading={status === 'pending'}
                        onClick={() => handleSyncAction('production_folders', 'Синхронизация путей производства')}
                    />

                    <SyncButton 
                        label="Папки спецификаций" 
                        description="Обновляет дерево папок для хранения спецификаций"
                        icon="📁"
                        loading={status === 'pending'}
                        onClick={() => handleSyncAction('spec_folders', 'Синхронизация папок спецификаций')}
                    />

                    <hr className="my-4 border-gray-100 dark:border-gray-800" />

                    <SyncButton 
                        label="Полная синхронизация" 
                        description="Запуск всех фоновых процессов обновления BOM"
                        icon="⚡"
                        variant="primary"
                        loading={status === 'pending'}
                        onClick={() => handleSyncAction('all_bom', 'Полная синхронизация')}
                    />
                </div>

                {/* Статус-бар внизу модалки */}
                {message && (
                    <div className={`px-6 py-3 text-xs font-medium border-t flex items-center gap-2
                        ${status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          status === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 
                          'bg-blue-50 text-blue-700 border-blue-100 animate-pulse'}`}>
                        {status === 'pending' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}

// Вспомогательный компонент кнопки
function SyncButton({ label, description, icon, onClick, loading, variant = 'secondary' }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 group
                ${variant === 'primary' 
                    ? 'bg-blue-600 border-blue-700 hover:bg-blue-700 text-white' 
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <span className="text-2xl">{icon}</span>
            <div className="flex-1">
                <div className={`text-sm font-semibold ${variant === 'primary' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {label}
                </div>
                <div className={`text-[11px] mt-0.5 ${variant === 'primary' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {description}
                </div>
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">→</span>
        </button>
    );
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

function Field({ label, children, span = 1 }) {
    return (
        <div className={span === 2 ? 'col-span-2' : ''}>function
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}

const inputCls = `w-full px-3 py-1.5 text-sm rounded-lg
    bg-gray-50 dark:bg-gray-800
    border border-gray-200 dark:border-gray-700
    text-gray-900 dark:text-white
    focus:outline-none focus:border-blue-500
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-colors`;