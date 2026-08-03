import { useState } from 'react';
import { apiFetch } from '../../api/auth';
import Modal from '../../components/common/Modal';
import { API } from '../../hooks/useStaff';

export default function StaffRequestsPanel({ requests, loading, onReload }) {
    const [processing, setProcessing] = useState(null); // id заявки в процессе
    const [rejectModal, setRejectModal] = useState(null); // { id, userName }
    const [comment, setComment] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');

    const handleApprove = async (id) => {
        setProcessing(id);
        try {
            await apiFetch(`${API}/staff-requests/${id}/approve/`, { method: 'POST' });
            onReload(statusFilter);
        } catch {
            // ошибка — можно добавить toast
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        setProcessing(rejectModal.id);
        try {
            await apiFetch(`${API}/staff-requests/${rejectModal.id}/reject/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            setRejectModal(null);
            setComment('');
            onReload(statusFilter);
        } catch {
            // ошибка
        } finally {
            setProcessing(null);
        }
    };

    const STATUS_LABEL = {
        pending: 'Ожидают',
        approved: 'Одобренные',
        rejected: 'Отклонённые',
    };

    const STATUS_BADGE = {
        pending: 'bg-amber-50 text-amber-700',
        approved: 'bg-green-50 text-green-700',
        rejected: 'bg-red-50 text-red-700',
    };

    return (
        <div className="space-y-3">
            {/* Фильтр по статусу */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3 flex gap-1">
                {Object.entries(STATUS_LABEL).map(([s, label]) => (
                    <button key={s} onClick={() => { setStatusFilter(s); onReload(s); }}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${statusFilter === s
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}>
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    Загрузка...
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    {statusFilter === 'pending' ? 'Нет новых заявок' : 'Нет заявок'}
                </div>
            ) : (
                <div className="space-y-2">
                    {requests.map(r => (
                        <div key={r.id}
                            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700
                                       rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Аватар */}
                                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                                                text-blue-700 font-semibold text-sm shrink-0">
                                    {(r.user_name?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {r.user_name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {r.user_email}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {r.dept_name} → {r.role_name}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {new Date(r.created_at).toLocaleDateString('ru-RU')}
                                </span>

                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>
                                    {STATUS_LABEL[r.status]}
                                </span>

                                {r.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleApprove(r.id)}
                                            disabled={processing === r.id}
                                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50
                                                       text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                                            {processing === r.id ? '...' : 'Принять'}
                                        </button>
                                        <button
                                            onClick={() => { setRejectModal({ id: r.id, userName: r.user_name }); setComment(''); }}
                                            disabled={processing === r.id}
                                            className="border border-red-300 text-red-600 hover:bg-red-50
                                                       text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                            Отклонить
                                        </button>
                                    </>
                                )}

                                {r.status === 'rejected' && r.comment && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic max-w-32 truncate"
                                        title={r.comment}>
                                        {r.comment}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Модалка отклонения */}
            {rejectModal && (
                <Modal title={`Отклонить заявку — ${rejectModal.userName}`}
                    onClose={() => setRejectModal(null)}>
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Укажите причину отклонения (необязательно):
                        </p>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={3}
                            placeholder="Причина..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                                       text-sm focus:outline-none focus:ring-2 focus:ring-red-400
                                       dark:bg-neutral-800 dark:text-white resize-none"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setRejectModal(null)}
                                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                                           text-sm py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                Отмена
                            </button>
                            <button onClick={handleReject} disabled={processing === rejectModal.id}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50
                                           text-white text-sm py-2 rounded-lg transition-colors">
                                {processing === rejectModal.id ? '...' : 'Отклонить'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
