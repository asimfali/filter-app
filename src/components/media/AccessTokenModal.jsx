import React, { useState, useEffect } from 'react';
import { mediaApi } from '../../api/media';
import { apiFetch } from '../../api/auth';

export default function AccessTokenModal({ product, docType, onClose }) {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Форма создания токена
    const [form, setForm] = useState({
        access_type: 'read',
        expires_hours: 2,
        granted_to_user_id: '',
        granted_to_department_id: '',
        comment: '',
    });

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        loadTokens();
        // Загружаем список пользователей и отделов
        apiFetch('/api/v1/auth/users-list/').then(r => r.json()).then(d => {
            setUsers(d.results || d || []);
        });
        apiFetch('/api/v1/auth/departments/?root_only=false').then(r => r.json()).then(d => {
            setDepartments(Array.isArray(d) ? d : (d.results || []));
        });
    }, []);

    const loadTokens = async () => {
        setLoading(true);
        const { ok, data } = await mediaApi.getAccessTokens(product.id, docType.id);
        if (ok) setTokens(data.tokens || []);
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.granted_to_user_id && !form.granted_to_department_id) {
            alert('Укажите получателя — пользователя или подразделение');
            return;
        }

        setCreating(true);
        const expiresAt = new Date(Date.now() + form.expires_hours * 3600 * 1000).toISOString();

        const { ok, data } = await mediaApi.createAccessToken({
            product_id: product.id,
            doc_type_id: docType.id,
            access_type: form.access_type,
            expires_at: expiresAt,
            granted_to_user_id: form.granted_to_user_id || null,
            granted_to_department_id: form.granted_to_department_id || null,
            comment: form.comment,
        });

        if (ok && data.success) {
            setTokens(prev => [...prev, data.token]);
            setShowForm(false);
            setForm({ access_type: 'read', expires_hours: 2, granted_to_user_id: '', granted_to_department_id: '', comment: '' });
        }
        setCreating(false);
    };

    const handleRevoke = async (tokenId) => {
        const { ok } = await mediaApi.revokeAccessToken(tokenId);
        if (ok) setTokens(prev => prev.filter(t => t.id !== tokenId));
    };

    const sel = "w-full border border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-neutral-900 rounded-xl shadow-xl border border-gray-700
                            w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">

                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                                border-b border-gray-700 shrink-0">
                    <div>
                        <div className="text-sm font-semibold text-white">
                            Доступ к документам
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {product.name} · {docType.name}
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                {/* Контент */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                    {/* Активные токены */}
                    {loading ? (
                        <div className="text-xs text-gray-400 text-center py-4">Загрузка...</div>
                    ) : tokens.length === 0 ? (
                        <div className="text-xs text-gray-500 text-center py-4">
                            Активных токенов нет
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tokens.map(token => (
                                <div key={token.id}
                                    className="flex items-center justify-between px-3 py-2
                                               rounded-lg bg-neutral-800 border border-gray-700">
                                    <div className="min-w-0">
                                        <div className="text-xs text-white">
                                            {token.granted_to_user || token.granted_to_department}
                                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px]
                                                ${token.access_type === 'write'
                                                    ? 'bg-amber-900/50 text-amber-300'
                                                    : 'bg-blue-900/50 text-blue-300'
                                                }`}>
                                                {token.access_type === 'write' ? 'запись' : 'чтение'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                            До: {new Date(token.expires_at).toLocaleString('ru')}
                                            {token.comment && ` · ${token.comment}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRevoke(token.id)}
                                        className="text-xs text-gray-500 hover:text-red-400
                                                   transition-colors ml-3 shrink-0">
                                        Отозвать
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Форма создания */}
                    {showForm ? (
                        <form onSubmit={handleCreate} className="space-y-3
                                border-t border-gray-700 pt-4">
                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                Новый токен
                            </div>

                            {/* Тип доступа */}
                            <div className="flex gap-2">
                                {['read', 'write'].map(type => (
                                    <button key={type} type="button"
                                        onClick={() => setForm(f => ({ ...f, access_type: type }))}
                                        className={`flex-1 py-1.5 rounded text-xs font-medium
                                            transition-colors
                                            ${form.access_type === type
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-800 text-gray-400 hover:text-white border border-gray-700'
                                            }`}>
                                        {type === 'read' ? '👁 Чтение' : '✎ Запись'}
                                    </button>
                                ))}
                            </div>

                            {/* Срок */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Срок действия
                                </label>
                                <select value={form.expires_hours}
                                    onChange={e => setForm(f => ({ ...f, expires_hours: +e.target.value }))}
                                    className={sel}>
                                    <option value={1}>1 час</option>
                                    <option value={2}>2 часа</option>
                                    <option value={4}>4 часа</option>
                                    <option value={8}>8 часов</option>
                                    <option value={24}>1 день</option>
                                    <option value={72}>3 дня</option>
                                    <option value={168}>1 неделя</option>
                                </select>
                            </div>

                            {/* Получатель — пользователь */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Пользователь (или подразделение ниже)
                                </label>
                                <select value={form.granted_to_user_id}
                                    onChange={e => setForm(f => ({
                                        ...f,
                                        granted_to_user_id: e.target.value,
                                        granted_to_department_id: '',
                                    }))}
                                    className={sel}>
                                    <option value="">— не выбран —</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name || u.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Получатель — подразделение */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Подразделение
                                </label>
                                <select value={form.granted_to_department_id}
                                    onChange={e => setForm(f => ({
                                        ...f,
                                        granted_to_department_id: e.target.value,
                                        granted_to_user_id: '',
                                    }))}
                                    className={sel}>
                                    <option value="">— не выбрано —</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Комментарий */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                    Комментарий
                                </label>
                                <input
                                    type="text"
                                    value={form.comment}
                                    onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                                    placeholder="Цель выдачи доступа..."
                                    className={sel}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button type="submit" disabled={creating}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700
                                               disabled:opacity-50 text-white text-sm
                                               py-2 rounded-lg transition-colors">
                                    {creating ? 'Создание...' : 'Выдать доступ'}
                                </button>
                                <button type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 text-sm text-gray-400
                                               hover:text-white border border-gray-700
                                               rounded-lg transition-colors">
                                    Отмена
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full py-2 text-sm text-blue-400 hover:text-blue-300
                                       border border-blue-800 hover:border-blue-600
                                       rounded-lg transition-colors">
                            + Выдать доступ
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}