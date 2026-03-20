import React, { useState, useEffect } from 'react';
import { plmApi } from '../../api/plm';

export default function BatchCreateForm({ productIds, onCreated, onCancel }) {
    const [literas, setLiteras] = useState([]);
    const [visGroups, setVisGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [literaId, setLiteraId] = useState('');
    const [visibilityId, setVisibilityId] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        plmApi.getLiteras().then(({ data }) => data.success && setLiteras(data.data));
        plmApi.getVisibilityGroups().then(({ data }) => data.success && setVisGroups(data.data));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) { setError('Введите название группы'); return; }
        if (!literaId) { setError('Выберите литеру'); return; }
        setSaving(true);
        setError(null);

        const { ok, data } = await plmApi.batchCreate({
            product_ids: productIds,
            litera_id: Number(literaId),
            visibility_id: visibilityId ? Number(visibilityId) : undefined,
            group_name: groupName.trim(),
            notes,
        });

        if (ok && data.success) {
            onCreated(data.data);
        } else {
            setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        }
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Создать группу стадий ({productIds.length} изд.)
            </div>

            <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Название группы"
                className="w-full text-sm rounded border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                           px-3 py-1.5 focus:outline-none focus:border-blue-500"
            />

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Литера *</label>
                    <select value={literaId} onChange={e => setLiteraId(e.target.value)}
                        className="w-full text-sm rounded border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   px-2 py-1.5 focus:outline-none focus:border-blue-500">
                        <option value="">Выберите...</option>
                        {literas.map(l => (
                            <option key={l.id} value={l.id}>Лит.{l.code} — {l.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Видимость</label>
                    <select value={visibilityId} onChange={e => setVisibilityId(e.target.value)}
                        className="w-full text-sm rounded border border-gray-200 dark:border-gray-700
                                   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                                   px-2 py-1.5 focus:outline-none focus:border-blue-500">
                        <option value="">По умолчанию</option>
                        {visGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Примечания"
                className="w-full text-sm rounded border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                           px-3 py-1.5 focus:outline-none focus:border-blue-500"
            />

            {error && <div className="text-xs text-red-500">{error}</div>}

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
                    Отмена
                </button>
                <button type="submit" disabled={saving}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                               px-4 py-1.5 rounded disabled:opacity-50 transition-colors">
                    {saving ? 'Создание...' : 'Создать'}
                </button>
            </div>
        </form>
    );
}