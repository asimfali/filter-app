import { useState, useEffect } from 'react';
import { getThreadsByProduct } from '../../api/issues.js';
import { ISSUE_STATUS_LABEL, ISSUE_STATUS_COLOR } from '../../utils/issueStatus.js';

// ── Замечания ─────────────────────────────────────────────────────────────

export default function ProductThreads({ externalId, onOpenThread }) {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({}); // { [thread_id]: bool }

    useEffect(() => {
        if (!externalId) return;
        getThreadsByProduct(externalId)
            .then(data => setThreads(data?.results ?? data ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [externalId]);

    if (loading || threads.length === 0) return null;

    const toggleThread = (id) =>
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Замечания
            </div>
            <div className="flex flex-col gap-2">
                {threads.map(thread => {
                    const isExpanded = expanded[thread.id];
                    const issues = thread.issues_summary ?? [];
                    return (
                        <div key={thread.id}
                            className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
                            {/* Шапка треда */}
                            <div
                                className="flex items-center justify-between px-3 py-2.5
                                           hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                                onClick={() => toggleThread(thread.id)}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium text-gray-900
                                                     dark:text-gray-100 truncate">
                                        {thread.title}
                                    </span>
                                    {thread.open_issues_count > 0 && (
                                        <span className="text-xs bg-orange-100 text-orange-600
                                                         dark:bg-orange-900/40 dark:text-orange-300
                                                         px-1.5 py-0.5 rounded-full shrink-0">
                                            {thread.open_issues_count} открытых
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${thread.is_closed
                                        ? 'bg-neutral-100 text-gray-400 dark:bg-neutral-800'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                        }`}>
                                        {thread.is_closed ? 'Закрыт' : 'Активен'}
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); onOpenThread(thread.id); }}
                                        className="text-xs text-blue-500 hover:text-blue-600
                                                   dark:hover:text-blue-400 transition-colors">
                                        Открыть →
                                    </button>
                                    <span className="text-gray-300 dark:text-gray-600 text-xs">
                                        {isExpanded ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Список замечаний */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-800
                                                divide-y divide-gray-50 dark:divide-gray-800/50">
                                    {issues.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-3 py-2">
                                            Замечаний нет
                                        </p>
                                    ) : (
                                        issues.map(issue => (
                                            <div key={issue.id}
                                                className="flex items-center justify-between
                                                            px-3 py-2 gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-mono text-gray-400
                                                                     shrink-0">
                                                        #{issue.number}
                                                    </span>
                                                    <span className="text-sm text-gray-700
                                                                     dark:text-gray-300 truncate">
                                                        {issue.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {issue.created_by_name && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                                                            {issue.created_by_name} →
                                                        </span>
                                                    )}
                                                    {issue.assigned_to_department_name && (
                                                        <span className="text-xs text-gray-400
                                                                         dark:text-gray-500 hidden sm:block">
                                                            → {issue.assigned_to_department_name}
                                                        </span>
                                                    )}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full
                                                                      font-medium ${ISSUE_STATUS_COLOR[issue.status]}`}>
                                                        {ISSUE_STATUS_LABEL[issue.status]}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
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
