import { useEffect, useRef, useState } from 'react';
import { useIssues } from '../contexts/IssuesContext.jsx';
import CreateIssueModal from '../components/issues/CreateIssueModal.jsx';
import * as issuesApi from '../api/issues.js';

const STATUS_LABEL = {
    open: 'Открыто',
    in_progress: 'В работе',
    resolved: 'Решено',
    verified: 'Подтверждено',
    rejected: 'Отклонено',
};

const STATUS_COLOR = {
    open: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ─── Сообщение ───────────────────────────────────────────────────────────────

function MessageBubble({ msg, currentUserId }) {
    const isOwn = msg.author_id === String(currentUserId);

    if (msg.is_system) {
        return (
            <div className="flex justify-center my-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100
                         dark:bg-gray-800 px-3 py-1 rounded-full">
                    {msg.text}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Аватар */}
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center
                      text-white text-xs font-medium shrink-0 mt-1">
                {msg.author_name?.[0]?.toUpperCase() ?? '?'}
            </div>

            <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isOwn && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 px-1">
                        {msg.author_name}
                    </span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
          ${isOwn
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-gray-700'
                    }`}>
                    {msg.text}
                </div>
                <span className="text-xs text-gray-300 dark:text-gray-600 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

// ─── Замечание ───────────────────────────────────────────────────────────────

function IssuePanel({ issue, messages, currentUserId, onSendMessage, onChangeStatus }) {
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages?.length]);

    const issueMessages = (messages ?? []).filter(m => m.issue_id === issue.id);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = inputRef.current?.value.trim();
            if (!text) return;
            onSendMessage(issue.id, text);
            inputRef.current.value = '';
        }
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* Шапка замечания */}
            <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
                        #{issue.number}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {issue.title}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Исполнитель */}
                    {issue.assigned_to_department_name && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            → {issue.assigned_to_department_name}
                        </span>
                    )}

                    {/* Статус */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[issue.status]}`}>
                        {STATUS_LABEL[issue.status]}
                    </span>

                    {/* Смена статуса */}
                    <StatusDropdown issue={issue} onChangeStatus={onChangeStatus} />
                </div>
            </div>

            {/* Сообщения */}
            <div className="bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-3 min-h-[120px] max-h-64 overflow-y-auto">
                {issueMessages.length === 0 ? (
                    <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-4">
                        Нет сообщений
                    </p>
                ) : (
                    issueMessages.map(msg => (
                        <MessageBubble
                            key={msg.message_id}
                            msg={msg}
                            currentUserId={currentUserId}
                        />
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* Ввод */}
            <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2
                      bg-white dark:bg-gray-900">
                <textarea
                    ref={inputRef}
                    rows={1}
                    onKeyDown={handleKeyDown}
                    placeholder="Написать сообщение… (Enter — отправить)"
                    className="w-full text-sm bg-transparent text-gray-900 dark:text-gray-100
                     placeholder-gray-300 dark:placeholder-gray-600
                     resize-none focus:outline-none"
                />
            </div>
        </div>
    );
}

// ─── Дропдаун смены статуса ──────────────────────────────────────────────────

function StatusDropdown({ issue, onChangeStatus }) {
    const TRANSITIONS = {
        open: ['in_progress'],
        in_progress: ['resolved'],
        resolved: ['verified', 'rejected'],
        rejected: ['in_progress'],
        verified: [],
    };

    const options = TRANSITIONS[issue.status] ?? [];
    if (options.length === 0) return null;

    return (
        <select
            defaultValue=""
            onChange={e => { if (e.target.value) onChangeStatus(issue.id, e.target.value); }}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5
                 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400
                 focus:outline-none cursor-pointer"
        >
            <option value="" disabled>Сменить...</option>
            {options.map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
        </select>
    );
}

// ─── Главная страница треда ───────────────────────────────────────────────────

export default function IssueThreadPage({ threadId, onBack }) {
    const {
        currentThread,
        currentThreadLoading,
        fetchThread,
        leaveThread,
        threadData,
        sendMessage,
        changeStatus,
        createIssue,
        connected,
    } = useIssues();
    const [showCreateIssue, setShowCreateIssue] = useState(false);

    // Загружаем тред и подписываемся через WS
    useEffect(() => {
        if (threadId) fetchThread(threadId);
        return () => { if (threadId) leaveThread(threadId); };
    }, [threadId]);

    const wsData = threadData[threadId] ?? { messages: [], issues: [] };
    const messages = wsData.messages;

    const restIssues = currentThread?.issues ?? [];
    const wsIssues = (wsData.issues ?? []).filter(w => w?.id);

    const issues = restIssues.map(issue => {
        const wsIssue = wsIssues.find(w => w.id === issue.id);
        return wsIssue ? { ...issue, status: wsIssue.status } : issue;
    });

    const newWsIssues = wsIssues.filter(
        w => !restIssues.some(r => r.id === w.id)
    );

    const allIssues = [...issues, ...newWsIssues];

    if (currentThreadLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
                Загрузка...
            </div>
        );
    }

    if (!currentThread) {
        return (
            <div className="flex items-center justify-center py-24 text-sm text-gray-400">
                Тред не найден
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">

            {/* Шапка */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={onBack}
                    className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                     transition-colors"
                >
                    ← Назад
                </button>

                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {currentThread.title}
                    </h1>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {currentThread.product_ids?.length ?? 0} изделий ·{' '}
                        {allIssues.length} замечаний
                    </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    {connected ? 'Live' : 'Офлайн'}
                </div>
                <button
                    onClick={() => setShowCreateIssue(true)}
                    disabled={currentThread?.is_closed}
                    className="px-3 py-1.5 text-sm rounded-lg font-medium
             bg-blue-600 hover:bg-blue-700 text-white
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors"
                >
                    + Замечание
                </button>
            </div>

            {/* Замечания */}
            {allIssues.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
                    Замечаний пока нет
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {allIssues.map(issue => (
                        <IssuePanel
                            key={issue.id}
                            issue={issue}
                            messages={messages}
                            currentUserId={currentThread.created_by}
                            onSendMessage={sendMessage}
                            onChangeStatus={changeStatus}
                        />
                    ))}
                </div>
            )}
            {showCreateIssue && (
                <CreateIssueModal
                    thread={currentThread}
                    onClose={() => setShowCreateIssue(false)}
                />
            )}
        </div>
    );
}