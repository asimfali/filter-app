import React, { useState } from 'react';
import { plmApi } from '../../api/plm';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/permissions';

const STATUS_LABEL = {
    draft:            'Черновик',
    pending_approval: 'На согласовании',
    active:           'Активна',
    archived:         'В архиве',
};

const STATUS_COLOR = {
    draft:            'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    active:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived:         'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

const DECISION_COLOR = {
    pending:  'text-gray-400',
    approved: 'text-emerald-500',
    rejected: 'text-red-500',
};

const DECISION_ICON = {
    pending:  '○',
    approved: '✓',
    rejected: '✗',
};

export default function ProductStages({ stages, productId, onStageChange }) {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState({});
    const [approvals, setApprovals] = useState({});  // { stageId: [...] }
    const [loading, setLoading] = useState({});
    const [actionError, setActionError] = useState({});

    const canApprove = can(user, 'plm.stage.manage'); // временно — нужен отдельный code

    const toggleStage = async (stageId) => {
        setExpanded(prev => ({ ...prev, [stageId]: !prev[stageId] }));

        if (!approvals[stageId]) {
            const { ok, data } = await plmApi.getApprovals(stageId);
            if (ok && data.success) {
                setApprovals(prev => ({ ...prev, [stageId]: data.data }));
            }
        }
    };

    const handleApprove = async (stageId, departmentId) => {
        setLoading(prev => ({ ...prev, [`${stageId}-${departmentId}`]: true }));
        setActionError(prev => ({ ...prev, [stageId]: null }));

        const { ok, data } = await plmApi.approve(stageId, departmentId, '');
        if (ok && data.success) {
            // Обновляем стадии
            const { data: stagesData } = await plmApi.getStages(productId);
            if (stagesData.success) onStageChange(stagesData.data);
            // Обновляем approvals
            const { data: appData } = await plmApi.getApprovals(stageId);
            if (appData.success) setApprovals(prev => ({ ...prev, [stageId]: appData.data }));
        } else {
            setActionError(prev => ({ ...prev, [stageId]: data.error }));
        }
        setLoading(prev => ({ ...prev, [`${stageId}-${departmentId}`]: false }));
    };

    const handleReject = async (stageId, departmentId) => {
        const comment = window.prompt('Причина отклонения:');
        if (comment === null) return; // отмена

        setLoading(prev => ({ ...prev, [`${stageId}-${departmentId}`]: true }));
        const { ok, data } = await plmApi.reject(stageId, departmentId, comment);
        if (ok && data.success) {
            const { data: stagesData } = await plmApi.getStages(productId);
            if (stagesData.success) onStageChange(stagesData.data);
            const { data: appData } = await plmApi.getApprovals(stageId);
            if (appData.success) setApprovals(prev => ({ ...prev, [stageId]: appData.data }));
        } else {
            setActionError(prev => ({ ...prev, [stageId]: data.error }));
        }
        setLoading(prev => ({ ...prev, [`${stageId}-${departmentId}`]: false }));
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Стадии (PLM)
            </div>

            <div className="space-y-2">
                {stages.map(stage => {
                    const isExpanded = expanded[stage.id];
                    const stageApprovals = approvals[stage.id] || [];

                    return (
                        <div key={stage.id}
                            className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">

                            {/* Шапка стадии */}
                            <div
                                className="flex items-center justify-between px-3 py-2.5
                                           hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                onClick={() => toggleStage(stage.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Лит.{stage.litera_code}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {stage.litera_name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                                      ${STATUS_COLOR[stage.status]}`}>
                                        {STATUS_LABEL[stage.status]}
                                    </span>
                                    <span className="text-gray-300 dark:text-gray-600 text-xs">
                                        {isExpanded ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Раскрытое содержимое */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3">

                                    {/* Ошибка */}
                                    {actionError[stage.id] && (
                                        <div className="text-xs text-red-500 mb-2">
                                            {actionError[stage.id]}
                                        </div>
                                    )}

                                    {/* Список согласований */}
                                    {stageApprovals.length > 0 ? (
                                        <div className="space-y-2">
                                            {stageApprovals.map(approval => (
                                                <div key={approval.id}
                                                    className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-base ${DECISION_COLOR[approval.decision]}`}>
                                                            {DECISION_ICON[approval.decision]}
                                                        </span>
                                                        <span className="text-gray-700 dark:text-gray-300">
                                                            {approval.department_name}
                                                        </span>
                                                        {approval.reviewed_by_name && (
                                                            <span className="text-xs text-gray-400">
                                                                — {approval.reviewed_by_name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Кнопки для pending */}
                                                    {approval.decision === 'pending' && canApprove && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleApprove(stage.id, approval.department)}
                                                                disabled={loading[`${stage.id}-${approval.department}`]}
                                                                className="text-xs text-emerald-600 hover:text-emerald-700
                                                                           dark:text-emerald-400 disabled:opacity-50
                                                                           transition-colors"
                                                            >
                                                                Одобрить
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(stage.id, approval.department)}
                                                                disabled={loading[`${stage.id}-${approval.department}`]}
                                                                className="text-xs text-red-500 hover:text-red-600
                                                                           disabled:opacity-50 transition-colors"
                                                            >
                                                                Отклонить
                                                            </button>
                                                        </div>
                                                    )}

                                                    {approval.comment && (
                                                        <span className="text-xs text-gray-400 italic">
                                                            {approval.comment}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400">
                                            {stage.status === 'draft'
                                                ? 'Стадия ещё не отправлена на согласование'
                                                : 'Загрузка...'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}