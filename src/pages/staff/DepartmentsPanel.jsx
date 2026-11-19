import { useState } from 'react';
import { apiFetch, authApi } from '../../api/auth';
import Modal from '../../components/common/Modal';
import { useModals } from '../../hooks/useModals';
import { parseError } from '../../utils';
import { inputCls } from '../../utils/styles';
import { API, useRoles, useUsers } from '../../hooks/useStaff';
import DepartmentTree from './DepartmentTree';
import DeptPermissionsTab from './DeptPermissionsTab';
import SpecPermissionsTab from './SpecPermissionsTab';

// ── Панель подразделений (новая версия с иерархией) ───────────────────────

// Дефолты публикации повторяют модель Department: наружу по умолчанию уходят
// городской телефон и email, внутренний номер и руководитель — закрыты.
const EMPTY_FORM = {
    name: '', code: '', description: '', parent: null,
    phone_internal: '', phone_external: '', email: '', head_id: null,
    is_published: false,
    publish_phone_external: true,
    publish_phone_internal: false,
    publish_email: true,
    publish_head: false,
};

// Сколько подразделений реально уйдёт на сайт: is_active дерево уже фильтрует.
function countPublished(departments) {
    return departments.reduce(
        (sum, d) => sum + (d.is_published ? 1 : 0) + countPublished(d.children || []),
        0,
    );
}

