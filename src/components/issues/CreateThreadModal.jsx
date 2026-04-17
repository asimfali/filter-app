import { useState, useEffect } from 'react';
import { useIssues } from '../../contexts/IssuesContext.jsx';
import { tokenStorage } from '../../api/auth.js';

export default function CreateThreadModal({ productIds, graphContext, onClose, onCreated }) {
    const { createThread } = useIssues();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState('restricted');
    const [departmentId, setDepartmentId] = useState('');
    const [departments, setDepartments] = useState([]);
    const [deptsLoading, setDeptsLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = tokenStorage.getAccess();
        fetch('/api/v1/auth/departments/?root_only=false', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                const list = Array.isArray(data) ? data : (data.results ?? []);
                setDepartments(list);
            })
            .catch(() => {})
            .finally(() => setDeptsLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !departmentId) return;

        setLoading(true);
        setError(null);
        try {
            const thread = await createThread({
                title: title.trim(),
                description: description.trim(),
                product_external_ids: productIds,
                graph_context: graphContext ?? {},
                visibility,
                assigned_to_department_id: Number(departmentId),
            });
            onCreated(thread);
            onClose();
        } catch (err) {
            setError(err?.error ?? 'Ошибка при создании треда');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

                <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Создать тред
                        </h2>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {productIds.length} изделий
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

                    {/* Заголовок */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Заголовок <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Например: Замечания по серии 100"
                            autoFocus
                            className="w-full px-3 py-2 text-sm rounded-lg
                                bg-neutral-50 dark:bg-neutral-800
                                border border-gray-200 dark:border-gray-700
                                text-gray-900 dark:text-gray-100
                                placeholder-gray-300 dark:placeholder-gray-600
                                focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Описание */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Описание
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Контекст для участников..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm rounded-lg resize-none
                                bg-neutral-50 dark:bg-neutral-800
                                border border-gray-200 dark:border-gray-700
                                text-gray-900 dark:text-gray-100
                                placeholder-gray-300 dark:placeholder-gray-600
                                focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Отдел-исполнитель */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Отдел-исполнитель <span className="text-red-500">*</span>
                        </label>
                        {deptsLoading ? (
                            <div className="text-xs text-gray-400 py-2">Загрузка...</div>
                        ) : (
                            <select
                                value={departmentId}
                                onChange={e => setDepartmentId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg
                                    bg-neutral-50 dark:bg-neutral-800
                                    border border-gray-200 dark:border-gray-700
                                    text-gray-900 dark:text-gray-100
                                    focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="" disabled>Выберите подразделение</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Видимость */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Видимость
                        </label>
                        <div className="flex gap-2">
                            {[
                                { value: 'public', label: 'Публичный', desc: 'Все сотрудники' },
                                { value: 'restricted', label: 'Закрытый', desc: 'Только отдел-исполнитель' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setVisibility(opt.value)}
                                    className={`flex-1 px-3 py-2 rounded-lg text-left border transition-colors
                                        ${visibility === opt.value
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`text-sm font-medium ${visibility === opt.value
                                        ? 'text-blue-700 dark:text-blue-300'
                                        : 'text-gray-700 dark:text-gray-300'}`}>
                                        {opt.label}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm rounded-lg
                                border border-gray-200 dark:border-gray-700
                                text-gray-600 dark:text-gray-400
                                hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || !departmentId || loading}
                            className="flex-1 px-4 py-2 text-sm rounded-lg font-medium
                                bg-blue-600 hover:bg-blue-700 text-white
                                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Создание...' : 'Создать тред'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}