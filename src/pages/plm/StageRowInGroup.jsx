import { useState } from 'react';
import { STAGE_STATUS_LABEL, STAGE_STATUS_COLOR, DECISION_ICON, DECISION_COLOR } from '../../components/plm/constants';

// ── Стадия внутри группы ─────────────────────────────────────────────────

export default function StageRowInGroup({
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
                                      ${STAGE_STATUS_COLOR[stage.status]}`}>
                        {STAGE_STATUS_LABEL[stage.status]}
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