export default function DepartmentsPanel({ departments, reload }) {
    const [modal, setModal] = useState(null);
    const [activeTab, setActiveTab] = useState('main'); // 'main' | 'permissions'
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const roles = useRoles(); // уже есть в компоненте выше — пробросить или использовать хук
    const { users } = useUsers();
    const { showConfirm, showAlert, modals } = useModals();

    const openAdd = (parentDept = null) => {
        setForm({ ...EMPTY_FORM, parent: parentDept?.id || null });
        setModal({ _parent: parentDept });
        setActiveTab('main');
        setError('');
    };

    const openEdit = (dept) => {
        setForm({
            name: dept.name,
            code: dept.code,
            description: dept.description || '',
            parent: dept.parent || null,
            phone_internal: dept.phone_internal || '',
            phone_external: dept.phone_external || '',
            email: dept.email || '',
            head_id: dept.head?.id ?? null,
            is_published: !!dept.is_published,
            publish_phone_external: !!dept.publish_phone_external,
            publish_phone_internal: !!dept.publish_phone_internal,
            publish_email: !!dept.publish_email,
            publish_head: !!dept.publish_head,
        });
        setModal(dept);
        setActiveTab('main');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const isEdit = modal?.id;
        const url = isEdit ? `${API}/departments/${modal.id}/` : `${API}/departments/`;
        const method = isEdit ? 'PATCH' : 'POST';
        try {
            const res = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) { reload(); setModal(null); }
            else setError(parseError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    // Правка через API синк не запускает — после сохранения карточки нужен
    // явный клик. Пустой снимок легален: сайт погасит раздел «Отделы».
    const askSync = () => {
        const published = countPublished(departments);
        const empty = published === 0
            ? ' Сейчас не опубликовано ни одного подразделения — раздел «Отделы» на сайте исчезнет.'
            : '';
        showConfirm(
            `Отправить подразделения на сайт? Уйдут только активные и опубликованные — сейчас ${published}.${empty}`,
            runSync,
            false,
        );
    };

    const runSync = async () => {
        setSyncing(true);
        try {
            const { ok, status, data } = await authApi.pushDepartmentsToSite();
            if (ok) showAlert(data?.data?.message || 'Отправка подразделений на сайт запущена');
            else showAlert(parseError(data, status));
        } catch {
            showAlert('Ошибка соединения');
        } finally {
            setSyncing(false);
        }
    };

    const modalTitle = modal?.id
        ? `Редактировать: ${modal.name}`
        : modal?._parent
            ? `Новое подразделение в «${modal._parent.name}»`
            : 'Новое корневое подразделение';

    const isEdit = modal?.id;

    // Руководитель может быть неактивным и отсутствовать в users-list — тогда
    // показываем его текущее значение отдельной опцией, чтобы select не потерял выбор.
    const headMissing = modal?.head && form.head_id === modal.head.id
        && !users.some(u => u.id === modal.head.id);

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Структура подразделений
                </span>
                <div className="flex items-center gap-2">
                    <button onClick={askSync} disabled={syncing}
                        className="border border-emerald-600 text-emerald-700 dark:text-emerald-400
                                   hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                                   disabled:opacity-50 text-xs px-2.5 py-1.5 rounded-lg transition-colors">
                        {syncing ? 'Отправка...' : 'Синхронизировать с сайтом'}
                    </button>
                    <button onClick={() => openAdd(null)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs
                                   px-2.5 py-1.5 rounded-lg transition-colors">
                        + Добавить корневое
                    </button>
                </div>
            </div>

            {departments.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Нет подразделений</p>
            ) : (
                <DepartmentTree departments={departments} onEdit={openEdit} onAdd={openAdd} />
            )}

            {modal !== null && (
                <Modal title={modalTitle} onClose={() => setModal(null)} wide={isEdit}>
                    {/* Вкладки — только для редактирования существующего */}
                    {isEdit && (
                        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg mb-4">
                            {[
                                { id: 'main', label: 'Основное' },
                                { id: 'permissions', label: 'Права' },
                                { id: 'specs', label: 'Характеристики' },
                            ].map(t => (
                                <button key={t.id} onClick={() => setActiveTab(t.id)}
                                    className={`flex-1 py-1.5 rounded text-sm transition-colors ${activeTab === t.id
                                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                                        }`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Вкладка Основное */}
                    {activeTab === 'main' && (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {form.parent && modal?._parent && (
                                <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                                    Родитель: <strong>{modal._parent.name}</strong>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Название
                                </label>
                                <input required value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Бюро автоматики" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Код <span className="text-gray-400 font-normal">(латиница)</span>
                                </label>
                                <input required value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                    placeholder="ba" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Описание
                                </label>
                                <input value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Необязательно" className={inputCls} />
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Контакты</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Телефон (городской)
                                        </label>
                                        <input value={form.phone_external}
                                            onChange={e => setForm(f => ({ ...f, phone_external: e.target.value }))}
                                            placeholder="+7 (812) 301-99-40" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                            Доб. номер
                                        </label>
                                        <input value={form.phone_internal}
                                            onChange={e => setForm(f => ({ ...f, phone_internal: e.target.value }))}
                                            placeholder="101" className={inputCls} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Email
                                    </label>
                                    <input type="email" value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="sales@teplomash.ru" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Руководитель
                                    </label>
                                    <select value={form.head_id ?? ''}
                                        onChange={e => setForm(f => ({ ...f, head_id: e.target.value ? Number(e.target.value) : null }))}
                                        className={inputCls}>
                                        <option value="">Не назначен</option>
                                        {headMissing && (
                                            <option value={modal.head.id}>{modal.head.name}</option>
                                        )}
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Публикация на сайте</p>
                                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                    <input type="checkbox" checked={form.is_published}
                                        onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                                        className="accent-blue-600" />
                                    Показывать подразделение на сайте
                                </label>
                                <div className={`ml-6 space-y-1.5 ${form.is_published ? '' : 'opacity-60'}`}>
                                    {[
                                        ['publish_phone_external', 'Телефон (городской)'],
                                        ['publish_phone_internal', 'Внутренний телефон'],
                                        ['publish_email', 'Email'],
                                        ['publish_head', 'Руководитель'],
                                    ].map(([key, label]) => (
                                        <label key={key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                                            <input type="checkbox" checked={form[key]}
                                                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                                                className="accent-blue-600" />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                    Неотмеченные и пустые контакты на сайт не уходят. Изменения появятся
                                    на сайте после синхронизации.
                                </p>
                            </div>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs
                                                px-3 py-2 rounded-lg">{error}</div>
                            )}
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setModal(null)}
                                    className="flex-1 border border-gray-300 dark:border-gray-600
                                               text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg
                                               hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                    Отмена
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                               text-white text-sm py-2 rounded-lg">
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Вкладка Права — только для существующего подразделения */}
                    {activeTab === 'permissions' && isEdit && (
                        <DeptPermissionsTab deptId={modal.id} roles={roles} />
                    )}
                    {activeTab === 'specs' && isEdit && (
                        <SpecPermissionsTab deptId={modal.id} />
                    )}
                </Modal>
            )}
            {modals}
        </div>
    );
}
