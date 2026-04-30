import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { bomApi } from '../../api/bom';
import { useModals } from '../../hooks/useModals';
import CreateSpecModal from '../../components/bom/CreateSpecModal';
import ImportExcelModal from '../../components/bom/ImportExcelModal';
import MaterialGroupsModal from '../../components/bom/MaterialGroupsModal';
import PackagingModal from '../../components/bom/PackagingModal';
import UnitWeightModal from '../../components/bom/UnitWeightModal';
import PullModal from '../../components/bom/PullModal';
import SyncModal from '../../components/bom/SyncModal';
import { IconBox, IconLock } from '../../components/common/Icons';

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

export default function SpecList({ specs, loading, canWrite, canView, onOpen, onRefresh, onSearch }) {
    const [pullOpen, setPullOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null); // {specId, specName, x, y}
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameName, setRenameName] = useState('');
    const [cloneOpen, setCloneOpen] = useState(false);
    const [cloneName, setCloneName] = useState('');
    const [actionSpec, setActionSpec] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [unitWeightOpen, setUnitWeightOpen] = useState(false);
    const [packagingOpen, setPackagingOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const { showConfirm, showAlert, modals } = useModals();

    useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [contextMenu]);

    const handleContextMenu = (e, spec) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ specId: spec.id, specName: spec.onec_name, x: e.clientX, y: e.clientY });
    };

    const handleRename = async () => {
        if (!renameName.trim()) return;
        setActionLoading(true);
        const { ok, data } = await bomApi.updateSpec(actionSpec.specId, { onec_name: renameName.trim() });
        if (ok && data.success) {
            setRenameOpen(false);
            onRefresh();
        } else {
            showAlert(data.error || 'Ошибка переименования');
        }
        setActionLoading(false);
    };

    const handleClone = async () => {
        if (!cloneName.trim()) return;
        setActionLoading(true);
        const { ok, data } = await bomApi.cloneSpec(actionSpec.specId, cloneName.trim());
        if (ok && data.success) {
            setCloneOpen(false);
            onRefresh();
        } else {
            showAlert(data.error || 'Ошибка копирования')
        }
        setActionLoading(false);
    };

    const handleDelete = async (specId) => {
        showConfirm('Удалить спецификацию?', async () => {
            const { ok, data } = await bomApi.deleteSpec(specId);
            if (ok && data.success) onRefresh();
            else showAlert(data.error || 'Ошибка удаления');
        });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            {modals}
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
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                            ↻ Синхронизация данных
                        </button>
                        <button
                            onClick={() => setGroupsOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border
                                    border-gray-200 dark:border-gray-700
                                    text-gray-600 dark:text-gray-400
                                    hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                            ⚙ Группы материалов
                        </button>

                        <button
                            onClick={() => setPackagingOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border
               border-gray-200 dark:border-gray-700
               text-gray-600 dark:text-gray-400
               hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                            <IconBox className="w-4 h-4 inline mr-1" /> Пак Тара
                        </button>

                        {packagingOpen && <PackagingModal onClose={() => setPackagingOpen(false)} />}

                        {groupsOpen && <MaterialGroupsModal onClose={() => setGroupsOpen(false)} />}
                        <button
                            onClick={() => setUnitWeightOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border
               border-gray-200 dark:border-gray-700
               text-gray-600 dark:text-gray-400
               hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                            ⚖ Масса единицы
                        </button>

                        <button onClick={() => setImportOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            ↑ Импорт из Excel
                        </button>

                        {unitWeightOpen && <UnitWeightModal onClose={() => setUnitWeightOpen(false)} />}
                    </div>

                )}
                {/* Загрузка из 1С — доступна всем у кого есть view */}
                <button onClick={() => setPullOpen(true)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    ↓ Загрузить из 1С
                </button>
            </div>

            <div className="flex gap-2">
                <input
                    placeholder="Поиск по названию спецификации или изделия..."
                    onChange={e => onSearch(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg
                               bg-white dark:bg-neutral-900
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

            {importOpen && (
                <ImportExcelModal
                    onClose={() => setImportOpen(false)}
                    onImported={() => { setImportOpen(false); onRefresh(); }}
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
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-visible">
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
                                    onContextMenu={e => handleContextMenu(e, spec)}
                                    className={`border-b border-gray-50 dark:border-gray-800
                                            hover:bg-neutral-50 dark:hover:bg-neutral-800/50 
                                            transition-colors cursor-pointer
                                            ${idx % 2 === 1 ? 'bg-neutral-50/30 dark:bg-neutral-800/20' : ''}`}>
                                    <td className="px-4 py-3 truncate">
                                        <div className="font-medium text-gray-900 dark:text-white truncate"
                                            title={spec.onec_name}>
                                            {spec.onec_name}
                                        </div>
                                        {spec.locked_by && (
                                            <div className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                                                <IconLock /> {spec.locked_by_name}
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
            {/* Контекстное меню */}
            {contextMenu && createPortal(
                <div
                    style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
                    className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl
                   border border-gray-200 dark:border-gray-700
                   py-1 min-w-40"
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            setActionSpec(contextMenu);
                            setCloneName(contextMenu.specName + ' (копия)');
                            setCloneOpen(true);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm
                       text-gray-700 dark:text-gray-300
                       hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        ⎘ Копировать
                    </button>
                    <button
                        onClick={() => {
                            setActionSpec(contextMenu);
                            setRenameName(contextMenu.specName);
                            setRenameOpen(true);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm
                       text-gray-700 dark:text-gray-300
                       hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        ✎ Переименовать
                    </button>
                    {canWrite && (
                        <button
                            onClick={() => {
                                setContextMenu(null);
                                handleDelete(contextMenu.specId);
                            }}
                            className="w-full text-left px-4 py-2 text-sm
                           text-red-600 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20">
                            ✕ Удалить
                        </button>
                    )}
                </div>,
                document.body
            )}

            {/* Модалка переименования */}
            {renameOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                        border border-gray-200 dark:border-gray-700
                        w-full max-w-md p-6 space-y-4">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            Переименовать спецификацию
                        </h2>
                        <input
                            value={renameName}
                            onChange={e => setRenameName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            className="w-full px-3 py-1.5 text-sm rounded-lg
                           bg-neutral-50 dark:bg-neutral-800
                           border border-gray-200 dark:border-gray-700
                           text-gray-900 dark:text-white
                           focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRenameOpen(false)}
                                className="px-4 py-2 text-sm text-gray-500">Отмена</button>
                            <button onClick={handleRename} disabled={actionLoading || !renameName.trim()}
                                className="px-4 py-2 text-sm rounded-lg bg-blue-600
                               hover:bg-blue-700 text-white disabled:opacity-50">
                                {actionLoading ? '...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модалка копирования */}
            {cloneOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                        border border-gray-200 dark:border-gray-700
                        w-full max-w-md p-6 space-y-4">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            Копировать спецификацию
                        </h2>
                        <p className="text-xs text-gray-500">
                            Копия: <span className="font-medium">{actionSpec?.specName}</span>
                        </p>
                        <input
                            value={cloneName}
                            onChange={e => setCloneName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleClone()}
                            placeholder="Название новой спецификации"
                            className="w-full px-3 py-1.5 text-sm rounded-lg
                           bg-neutral-50 dark:bg-neutral-800
                           border border-gray-200 dark:border-gray-700
                           text-gray-900 dark:text-white
                           focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCloneOpen(false)}
                                className="px-4 py-2 text-sm text-gray-500">Отмена</button>
                            <button onClick={handleClone} disabled={actionLoading || !cloneName.trim()}
                                className="px-4 py-2 text-sm rounded-lg bg-emerald-600
                               hover:bg-emerald-700 text-white disabled:opacity-50">
                                {actionLoading ? '...' : 'Создать копию'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}