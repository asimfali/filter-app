import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bomApi } from '../../api/bom';
import { useModals } from '../../hooks/useModals';
import Dropdown from '../common/Dropdown';
import FolderPicker from './FolderPicker';
import { inputCls } from '../../utils/styles';
import { IconFolder,  } from '../common/Icons';

// GroupForm и GroupDetail оставить в этом же файле — используются только здесь

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
                               hover:bg-neutral-50 dark:hover:bg-neutral-800">
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
                            ? <span><IconFolder /> {detail.folder_path}</span>
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
                                       bg-neutral-50 dark:bg-neutral-800 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                {p.from_folder
                                    ? <span className="text-gray-400 text-xs shrink-0"><IconFolder /></span>
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

export default 
function MaterialGroupsModal({ onClose }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null); // открытая группа
    const [creating, setCreating] = useState(false);
    const { showConfirm, showAlert, modals } = useModals();

    const loadGroups = useCallback(async () => {
        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroups();
        if (ok && data.success) setGroups(data.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const handleDelete = async (id) => {
        showConfirm('Удалить группу?', async () => {
            await bomApi.deleteMaterialGroup(id);
            if (selected?.id === id) setSelected(null);
            loadGroups();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-4xl
                            max-h-[90vh] flex flex-col">
                {modals}
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
                                                hover:bg-neutral-50 dark:hover:bg-neutral-800
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
                                            <IconFolder /> {g.folder_path.split(' / ').slice(-2).join(' / ')}
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