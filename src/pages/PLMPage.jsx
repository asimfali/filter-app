import React, { useState, useEffect, useCallback } from 'react';
import { plmApi } from '../api/plm';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../utils/permissions';
import { tokenStorage } from '../api/auth';
import BatchCreateForm from '../components/plm/BatchCreateForm';

const API_BASE = '/api/v1/catalog';

const STATUS_LABEL = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    active: 'Активна',
    archived: 'В архиве',
};

const STATUS_COLOR = {
    draft: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived: 'bg-neutral-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500',
};

const DECISION_ICON = { pending: '○', approved: '✓', rejected: '✗' };
const DECISION_COLOR = { pending: 'text-gray-400', approved: 'text-emerald-500', rejected: 'text-red-500' };

// ── Общие утилиты ─────────────────────────────────────────────────────────

function useRefData() {
    const [literas, setLiteras] = useState([]);
    const [visGroups, setVisGroups] = useState([]);
    const [presets, setPresets] = useState([]);
    const [depts, setDepts] = useState([]);

    useEffect(() => {
        plmApi.getLiteras().then(({ data }) => data.success && setLiteras(data.data));
        plmApi.getVisibilityGroups().then(({ data }) => data.success && setVisGroups(data.data));
        plmApi.getPresets().then(({ data }) => data.success && setPresets(data.data));
        // Подразделения для batch approve
        fetch('/api/v1/auth/departments/?root_only=false', {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        }).then(r => r.json()).then(data => {
            const list = Array.isArray(data) ? data : (data.results || []);
            setDepts(list);
        }).catch(() => { });
    }, []);

    return { literas, visGroups, presets, depts };
}

// ── Вкладка: Группы ───────────────────────────────────────────────────────

