import { useEffect, useRef, useState } from 'react';
import { useIssues } from '../contexts/IssuesContext.jsx';
import CreateIssueModal from '../components/issues/CreateIssueModal.jsx';
import * as issuesApi from '../api/issues.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { IconPaperclip } from '../components/common/Icons.jsx';

const STATUS_LABEL = {
    open: 'Открыто',
    in_progress: 'В работе',
    resolved: 'Решено',
    verified: 'Подтверждено ✓',
    rejected: 'Отклонено',
};

const STATUS_NEXT_LABEL = {
    open: { status: 'in_progress', label: 'Взять в работу', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    in_progress: { status: 'resolved', label: 'Отметить исправленным', color: 'bg-green-600 hover:bg-green-700 text-white' },
    resolved: null, // создатель видит две кнопки
    rejected: { status: 'in_progress', label: 'Взять в работу повторно', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    verified: null,
};

const STATUS_COLOR = {
    open: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    resolved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ─── Сообщение ───────────────────────────────────────────────────────────────


function MessageBubble({ msg, currentUserId }) {
    const isOwn = msg.author_id === String(currentUserId);

    if (msg.is_system) {
        return (
            <div className="flex justify-center my-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-neutral-100
                         dark:bg-neutral-800 px-3 py-1 rounded-full">
                    {msg.text}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Аватар */}
            <div className="w-7 h-7 rounded-full overflow-hidden bg-blue-500 flex items-center
                justify-center text-white text-xs font-medium shrink-0 mt-1">
                {msg.author_avatar_url ? (
                    <img src={msg.author_avatar_url} alt=""
                        className="w-full h-full object-cover" />
                ) : (
                    msg.author_name?.[0]?.toUpperCase() ?? '?'
                )}
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
                        : 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-gray-700'
                    }`}>
                    {msg.text}
                    {msg.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {msg.attachments.map(a => (
                                <a key={a.id ?? a.file_name} href={a.file} target="_blank" rel="noreferrer"
                                    className="block">
                                    {a.mime_type?.startsWith('image/') ? (
                                        <img src={a.file} alt={a.file_name}
                                            className="max-w-48 max-h-48 rounded-lg object-cover cursor-pointer" />
                                    ) : (
                                        <span className="text-xs underline opacity-80"><IconPaperclip className="w-4 h-4 inline mr-1" /> {a.file_name}</span>
                                    )}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
                <span className="text-xs text-gray-300 dark:text-gray-600 px-1">
                    {(() => {
                        const date = new Date(msg.created_at);
                        const today = new Date();
                        const isToday = date.toDateString() === today.toDateString();
                        const isThisYear = date.getFullYear() === today.getFullYear();

                        return isToday
                            ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                            : date.toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                ...(isThisYear ? {} : { year: 'numeric' }),
                            }) + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    })()}
                </span>
            </div>
        </div>
    );
}

// ─── Замечание ───────────────────────────────────────────────────────────────

function IssuePanel({ issue, threadId, messages, currentUserId, isThreadCreator, onSendMessage, onChangeStatus }) {
    const { loadIssueMessages, threadData } = useIssues();
    const wsData = threadData[threadId] ?? {};
    const issueMeta = wsData.issueMeta?.[String(issue.id)];
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const fileRef = useRef(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [messagesLoaded, setMessagesLoaded] = useState(false);

    const issueMessages = (messages ?? []).filter(
        m => String(m.issue_id) === String(issue.id)
    );

    const totalMessages = issueMeta?.total_messages ?? issueMessages.length;  // ← после issueMessages
    const previewMessage = issueMessages[0] ?? null;
    const hasMore = issueMessages.length > 1;

    const handleExpand = () => {
        if (!expanded && !messagesLoaded) {
            loadIssueMessages(issue.id);
            setMessagesLoaded(true);
        }
        setExpanded(e => !e);
    };

    useEffect(() => {
        if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [issueMessages.length, expanded]);

    const handleSend = async () => {
        const text = inputRef.current?.value.trim() ?? '';
        if (!text && pendingFiles.length === 0) return;

        if (pendingFiles.length > 0) {
            const { sendMessageWithFiles } = await import('../api/issues.js');
            await sendMessageWithFiles(threadId, issue.id, text, pendingFiles);
            setPendingFiles([]);
        } else {
            onSendMessage(issue.id, text);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = (e) => {
        setPendingFiles(Array.from(e.target.files));
        e.target.value = '';
    };

    const removeFile = (idx) =>
        setPendingFiles(prev => prev.filter((_, i) => i !== idx));

    const isVerified = issue.status === 'verified';

    return (
        <div className={`border rounded-xl overflow-hidden transition-colors
            ${isVerified
                ? 'border-gray-100 dark:border-gray-800 opacity-70'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
            {/* Шапка — кликабельна для разворачивания */}
            <div
                className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer
                    ${isVerified
                        ? 'bg-neutral-50/50 dark:bg-neutral-800/30'
                        : 'bg-neutral-50 dark:bg-neutral-800/60'
                    }`}
                onClick={handleExpand}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">
                        #{issue.number}
                    </span>
                    <span className={`text-sm font-medium truncate
                        ${isVerified ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                        {issue.title}
                    </span>
                    {/* От кого → кому */}
                    {issue.created_by_name && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 hidden sm:block">
                            {issue.created_by_name} → {issue.assigned_to_department?.name ?? issue.assigned_to_department_name}
                        </span>
                    )}
                    {!expanded && totalMessages > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            ({totalMessages} сообщ.)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {issue.assigned_to_department_name && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            → {issue.assigned_to_department_name}
                        </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[issue.status]}`}>
                        {STATUS_LABEL[issue.status]}
                    </span>
                    <StatusDropdown issue={issue} onChangeStatus={onChangeStatus}
                        currentUserId={currentUserId} isThreadCreator={isThreadCreator} />
                    <span className="text-gray-300 dark:text-gray-600 text-xs">
                        {expanded ? '▲' : '▼'}
                    </span>
                </div>
            </div>

            {/* Свёрнутое превью */}
            {!expanded && previewMessage && !previewMessage.is_system && (
                <div className="px-4 py-2 bg-white dark:bg-neutral-900 cursor-pointer"
                    onClick={handleExpand}>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {previewMessage.author_name}: {previewMessage.text}
                    </p>
                </div>
            )}

            {/* Развёрнутый контент */}
            {expanded && (
                <>
                    <div className="bg-white dark:bg-neutral-900 px-4 py-3 flex flex-col gap-3
                                    min-h-[80px] max-h-64 overflow-y-auto">
                        {issueMessages.length === 0 ? (
                            <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-4">
                                Нет сообщений
                            </p>
                        ) : (
                            issueMessages.map(msg => (
                                <MessageBubble key={msg.message_id} msg={msg} currentUserId={currentUserId} />
                            ))
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {pendingFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-3 pt-2 bg-white dark:bg-neutral-900">
                            {pendingFiles.map((f, idx) => (
                                <div key={idx} className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800
                                                           text-xs text-gray-700 dark:text-gray-300
                                                           px-2 py-1 rounded-lg">
                                    {f.type.startsWith('image/') ? (
                                        <img src={URL.createObjectURL(f)} alt={f.name}
                                            className="w-16 h-16 object-cover rounded" />
                                    ) : (
                                        <span><IconPaperclip className="w-4 h-4 inline mr-1" /></span>
                                    )}
                                    <span className="max-w-24 truncate">{f.name}</span>
                                    <button onClick={() => removeFile(idx)}
                                        className="text-gray-400 hover:text-red-500 ml-1">✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {issue.status !== 'verified' && (
                        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2
                                    bg-white dark:bg-neutral-900 flex items-end gap-2">
                            <input ref={fileRef} type="file" multiple accept="image/*,.pdf"
                                className="hidden" onChange={handleFileChange} />
                            <button onClick={() => fileRef.current?.click()}
                                className="text-gray-400 hover:text-blue-500 transition-colors shrink-0 pb-1">
                                <IconPaperclip className="w-4 h-4 inline mr-1" />
                            </button>
                            <textarea ref={inputRef} rows={1} onKeyDown={handleKeyDown}
                                placeholder="Написать сообщение… (Enter — отправить)"
                                className="flex-1 text-sm bg-transparent text-gray-900 dark:text-gray-100
                                             placeholder-gray-300 dark:placeholder-gray-600
                                             resize-none focus:outline-none" />
                            <button onClick={handleSend}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium shrink-0 pb-1">
                                ↑
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Дропдаун смены статуса ──────────────────────────────────────────────────

function StatusDropdown({ issue, onChangeStatus, currentUserId, isThreadCreator }) {
    if (issue.status === 'verified') return null;
    if (issue.status === 'resolved') {
        // Подтвердить может создатель замечания или создатель треда
        const canVerify = isThreadCreator || String(issue.created_by) === String(currentUserId);
        if (!canVerify) return null;
        return (
            <div className="flex gap-2">
                <button onClick={() => onChangeStatus(issue.id, 'verified')}
                    className="text-xs px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                    Подтвердить ✓
                </button>
                <button onClick={() => onChangeStatus(issue.id, 'rejected')}
                    className="text-xs px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors">
                    Отклонить
                </button>
            </div>
        );
    }
    const next = STATUS_NEXT_LABEL[issue.status];
    if (!next || isThreadCreator) return null;
    return (
        <button onClick={() => onChangeStatus(issue.id, next.status)}
            className={`text-xs px-3 py-1 rounded-lg transition-colors ${next.color}`}>
            {next.label}
        </button>
    );
}

// ─── Главная страница треда ───────────────────────────────────────────────────

export default function IssueThreadPage({ threadId, onBack }) {
    const { user } = useAuth();
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
        const wsIssue = wsIssues.find(w => String(w.id) === String(issue.id));
        return wsIssue ? { ...issue, status: wsIssue.status } : issue;
    });

    const newWsIssues = wsIssues.filter(
        w => w?.id && !restIssues.some(r => String(r.id) === String(w.id))
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
        <div className="max-w-5xl mx-auto">

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
                    {currentThread.product_external_ids?.length ?? 0} изделий ·{' '}
                        {allIssues.length} замечаний ·{' '}
                        <span className="text-gray-500 dark:text-gray-400">
                            {currentThread.assigned_to_department?.name ?? '—'}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
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
                {String(currentThread.created_by) === String(user.id) && (
                    <button
                        onClick={async () => {
                            await issuesApi.closeThread(currentThread.id);
                            onBack();
                        }}
                        disabled={currentThread?.is_closed}
                        className="px-3 py-1.5 text-sm rounded-lg font-medium
               border border-gray-300 dark:border-gray-600
               text-gray-600 dark:text-gray-400
               hover:border-red-400 hover:text-red-500
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors"
                    >
                        Закрыть тред
                    </button>
                )}
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
                            threadId={threadId}
                            messages={messages}
                            currentUserId={user.id}
                            isThreadCreator={String(currentThread.created_by) === String(user.id)}
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