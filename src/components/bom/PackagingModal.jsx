import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bomApi } from '../../api/bom';
import { catalogApi } from '../../api/catalog';
import { useModals } from '../../hooks/useModals';
import Dropdown from '../common/Dropdown';
import { inputCls } from '../../utils/styles';

function PackagingCreateForm({ packTypes, onSaved, onCancel }) {
    const [form, setForm] = useState({
        name: '', length: '', width: '', height: '',
        weight: '', package_type: '', qty_on_pallet: '', qty_in_order: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!form.name.trim()) { setError('Укажите наименование'); return; }
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            length: parseInt(form.length) || 0,
            width: parseInt(form.width) || 0,
            height: parseInt(form.height) || 0,
            weight: parseFloat(form.weight) || 0,
            package_type: form.package_type,
            qty_on_pallet: parseInt(form.qty_on_pallet) || 0,
            qty_in_order: parseInt(form.qty_in_order) || 0,
        };
        const { ok, data } = await bomApi.createPackagingItem(payload);
        if (ok && data.success) {
            onSaved(data.data);
        } else {
            setError(data.error || 'Ошибка создания');
        }
        setSaving(false);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Новая тара</h4>
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        Наименование *
                    </label>
                    <input value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Точное наименование как в 1С"
                        className={inputCls} autoFocus />
                </div>
                {[
                    { key: 'length', label: 'Длина, мм' },
                    { key: 'width', label: 'Ширина, мм' },
                    { key: 'height', label: 'Высота, мм' },
                    { key: 'weight', label: 'Масса, кг' },
                    { key: 'qty_on_pallet', label: 'Кол-во на палете' },
                    { key: 'qty_in_order', label: 'Кол-во в заказе' },
                ].map(({ key, label }) => (
                    <div key={key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                        <input type="number" min={0}
                            value={form[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={inputCls} />
                    </div>
                ))}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Вид тары</label>
                    <select value={form.package_type}
                        onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))}
                        className={inputCls}>
                        <option value="">—</option>
                        {packTypes.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
                <button onClick={onCancel}
                    className="flex-1 border border-gray-200 dark:border-gray-700
                               text-gray-600 dark:text-gray-400 text-sm py-2 rounded-lg
                               hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    Отмена
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700
                               text-white text-sm py-2 rounded-lg disabled:opacity-50">
                    {saving ? 'Создание...' : 'Создать'}
                </button>
            </div>
        </div>
    );
}

