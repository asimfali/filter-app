import { useState, useEffect, useCallback } from 'react';
import { plmApi } from '../../api/plm';
import { useAuth } from '../../contexts/AuthContext';
import { can, PERM } from '../../utils/permissions';
import { useModals } from '../../hooks/useModals';
import { STAGE_STATUS_LABEL, STAGE_STATUS_COLOR } from '../../components/plm/constants';
import StageRowInGroup from './StageRowInGroup';

// ── Вкладка: Группы ───────────────────────────────────────────────────────

export default function GroupsTab({ onOpenProduct, refData }) {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [groupStages, setGroupStages] = useState({}); // { groupId: stages[] }
    const [approvals, setApprovals] = useState({});     // { stageId: [...] }
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState({});
    const [selectedStages, setSelectedStages] = useState({}); // { groupId: Set<stageId> }
    const [batchPreset, setBatchPreset] = useState('');
    const [batchDept, setBatchDept] = useState('');
    const { showConfirm, modals } = useModals();

    const canManage = can(user, PERM.PLM_STAGE_MANAGE);

    const loadGroups = useCallback(async () => {
        setLoading(true);
        const { ok, data } = await plmApi.getGroups();
        if (ok && data.success) setGroups(data.data);
        setLoading(false);
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const toggleGroup = async (groupId) => {
        setExpanded(prev => ({ ...prev, [groupId]: !prev[groupId] }));
        if (!groupStages[groupId]) {
            const { ok, data } = await plmApi.getGroup(groupId);
            if (ok && data.success) {
                setGroupStages(prev => ({ ...prev, [groupId]: data.data.stages }));
                // Инициализируем выбор всех стадий группы
                setSelectedStages(prev => ({
                    ...prev,
                    [groupId]: new Set(data.data.stages.map(s => s.id)),
                }));
            }
        }
    };

    const loadApprovals = async (stageId) => {
        if (approvals[stageId]) return;
        const { ok, data } = await plmApi.getApprovals(stageId);
        if (ok && data.success) {
            setApprovals(prev => ({ ...prev, [stageId]: data.data }));
        }
    };

    const toggleStageSelect = (groupId, stageId) => {
        setSelectedStages(prev => {
            const set = new Set(prev[groupId] || []);
            if (set.has(stageId)) set.delete(stageId);
            else set.add(stageId);
            return { ...prev, [groupId]: set };
        });
    };

    const selectAll = (groupId) => {
        const stages = groupStages[groupId] || [];
        setSelectedStages(prev => ({
            ...prev,
            [groupId]: new Set(stages.map(s => s.id)),
        }));
    };

    const deselectAll = (groupId) => {
        setSelectedStages(prev => ({ ...prev, [groupId]: new Set() }));
    };

    const getSelectedIds = (groupId) => {
        return Array.from(selectedStages[groupId] || []);
    };

    const handleBatchSubmit = async (groupId) => {
        // Кнопка показывает счётчик только по draft-стадиям — отправлять нужно тоже только их,
        // а не всё выделение (пользователь может держать отмеченными и pending/active стадии).
        const stages = groupStages[groupId] || [];
        const draftIds = stages.filter(s => s.status === 'draft').map(s => s.id);
        const ids = getSelectedIds(groupId).filter(id => draftIds.includes(id));
        if (!ids.length) return;
        setActionLoading(true);
        setActionError(prev => ({ ...prev, [groupId]: null }));

        const { ok, data } = await plmApi.batchSubmit(ids, batchPreset || null);
        if (ok && data.success) {
            await refreshGroup(groupId);
        } else {
            setActionError(prev => ({ ...prev, [groupId]: data.error }));
        }
        setActionLoading(false);
    };

    const handleBatchApprove = async (groupId) => {
        // Аналогично handleBatchSubmit — счётчик на кнопке считает только pending_approval,
        // отправлять нужно тоже только их.
        const stages = groupStages[groupId] || [];
        const pendingIds = stages.filter(s => s.status === 'pending_approval').map(s => s.id);
        const ids = getSelectedIds(groupId).filter(id => pendingIds.includes(id));
        if (!ids.length || !batchDept) return;
        setActionLoading(true);

        const { ok, data } = await plmApi.batchApprove(ids, Number(batchDept));
        if (ok && data.success) {
            await refreshGroup(groupId);
            // Сбрасываем кэш согласований
            const stageIds = groupStages[groupId]?.map(s => s.id) || [];
            setApprovals(prev => {
                const next = { ...prev };
                stageIds.forEach(id => delete next[id]);
                return next;
            });
        } else {
            setActionError(prev => ({ ...prev, [groupId]: data.error }));
        }
        setActionLoading(false);
    };

    const handleSingleApprove = async (groupId, stageId, deptId) => {
        setActionLoading(true);
        const { ok, data } = await plmApi.approve(stageId, deptId);
        if (ok && data.success) {
            await refreshGroup(groupId);
            const { data: appData } = await plmApi.getApprovals(stageId);
            if (appData.success) setApprovals(prev => ({ ...prev, [stageId]: appData.data }));
        }
        setActionLoading(false);
    };

    const handleSingleReject = async (groupId, stageId, deptId) => {
        const comment = window.prompt('Причина отклонения:');
        if (comment === null) return;
        setActionLoading(true);
        const { ok, data } = await plmApi.reject(stageId, deptId, comment);
        if (ok && data.success) {
            await refreshGroup(groupId);
            const { data: appData } = await plmApi.getApprovals(stageId);
            if (appData.success) setApprovals(prev => ({ ...prev, [stageId]: appData.data }));
        }
        setActionLoading(false);
    };

    const handleDeleteGroup = (groupId, groupName) => {
        showConfirm(`Удалить группу «${groupName}»? Стадии останутся.`, async () => {
            setActionLoading(true);
            const { ok, data } = await plmApi.deleteGroup(groupId);
            if (ok && data.success) {
                setGroups(prev => prev.filter(g => g.id !== groupId));
            } else {
                setActionError(prev => ({ ...prev, [groupId]: data.error || 'Ошибка удаления' }));
            }
            setActionLoading(false);
        });
    };

    const handleRemoveFromGroup = async (groupId, stageIds) => {
        if (!stageIds.length) return;
        setActionLoading(true);
        const { ok, data } = await plmApi.removeStagesFromGroup(groupId, stageIds);
        if (ok && data.success) {
            await refreshGroup(groupId);
            // Убираем из выбора
            setSelectedStages(prev => {
                const next = new Set(prev[groupId] || []);
                stageIds.forEach(id => next.delete(id));
                return { ...prev, [groupId]: next };
            });
        } else {
            setActionError(prev => ({ ...prev, [groupId]: data.error || 'Ошибка' }));
        }
        setActionLoading(false);
    };

    const handleDeleteStage = (groupId, stageId, stageName) => {
        showConfirm(`Удалить стадию «${stageName}»? Действие необратимо.`, async () => {
            setActionLoading(true);
            const { ok, data } = await plmApi.deleteStage(stageId);
            if (ok && data.success) {
                await refreshGroup(groupId);
                setSelectedStages(prev => {
                    const next = new Set(prev[groupId] || []);
                    next.delete(stageId);
                    return { ...prev, [groupId]: next };
                });
            } else {
                setActionError(prev => ({ ...prev, [groupId]: data.error || 'Ошибка удаления' }));
            }
            setActionLoading(false);
        });
    };

    const refreshGroup = async (groupId) => {
        const { ok, data } = await plmApi.getGroup(groupId);
        if (ok && data.success) {
            setGroupStages(prev => ({ ...prev, [groupId]: data.data.stages }));
            // Обновляем summary в списке групп
            setGroups(prev => prev.map(g =>
                g.id === groupId
                    ? { ...g, status_summary: data.data.status_summary, stages_count: data.data.stages.length }
                    : g
            ));
        }
    };

    if (loading) return (
        <div className="text-sm text-gray-400 text-center py-12">Загрузка...</div>
    );

    if (groups.length === 0) return (
        <div className="text-sm text-gray-400 text-center py-12">
            Групп нет — создайте через вкладку «Изделия»
        </div>
    );

    return (
        <div className="space-y-3">
            {modals}
            {groups.map(group => {
                const isExpanded = expanded[group.id];
                const stages = groupStages[group.id] || [];
                const selected = selectedStages[group.id] || new Set();
                const draftIds = stages.filter(s => s.status === 'draft').map(s => s.id);
                const pendingIds = stages.filter(s => s.status === 'pending_approval').map(s => s.id);

                return (
                    <div key={group.id}
                        className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
                        {/* Шапка группы */}
                        <div
                            className="flex items-center justify-between px-5 py-3.5
               cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            onClick={() => toggleGroup(group.id)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {group.name}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {group.stages_count} изд.
                                </span>
                                <div className="flex gap-1">
                                    {Object.entries(group.status_summary || {}).map(([status, count]) => (
                                        <span key={status}
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${STAGE_STATUS_COLOR[status]}`}>
                                            {STAGE_STATUS_LABEL[status]}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">
                                    {group.created_by_name}
                                </span>
                                {canManage && (
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id, group.name); }}
                                        disabled={actionLoading}
                                        title="Удалить группу"
                                        className="text-xs text-red-400 hover:text-red-600
                           dark:text-red-500 dark:hover:text-red-400
                           disabled:opacity-50 transition-colors px-1"
                                    >
                                        ✕
                                    </button>
                                )}
                                <span className="text-gray-300 dark:text-gray-600 text-xs">
                                    {isExpanded ? '▲' : '▼'}
                                </span>
                            </div>
                        </div>

                        {/* Содержимое группы */}
                        {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-4">
                                {actionError[group.id] && (
                                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
                                        {actionError[group.id]}
                                    </div>
                                )}

                                {/* Панель batch-действий */}
                                {canManage && (draftIds.length > 0 || pendingIds.length > 0) && (
                                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg px-4 py-3 space-y-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>Выбрано: {selected.size} из {stages.length}</span>
                                            <button onClick={() => selectAll(group.id)}
                                                className="text-blue-500 hover:text-blue-600">
                                                Все
                                            </button>
                                            <button onClick={() => deselectAll(group.id)}
                                                className="text-gray-400 hover:text-gray-600">
                                                Снять
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {/* Batch Submit */}
                                            {draftIds.some(id => selected.has(id)) && (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={batchPreset}
                                                        onChange={e => setBatchPreset(e.target.value)}
                                                        className="text-xs rounded border border-gray-200
                                                                   dark:border-gray-700 bg-white dark:bg-neutral-900
                                                                   text-gray-700 dark:text-gray-300
                                                                   px-2 py-1 focus:outline-none"
                                                    >
                                                        <option value="">Пресет по умолчанию</option>
                                                        {refData.presets.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleBatchSubmit(group.id)}
                                                        disabled={actionLoading}
                                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white
                                                                   px-3 py-1.5 rounded disabled:opacity-50"
                                                    >
                                                        На согласование ({
                                                            draftIds.filter(id => selected.has(id)).length
                                                        })
                                                    </button>
                                                </div>
                                            )}

                                            {/* Batch Approve */}
                                            {pendingIds.some(id => selected.has(id)) && (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={batchDept}
                                                        onChange={e => setBatchDept(e.target.value)}
                                                        className="text-xs rounded border border-gray-200
                                                                   dark:border-gray-700 bg-white dark:bg-neutral-900
                                                                   text-gray-700 dark:text-gray-300
                                                                   px-2 py-1 focus:outline-none"
                                                    >
                                                        <option value="">Выберите отдел</option>
                                                        {refData.depts.map(d => (
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleBatchApprove(group.id)}
                                                        disabled={actionLoading || !batchDept}
                                                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                                                                   px-3 py-1.5 rounded disabled:opacity-50"
                                                    >
                                                        Одобрить ({
                                                            pendingIds.filter(id => selected.has(id)).length
                                                        })
                                                    </button>
                                                </div>
                                            )}
                                            {selected.size > 0 && canManage && (
                                                <button
                                                    onClick={() => handleRemoveFromGroup(group.id, Array.from(selected))}
                                                    disabled={actionLoading}
                                                    className="text-xs text-red-500 hover:text-red-600
                   border border-red-200 dark:border-red-800
                   px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                                                >
                                                    Исключить из группы ({selected.size})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Список стадий группы */}
                                <div className="space-y-2">
                                    {stages.map(stage => (
                                        <StageRowInGroup
                                            key={stage.id}
                                            stage={stage}
                                            selected={selected.has(stage.id)}
                                            onToggleSelect={() => toggleStageSelect(group.id, stage.id)}
                                            approvals={approvals[stage.id]}
                                            onLoadApprovals={() => loadApprovals(stage.id)}
                                            onApprove={(deptId) => handleSingleApprove(group.id, stage.id, deptId)}
                                            onReject={(deptId) => handleSingleReject(group.id, stage.id, deptId)}
                                            onOpenProduct={onOpenProduct}
                                            canManage={canManage}
                                            loading={actionLoading}
                                            onDelete={() => handleDeleteStage(group.id, stage.id, stage.product_name)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