function GroupsTab({ onOpenProduct, refData }) {
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

    const canManage = can(user, 'plm.stage.manage');

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
        const ids = getSelectedIds(groupId);
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
        const ids = getSelectedIds(groupId);
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

    const handleDeleteGroup = async (groupId, groupName) => {
        if (!window.confirm(`Удалить группу «${groupName}»? Стадии останутся.`)) return;
        setActionLoading(true);
        const { ok, data } = await plmApi.deleteGroup(groupId);
        if (ok && data.success) {
            setGroups(prev => prev.filter(g => g.id !== groupId));
        } else {
            setActionError(prev => ({ ...prev, [groupId]: data.error || 'Ошибка удаления' }));
        }
        setActionLoading(false);
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

    const handleDeleteStage = async (groupId, stageId, stageName) => {
        if (!window.confirm(`Удалить стадию «${stageName}»? Действие необратимо.`)) return;
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
                                ${STATUS_COLOR[status]}`}>
                                            {STATUS_LABEL[status]}: {count}
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

// ── Стадия внутри группы ─────────────────────────────────────────────────

function StageRowInGroup({
    stage, selected, onToggleSelect,
    approvals, onLoadApprovals,
    onApprove, onReject, onOpenProduct,
    canManage, loading, onDelete,
}) {
    const [expanded, setExpanded] = useState(false);

    const handleExpand = () => {
        if (!expanded && !approvals) onLoadApprovals();
        setExpanded(v => !v);
    };

    return (
        <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Чекбокс выбора */}
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                {/* Название изделия */}
                <div
                    className="flex-1 flex items-center gap-2 cursor-pointer"
                    onClick={handleExpand}
                >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {stage.product_name || `Стадия #${stage.id}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                      ${STATUS_COLOR[stage.status]}`}>
                        {STATUS_LABEL[stage.status]}
                    </span>
                </div>

                {/* Кнопки */}
                <button
                    onClick={e => { e.stopPropagation(); onOpenProduct?.(stage.product_id); }}
                    className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                >
                    →
                </button>
                {canManage && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        disabled={loading}
                        title="Удалить стадию"
                        className="text-xs text-red-400 hover:text-red-600
                   dark:text-red-500 dark:hover:text-red-400
                   disabled:opacity-50 transition-colors"
                    >
                        ✕
                    </button>
                )}
                <span
                    className="text-gray-300 dark:text-gray-600 text-xs cursor-pointer"
                    onClick={handleExpand}
                >
                    {expanded ? '▲' : '▼'}
                </span>
            </div>

            {/* Согласования */}
            {expanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-2">
                    {!approvals && (
                        <div className="text-xs text-gray-400 animate-pulse">Загрузка...</div>
                    )}
                    {approvals?.map(a => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className={`text-base ${DECISION_COLOR[a.decision]}`}>
                                    {DECISION_ICON[a.decision]}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">
                                    {a.department_name}
                                </span>
                                {a.reviewed_by_name && (
                                    <span className="text-xs text-gray-400">— {a.reviewed_by_name}</span>
                                )}
                                {a.comment && (
                                    <span className="text-xs text-gray-400 italic">«{a.comment}»</span>
                                )}
                            </div>
                            {a.decision === 'pending' && canManage && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onApprove(a.department)}
                                        disabled={loading}
                                        className="text-xs text-emerald-600 hover:text-emerald-700
                                                   dark:text-emerald-400 disabled:opacity-50"
                                    >
                                        Одобрить
                                    </button>
                                    <button
                                        onClick={() => onReject(a.department)}
                                        disabled={loading}
                                        className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                                    >
                                        Отклонить
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {approvals?.length === 0 && (
                        <div className="text-xs text-gray-400">
                            {stage.status === 'draft' ? 'Не отправлена на согласование' : 'Согласований нет'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Вкладка: Изделия (поиск + индивидуальные стадии) ─────────────────────

function ProductsTab({ onOpenProduct, refData }) {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [searched, setSearched] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [showBatchCreate, setShowBatchCreate] = useState(false);

    const canCreate = can(user, 'plm.stage.manage');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (query.length < 2) return;
        setLoading(true);
        setSelectedProducts(new Set());

        const res = await fetch(
            `${API_BASE}/products/search/?q=${encodeURIComponent(query)}&limit=50`,
            { headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` } }
        );
        const data = await res.json();
        if (data.success) setProducts(data.data);
        setLoading(false);
        setSearched(true);
    };

    const toggleProduct = (id) => {
        setSelectedProducts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedProducts(new Set(products.map(p => p.id)));
    const deselectAll = () => setSelectedProducts(new Set());

    return (
        <div className="space-y-4">
            {/* Поиск */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Найти изделие (мин. 2 символа)..."
                    className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                               bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                               px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <button type="submit" disabled={loading || query.length < 2}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                               px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                    {loading ? '...' : 'Найти'}
                </button>
            </form>

            {/* Toolbar выбранных */}
            {products.length > 0 && canCreate && (
                <div className="flex items-center gap-3 bg-white dark:bg-neutral-900
                                rounded-lg shadow px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Выбрано: {selectedProducts.size} из {products.length}</span>
                        <button onClick={selectAll}
                            className="text-blue-500 hover:text-blue-600">Все</button>
                        <button onClick={deselectAll}
                            className="text-gray-400 hover:text-gray-600">Снять</button>
                    </div>
                    {selectedProducts.size > 0 && (
                        <button
                            onClick={() => setShowBatchCreate(true)}
                            className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white
                                       px-3 py-1.5 rounded transition-colors"
                        >
                            Создать группу стадий ({selectedProducts.size})
                        </button>
                    )}
                </div>
            )}

            {/* Форма batch создания */}
            {showBatchCreate && (
                <BatchCreateForm
                    productIds={Array.from(selectedProducts)}
                    refData={refData}
                    onCreated={() => {
                        setShowBatchCreate(false);
                        setSelectedProducts(new Set());
                    }}
                    onCancel={() => setShowBatchCreate(false)}
                />
            )}

            {/* Список изделий */}
            {searched && products.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-8">Ничего не найдено</div>
            )}

            <div className="space-y-2">
                {products.map(product => (
                    <div key={product.id}
                        className="bg-white dark:bg-neutral-900 rounded-lg shadow
                                   flex items-center gap-3 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {product.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{product.product_type}</div>
                        </div>
                        <button
                            onClick={() => onOpenProduct(product.id)}
                            className="text-xs text-blue-500 hover:text-blue-600 shrink-0"
                        >
                            Открыть →
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Главная страница PLM ──────────────────────────────────────────────────

export default function PLMPage({ onOpenProduct }) {
    const [tab, setTab] = useState('groups');
    const refData = useRefData();

    const tabs = [
        { id: 'groups', label: 'Группы' },
        { id: 'products', label: 'Изделия' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* Заголовок */}
            <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    PLM — Жизненный цикл изделия
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Управление стадиями и согласованием
                </p>
            </div>

            {/* Вкладки */}
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-1.5 rounded text-sm transition-colors
                            ${tab === t.id
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Контент вкладок */}
            {tab === 'groups' && (
                <GroupsTab onOpenProduct={onOpenProduct} refData={refData} />
            )}
            {tab === 'products' && (
                <ProductsTab onOpenProduct={onOpenProduct} refData={refData} />
            )}
        </div>
    );
}