function PackagingDetail({ item, packTypes, onUpdated, onDeleted }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        length: item.length,
        width: item.width,
        height: item.height,
        weight: item.weight,
        package_type: item.package_type,
        qty_on_pallet: item.qty_on_pallet,
        qty_in_order: item.qty_in_order,
    });
    const { showConfirm, showAlert, modals } = useModals();
    const [saving, setSaving] = useState(false);
    const [matSearch, setMatSearch] = useState('');
    const [matResults, setMatResults] = useState([]);
    const [addingMat, setAddingMat] = useState(false);
    const matRef = useRef(null);

    const handleSave = async () => {
        setSaving(true);
        const { ok, data } = await bomApi.updatePackagingItem(item.id, {
            length: parseInt(form.length) || 0,
            width: parseInt(form.width) || 0,
            height: parseInt(form.height) || 0,
            weight: parseFloat(form.weight) || 0,
            package_type: form.package_type,
            qty_on_pallet: parseInt(form.qty_on_pallet) || 0,
            qty_in_order: parseInt(form.qty_in_order) || 0,
        });
        if (ok && data.success) {
            onUpdated(data.data);
            setEditing(false);
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        showConfirm(`Удалить тару «${item.name}»?`, async () => {
            const { ok, data } = await bomApi.deletePackagingItem(item.id);
            if (ok && data.success) onDeleted();
        });
    };

    const handleMatSearch = async (q) => {
        setMatSearch(q);
        if (q.length < 2) { setMatResults([]); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10, is_synced: true });
        if (ok && data.success) setMatResults(data.data);
    };

    const handleAddMat = async (part) => {
        setAddingMat(true);
        const { ok, data } = await bomApi.addPackagingMaterial(item.id, { part_id: part.id });
        if (ok && data.success) onUpdated(data.data);
        setMatSearch('');
        setMatResults([]);
        setAddingMat(false);
    };

    const handleRemoveMat = async (materialId) => {
        const { ok, data } = await bomApi.removePackagingMaterial(item.id, materialId);
        if (ok && data.success) onUpdated(data.data);
    };

    return (
        <div className="space-y-4">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {item.name}
                    </h4>
                    {item.is_dirty && (
                        <span className="text-xs text-amber-500">● Не синхронизировано с 1С</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setEditing(e => !e)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        {editing ? 'Отмена' : 'Редактировать'}
                    </button>
                    <button onClick={handleDelete}
                        className="text-xs text-red-500 hover:underline">
                        Удалить
                    </button>
                </div>
            </div>

            {/* Форма редактирования */}
            {editing ? (
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { key: 'length', label: 'Длина, мм' },
                        { key: 'width', label: 'Ширина, мм' },
                        { key: 'height', label: 'Высота, мм' },
                        { key: 'weight', label: 'Масса, кг' },
                        { key: 'qty_on_pallet', label: 'Кол-во на палете' },
                        { key: 'qty_in_order', label: 'Кол-во в заказе' },
                    ].map(({ key, label }) => (
                        <div key={key}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                            <input type="number" min={0}
                                value={form[key]}
                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                className={inputCls} />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Вид тары</label>
                        <select value={form.package_type}
                            onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))}
                            className={inputCls}>
                            <option value="">—</option>
                            {packTypes.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <button onClick={handleSave} disabled={saving}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                       hover:bg-blue-700 text-white disabled:opacity-50">
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 text-sm bg-neutral-50
                                dark:bg-neutral-800 rounded-lg p-3">
                    {[
                        ['Длина', `${item.length} мм`],
                        ['Ширина', `${item.width} мм`],
                        ['Высота', `${item.height} мм`],
                        ['Масса', item.weight > 0 ? `${item.weight} кг` : '—'],
                        ['Вид тары', item.package_type || '—'],
                        ['На палете', item.qty_on_pallet || '—'],
                        ['В заказе', item.qty_in_order || '—'],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <span className="text-xs text-gray-400">{label}: </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Материалы тары */}
            <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Материалы упаковки ({item.materials?.length ?? 0})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto mb-2">
                    {item.materials?.map(m => (
                        <div key={m.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg
                                       bg-neutral-50 dark:bg-neutral-800 text-sm">
                            <div className="min-w-0">
                                <span className="text-gray-800 dark:text-gray-200 truncate">
                                    {m.part_name}
                                </span>
                                <span className="text-gray-400 text-xs ml-2">
                                    {m.quantity} {m.unit}
                                </span>
                            </div>
                            <button onClick={() => handleRemoveMat(m.id)}
                                className="text-gray-300 dark:text-gray-600
                                           hover:text-red-500 transition-colors shrink-0 ml-2">
                                ×
                            </button>
                        </div>
                    ))}
                    {(!item.materials || item.materials.length === 0) && (
                        <p className="text-xs text-gray-400 italic">Нет материалов</p>
                    )}
                </div>

                {/* Добавить материал */}
                <div className="relative">
                    <input
                        ref={matRef}
                        value={matSearch}
                        onChange={e => handleMatSearch(e.target.value)}
                        placeholder="Добавить материал..."
                        className={inputCls}
                        disabled={addingMat}
                    />
                    <Dropdown
                        anchorRef={matRef}
                        items={matResults}
                        onSelect={handleAddMat}
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

export default function PackagingModal({ onClose }) {
    const [packList, setPackList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState(null);
    const [packSearch, setPackSearch] = useState('');
    const { showConfirm, showAlert, modals } = useModals();

    // Поиск номенклатуры
    const [nomSearch, setNomSearch] = useState('');
    const [nomResults, setNomResults] = useState([]);
    const [nomOpen, setNomOpen] = useState(false);
    const [selectedNoms, setSelectedNoms] = useState([]);
    const [assignResults, setAssignResults] = useState([]);
    const [assigning, setAssigning] = useState(false);
    const [assignResult, setAssignResult] = useState('');
    const nomRef = useRef(null);

    const PACK_TYPES = [
        { value: 'box', label: 'Box' },
        { value: 'Kor', label: 'Короб' },
        { value: 'cyl', label: 'Бочка (кега)' },
        { value: 'nu', label: 'н/у' },
    ];

    useEffect(() => {
        const t = setTimeout(() => loadItems(), 300);
        return () => clearTimeout(t);
    }, [packSearch]);  // loadItems убрать из зависимостей

    const loadItems = useCallback(async () => {
        setLoading(true);
        const { ok, data } = await bomApi.getPackagingItems(packSearch);
        if (ok && data.success) setPackList(data.data);
        setLoading(false);
    }, [packSearch]);

    // Поиск номенклатуры для назначения тары
    useEffect(() => {
        if (nomSearch.length < 2) { setNomResults([]); setNomOpen(false); return; }
        const t = setTimeout(async () => {
            const { ok, data } = await catalogApi.searchProducts(nomSearch, { limit: 15 });
            if (ok && data.success) { setNomResults(data.data); setNomOpen(true); }
        }, 300);
        return () => clearTimeout(t);
    }, [nomSearch]);

    const handleSync = async () => {
        showConfirm(
            'Синхронизировать данные пак-тары с 1С?\n\nЛокальные изменения будут отправлены в 1С, данные из 1С будут импортированы.',
            async () => {
                setSyncing(true);
                const { ok: okSync, data: dataSync } = await bomApi.syncPackagingItems();
                const { ok: okImport, data: dataImport } = await bomApi.importPackagingFrom1C();
                await loadItems();
                setSyncing(false);
                if (okSync && okImport) {
                    const s = dataSync.data;
                    const i = dataImport.data;
                    showAlert(`Синхронизировано: ${s.synced} → 1С, импортировано: ${i.created} новых, обновлено: ${i.updated}`);
                }
            },
            false
        );
    };

    const handleAssign = async () => {
        if (!selectedNoms.length || !selected) return;
        setAssigning(true);
        setAssignResults([]);
        const results = [];
        for (const nom of selectedNoms) {
            const { ok, data } = await bomApi.setPackaging(nom.name, selected.name);
            results.push({ id: nom.id, ok: ok && data.success, error: data?.error });
        }
        setAssignResults(results);
        const successCount = results.filter(r => r.ok).length;
        const failCount = results.length - successCount;
        setAssignResult(failCount === 0
            ? `✓ Тара назначена на ${successCount} позиц.`
            : `✓ ${successCount} назначено, ✗ ${failCount} ошибок`
        );
        setAssigning(false);
    };

    const filteredPacks = packList;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-5xl
                            max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
                {modals}
                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Пак Тара</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Управление упаковкой номенклатуры 1С
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSync} disabled={syncing}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200
                                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                                       hover:bg-neutral-50 dark:hover:bg-neutral-800
                                       disabled:opacity-50 transition-colors">
                            {syncing ? '⟳ Синхронизация...' : '⟳ Синхронизировать'}
                        </button>
                        <button onClick={() => { setCreating(c => !c); setSelected(null); }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600
                                       hover:bg-emerald-700 text-white transition-colors">
                            {creating ? '✕ Отмена' : '+ Создать тару'}
                        </button>
                        <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Левая колонка — список тары */}
                    <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <input
                                value={packSearch}
                                onChange={e => setPackSearch(e.target.value)}
                                placeholder="Поиск тары..."
                                className={inputCls}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="p-4 text-sm text-gray-400 text-center">Загрузка...</div>
                            ) : filteredPacks.length === 0 ? (
                                <div className="p-4 text-sm text-gray-400 text-center">
                                    Нет тары. Нажмите «Синхронизировать» для импорта из 1С.
                                </div>
                            ) : filteredPacks.map(p => (
                                <div key={p.id}
                                    onClick={() => { setSelected(p); setCreating(false); }}
                                    className={`px-4 py-3 cursor-pointer border-b
                                                border-gray-100 dark:border-gray-800
                                                hover:bg-neutral-50 dark:hover:bg-neutral-800
                                                transition-colors
                                                ${selected?.id === p.id
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                                            : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-900
                                                            dark:text-white truncate" title={p.name}>
                                                {p.name}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {p.length}×{p.width}×{p.height} мм
                                                {p.weight > 0 && ` · ${p.weight} кг`}
                                                {p.package_type && ` · ${p.package_type}`}
                                            </div>
                                        </div>
                                        {p.is_dirty && (
                                            <span className="text-xs text-amber-500 shrink-0 ml-1"
                                                title="Не синхронизировано с 1С">●</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Правая панель */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {creating && (
                            <PackagingCreateForm
                                packTypes={PACK_TYPES}
                                onSaved={(item) => {
                                    setCreating(false);
                                    setSelected(item);
                                    loadItems();
                                }}
                                onCancel={() => setCreating(false)}
                            />
                        )}

                        {selected && !creating && (
                            <PackagingDetail
                                key={selected.id}
                                item={selected}
                                packTypes={PACK_TYPES}
                                onUpdated={(updated) => {
                                    setSelected(updated);
                                    loadItems();
                                }}
                                onDeleted={() => {
                                    setSelected(null);
                                    loadItems();
                                }}
                            />
                        )}

                        {/* Назначить тару на номенклатуру */}
                        {selected && !creating && (
                            <div className="space-y-3 border-t border-gray-100
                                            dark:border-gray-800 pt-4">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Назначить тару на номенклатуру
                                </h4>
                                <div className="relative">
                                    <input
                                        ref={nomRef}
                                        value={nomSearch}
                                        onChange={e => {
                                            setNomSearch(e.target.value);
                                            setAssignResult('');
                                            if (!e.target.value) { setNomOpen(false); setNomResults([]); }
                                        }}
                                        placeholder="Начните вводить название..."
                                        className={inputCls}
                                    />
                                    {nomOpen && (
                                        <Dropdown
                                            anchorRef={nomRef}
                                            items={nomResults}
                                            onSelect={part => {
                                                setSelectedNoms(prev =>
                                                    prev.find(p => p.id === part.id)
                                                        ? prev : [...prev, part]
                                                );
                                            }}
                                            renderItem={part => (
                                                <div>
                                                    <div className="text-gray-900 dark:text-white">{part.name}</div>
                                                    {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                                                </div>
                                            )}
                                        />
                                    )}
                                </div>

                                {selectedNoms.length > 0 && (
                                    <div className="space-y-1">
                                        {selectedNoms.map(nom => {
                                            const result = assignResults.find(r => r.id === nom.id);
                                            return (
                                                <div key={nom.id}
                                                    className="flex items-center justify-between px-3 py-2
                                                               rounded-lg bg-neutral-50 dark:bg-neutral-800
                                                               border border-gray-200 dark:border-gray-700">
                                                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                                        {nom.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        {result && (
                                                            <span className={`text-xs ${result.ok
                                                                ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {result.ok ? '✓' : '✗'}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedNoms(prev =>
                                                                prev.filter(p => p.id !== nom.id)
                                                            )}
                                                            className="text-gray-300 hover:text-red-500">×</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <button
                                            onClick={() => { setSelectedNoms([]); setAssignResults([]); }}
                                            className="text-xs text-gray-400 hover:text-red-500">
                                            Очистить список
                                        </button>
                                    </div>
                                )}

                                <button onClick={handleAssign}
                                    disabled={assigning || !selectedNoms.length || !selected}
                                    className="w-full py-2 text-sm rounded-lg bg-blue-600
                                               hover:bg-blue-700 text-white disabled:opacity-50">
                                    {assigning
                                        ? 'Назначение...'
                                        : `Назначить тару${selectedNoms.length > 1 ? ` (${selectedNoms.length})` : ''}`}
                                </button>
                                {assignResult && (
                                    <p className={`text-xs ${assignResult.startsWith('✓')
                                        ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {assignResult}
                                    </p>
                                )}
                            </div>
                        )}

                        {!selected && !creating && (
                            <div className="flex items-center justify-center h-full
                                            text-sm text-gray-400 dark:text-gray-500">
                                Выберите тару или создайте новую
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
