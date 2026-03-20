import React, { useState, useCallback } from 'react';
import { plmApi } from '../../api/plm';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/permissions';
import { useBatchStages } from '../../hooks/useBatchStages';
import BatchCreateForm from './BatchCreateForm';

const STATUS_LABEL = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    active: 'Активна',
    archived: 'В архиве',
};

const STATUS_COLOR = {
    draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

const DECISION_ICON = { pending: '○', approved: '✓', rejected: '✗' };
const DECISION_COLOR = {
    pending: 'text-gray-400',
    approved: 'text-emerald-500',
    rejected: 'text-red-500',
};

// ── Строка изделия со стадиями ────────────────────────────────────────────

function ProductStageRow({ productId, productName, stages, onReload, canManage, selectedLitera }) {
    const [expanded, setExpanded] = useState(false);
    const [approvals, setApprovals] = useState({});  // { stageId: [...] }
    const [loading, setLoading] = useState(false);

    const visibleStages = stages.filter(s => {
        if (!selectedLitera || selectedLitera === 'none') return false; // без литеры — стадий нет
        return s.litera_code === selectedLitera.litera_code;
    });

    const loadApprovals = async (stageId) => {
        if (approvals[stageId]) return;
        const { ok, data } = await plmApi.getApprovals(stageId);
        if (ok && data.success) {
            setApprovals(prev => ({ ...prev, [stageId]: data.data }));
        }
    };

    const handleApprove = async (stageId, deptId) => {
        setLoading(true);
        await plmApi.approve(stageId, deptId);
        onReload();
        const { data } = await plmApi.getApprovals(stageId);
        if (data.success) setApprovals(prev => ({ ...prev, [stageId]: data.data }));
        setLoading(false);
    };

    const handleReject = async (stageId, deptId) => {
        const comment = window.prompt('Причина отклонения:');
        if (comment === null) return;
        setLoading(true);
        await plmApi.reject(stageId, deptId, comment);
        onReload();
        const { data } = await plmApi.getApprovals(stageId);
        if (data.success) setApprovals(prev => ({ ...prev, [stageId]: data.data }));
        setLoading(false);
    };

    return (
        <div className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
            {/* Шапка */}
            <div
                className="flex items-center justify-between px-3 py-2
                           hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                    setExpanded(v => !v);
                    if (!expanded) stages.forEach(s => loadApprovals(s.id));
                }}
            >
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                    {productName}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {visibleStages.length === 0 ? (
                        <span className="text-xs text-gray-400">
                            {selectedLitera === 'none' || !selectedLitera ? 'Без литеры' : 'Нет стадии'}
                        </span>
                    ) : (
                        visibleStages.map(s => (
                            <span key={s.id}
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                            ${STATUS_COLOR[s.status]}`}>
                                Лит.{s.litera_code}
                            </span>
                        ))
                    )}
                    <span className="text-gray-300 dark:text-gray-600 text-xs ml-1">
                        {expanded ? '▲' : '▼'}
                    </span>
                </div>
            </div>

            {/* Стадии */}
            {expanded && visibleStages.map(stage => (
                <div key={stage.id}
                    className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Лит.{stage.litera_code} — {stage.litera_name}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR[stage.status]}`}>
                            {STATUS_LABEL[stage.status]}
                        </span>
                    </div>

                    {/* Согласования */}
                    {approvals[stage.id]?.map(a => (
                        <div key={a.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className={DECISION_COLOR[a.decision]}>
                                    {DECISION_ICON[a.decision]}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                    {a.department_name}
                                </span>
                            </div>
                            {a.decision === 'pending' && canManage && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApprove(stage.id, a.department)}
                                        disabled={loading}
                                        className="text-emerald-600 hover:text-emerald-700
                                                   dark:text-emerald-400 disabled:opacity-50"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => handleReject(stage.id, a.department)}
                                        disabled={loading}
                                        className="text-red-500 hover:text-red-600 disabled:opacity-50"
                                    >
                                        ✗
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Панель batch действий ─────────────────────────────────────────────────

function BatchActionsBar({ stagesByProduct, onReload, presets, depts }) {
    const [batchPreset, setBatchPreset] = useState('');
    const [batchDept, setBatchDept] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Собираем все stage_ids по статусу
    const allStages = Object.values(stagesByProduct).flat();
    const draftIds = allStages.filter(s => s.status === 'draft').map(s => s.id);
    const pendingIds = allStages.filter(s => s.status === 'pending_approval').map(s => s.id);

    const handleSubmit = async () => {
        if (!draftIds.length) return;
        setLoading(true);
        const { ok, data } = await plmApi.batchSubmit(draftIds, batchPreset || null);
        if (ok && data.success) {
            setResult(`Отправлено: ${data.data.submitted}`);
            onReload();
        }
        setLoading(false);
        setTimeout(() => setResult(null), 3000);
    };

    const handleApprove = async () => {
        if (!pendingIds.length || !batchDept) return;
        setLoading(true);
        const { ok, data } = await plmApi.batchApprove(pendingIds, Number(batchDept));
        if (ok && data.success) {
            setResult(`Одобрено: ${data.data.approved}`);
            onReload();
        }
        setLoading(false);
        setTimeout(() => setResult(null), 3000);
    };

    if (!draftIds.length && !pendingIds.length) return null;

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-3 space-y-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Пакетные действия
            </div>

            {result && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{result}</div>
            )}

            {draftIds.length > 0 && (
                <div className="flex items-center gap-2">
                    <select value={batchPreset} onChange={e => setBatchPreset(e.target.value)}
                        className="flex-1 text-xs rounded border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                                   px-2 py-1 focus:outline-none">
                        <option value="">Пресет по умолчанию</option>
                        {presets.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button onClick={handleSubmit} disabled={loading}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white
                                   px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap">
                        На согласование ({draftIds.length})
                    </button>
                </div>
            )}

            {pendingIds.length > 0 && (
                <div className="flex items-center gap-2">
                    <select value={batchDept} onChange={e => setBatchDept(e.target.value)}
                        className="flex-1 text-xs rounded border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                                   px-2 py-1 focus:outline-none">
                        <option value="">Выберите отдел</option>
                        {depts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <button onClick={handleApprove} disabled={loading || !batchDept}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                                   px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap">
                        Одобрить ({pendingIds.length})
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Главный компонент боковой панели ──────────────────────────────────────

export default function PLMSidePanel({ productIds, products, onClose, selectedLitera }) {
    const { user } = useAuth();
    const canManage = can(user, 'plm.stage.manage');
    const { stagesByProduct, loading, reload } = useBatchStages(productIds);
    const [showCreate, setShowCreate] = useState(false);
    const [presets, setPresets] = useState([]);
    const [depts, setDepts] = useState([]);

    // Загружаем справочники для batch действий
    useState(() => {
        plmApi.getPresets().then(({ data }) => data.success && setPresets(data.data));
        fetch('/api/v1/auth/departments/?root_only=false', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }).then(r => r.json()).then(data => {
            setDepts(Array.isArray(data) ? data : (data.results || []));
        }).catch(() => { });
    }, []);

    const handleCreated = () => {
        setShowCreate(false);
        reload();
    };

    // Продукты как map для быстрого доступа к имени
    const productMap = Object.fromEntries((products || []).map(p => [p.id, p]));

    return (
        <div className="flex flex-col h-full">
            {/* Шапка панели */}
            <div className="flex items-center justify-between px-4 py-3
                            border-b border-gray-200 dark:border-gray-700 shrink-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                    PLM — Стадии ({productIds.length} изд.)
                </span>
                <button onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                               text-lg leading-none">
                    ×
                </button>
            </div>

            {/* Контент */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {loading && (
                    <div className="text-xs text-gray-400 animate-pulse text-center py-4">
                        Загрузка стадий...
                    </div>
                )}

                {/* Batch действия */}
                {!loading && !showCreate && (
                    <BatchActionsBar
                        stagesByProduct={stagesByProduct}
                        onReload={reload}
                        presets={presets}
                        depts={depts}
                    />
                )}

                {/* Форма создания группы */}
                {showCreate ? (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <BatchCreateForm
                            productIds={productIds}
                            onCreated={handleCreated}
                            onCancel={() => setShowCreate(false)}
                        />
                    </div>
                ) : (
                    canManage && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full text-xs text-blue-500 hover:text-blue-600
                                       border border-dashed border-blue-300 dark:border-blue-700
                                       rounded-lg py-2 transition-colors"
                        >
                            + Создать группу стадий
                        </button>
                    )
                )}

                {/* Список изделий со стадиями */}
                {!loading && (
                    <div className="space-y-2">
                        {productIds.map(id => (
                            <ProductStageRow
                                key={id}
                                productId={id}
                                productName={productMap[id]?.name || `Изделие #${id}`}
                                stages={stagesByProduct[id] || []}
                                onReload={reload}
                                canManage={canManage}
                                selectedLitera={selectedLitera}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}