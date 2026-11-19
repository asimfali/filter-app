import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dealersApi } from '../api/dealers';
import { can, PERM } from '../utils/permissions';
import { inputCls } from '../utils/styles';
import { envelopeError } from '../utils';
import { useModals } from '../hooks/useModals';
import DealerFormModal from '../components/dealers/DealerFormModal';
import DealerImportModal from '../components/dealers/DealerImportModal';
import { IconPencil, IconBan, IconUndo } from '../components/common/Icons';

const PAGE_SIZE = 50;

const fmtDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('ru-RU');
};

const matchesSearch = (dealer, search) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [dealer.inn, dealer.code, dealer.name]
        .some(value => String(value ?? '').toLowerCase().includes(q));
};

// Портал отдаёт список массивом целиком: пагинации у ViewSet нет, серверные фильтры
// (?group/?search/?is_active) есть, но счётчикам в шапке нужны все записи сразу,
// поэтому статус, группа, поиск, сортировку и страницы режем на клиенте. Заявлено,
// что дальше будет «везде конверт {success, data}», поэтому разворачиваем и его:
// data может быть массивом или страницей {count, results}.
const unwrap = (body) => (
    body && !Array.isArray(body) && typeof body === 'object' && 'success' in body
        ? body.data
        : body
);

// «Свежие» сверху. Даты создания записи портал пока не отдаёт: в DealerListSerializer
// её нет, поэтому берём ближайшую известную — created_at/updated_at, а если портал их
// добавит, сортировка сама переключится. Фолбэк — «письмо отправлено». Дилер без дат
// уходит в конец списка.
const freshTime = (dealer) => {
    const raw = dealer.created_at || dealer.updated_at || dealer.letter_sent_at;
    const time = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(time) ? -Infinity : time;
};

// Строка-фильтр над таблицей: сегменты со счётчиками по всему справочнику.
const STATUS_FILTERS = [
    { key: 'all', label: 'Все', countKey: 'total' },
    { key: 'active', label: 'Активные', countKey: 'active' },
    { key: 'inactive', label: 'Неактивные', countKey: 'inactive' },
];

const matchesStatus = (dealer, filter) => {
    if (filter === 'active') return dealer.is_active !== false;
    if (filter === 'inactive') return dealer.is_active === false;
    return true;
};

// Группа контрагента: пусто в фильтре — все группы (в т.ч. дилеры, у которых поля ещё нет)
const matchesGroup = (dealer, group) => !group || dealer.group === group;

const buildView = (body, { search, filter, group, page }) => {
    const data = unwrap(body);
    // Серверная страница: разбивку по статусам из неё не посчитать — панель покажет значения без цифр
    if (!Array.isArray(data)) {
        return { count: data?.count ?? 0, results: data?.results ?? [], counts: null };
    }
    const counts = {
        total: data.length,
        active: data.filter(dealer => dealer.is_active !== false).length,
        inactive: data.filter(dealer => dealer.is_active === false).length,
    };
    const filtered = data
        .filter(dealer => matchesStatus(dealer, filter))
        .filter(dealer => matchesGroup(dealer, group))
        .filter(dealer => matchesSearch(dealer, search))
        .sort((a, b) => freshTime(b) - freshTime(a));
    const start = (page - 1) * PAGE_SIZE;
    return { count: filtered.length, results: filtered.slice(start, start + PAGE_SIZE), counts };
};

const primaryActionCls = 'px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors';
const secondaryActionCls = 'px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors';

// Действия в строке — только иконки, чтобы колонка не съедала ширину у полей;
// полное название остаётся в title и aria-label (по нему же ищут кнопки тесты).
const iconBtnCls = 'p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const editBtnCls = `${iconBtnCls} text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/40`;
const revokeBtnCls = `${iconBtnCls} text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40`;
const restoreBtnCls = `${iconBtnCls} text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40`;

// Таблица не влезает уже на 1024px: до lg шапка скрыта, а строка разворачивается
// в карточку — подпись поля подставляет сама ячейка (CellLabel), значения тянутся
// на всю ширину, действия уходят вправо вниз.
// На десктопе раскладка фиксированная (lg:table-fixed) и ширины заданы в шапке:
// иначе auto-layout раздаёт свободное место пропорционально содержимому и колонка
// «Статус» разъезжается на пустоту. Всё свободное место забирает «Название».
const thCls = 'px-3 py-2 font-medium';
const cellCls = 'flex items-baseline gap-2 py-1 lg:table-cell lg:px-3 lg:py-2 lg:align-top';
const CellLabel = ({ children }) => (
    <span className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500 lg:hidden">{children}</span>
);

// Справочник дилеров: список с поиском, создание/редактирование и отмена
// авторизации (revoke → is_active=false, без удаления). Код дилера присваивает портал.
export default function DealersPage() {
    const { user } = useAuth();
    // Отдельного права на чтение у бэкенда нет: apps.dealers проверяет
    // portal.dealers.write и на GET тоже, поэтому смотрим только его.
    const canWrite = can(user, PERM.PORTAL_DEALERS_WRITE);
    const canView = canWrite;
    const { showConfirm, modals } = useModals();

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('active'); // all | active | inactive
    const [groupFilter, setGroupFilter] = useState(''); // '' — все группы, иначе значение из /groups/
    const [groups, setGroups] = useState([]);       // [{value, label}] с портала — для фильтра и формы
    const [counts, setCounts] = useState(null);     // {total, active, inactive} по всему справочнику
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ count: 0, results: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState(null); // null — модалка закрыта; иначе { dealer } (null = создание)
    const [importOpen, setImportOpen] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const reqRef = useRef(0);
    const committedSearchRef = useRef('');

    // Дебаунс поиска: страницу сбрасываем только когда запрос реально изменился
    // (иначе таймер с момента монтирования сбрасывал уже выбранную страницу).
    useEffect(() => {
        const t = setTimeout(() => {
            const next = searchInput.trim();
            if (next === committedSearchRef.current) return;
            committedSearchRef.current = next;
            setSearch(next);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        const req = ++reqRef.current;
        setLoading(true);
        setError('');
        try {
            // Справочник тянем целиком: счётчики в панели считаются по всем дилерам,
            // а не по найденным (серверные фильтры портал принимает, но здесь не нужны).
            const { ok, data: body, status } = await dealersApi.list({});
            if (req !== reqRef.current) return;
            if (ok && body?.success !== false) {
                const view = buildView(body, { search, filter, group: groupFilter, page });
                setData({ count: view.count, results: view.results });
                setCounts(view.counts);
            } else {
                setError(envelopeError(body, status));
            }
        } catch {
            if (req === reqRef.current) setError('Не удалось загрузить дилеров');
        } finally {
            if (req === reqRef.current) setLoading(false);
        }
    }, [search, filter, groupFilter, page]);

    useEffect(() => { if (canView) load(); }, [canView, load]);

    // Группы контрагента нужны и фильтру, и форме — запрашиваем один раз на страницу.
    // Ошибка справочника групп не блокирует список: фильтр просто останется без вариантов.
    useEffect(() => {
        if (!canView) return undefined;
        let alive = true;
        dealersApi.groups()
            .then(({ ok, data: body }) => {
                const list = unwrap(body);
                if (alive && ok && Array.isArray(list)) setGroups(list);
            })
            .catch(() => {});
        return () => { alive = false; };
    }, [canView]);

    if (!canView) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">Недостаточно прав для просмотра дилеров</p>;
    }

    const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));

    // Общая обёртка для revoke/restore: ошибка наверх, успех — перезагрузка списка
    const runAction = async (dealer, action, fallbackError) => {
        setBusyId(dealer.id);
        setError('');
        try {
            const { ok, data: body, status } = await action();
            if (!ok || body?.success === false) { setError(envelopeError(body, status)); return; }
            await load();
        } catch {
            setError(fallbackError);
        } finally {
            setBusyId(null);
        }
    };

    // Точечное обновление строки в уже загруженном списке — без перезагрузки:
    // иначе после PATCH список пересортируется по свежести и галочка уедет из-под курсора.
    const patchRow = (id, patch) => setData(prev => ({
        ...prev,
        results: prev.results.map(item => (item.id === id ? { ...item, ...patch } : item)),
    }));

    // Галочка «публиковать контакты» — PATCH по одному полю. Ставим её сразу
    // (оптимистично), при ошибке откатываем и показываем текст портала.
    const toggleContacts = async (dealer, next) => {
        setBusyId(dealer.id);
        setError('');
        patchRow(dealer.id, { contacts_published: next });
        try {
            const { ok, data: body, status } = await dealersApi.update(dealer.id, { contacts_published: next });
            if (!ok || body?.success === false) {
                patchRow(dealer.id, { contacts_published: !next });
                setError(envelopeError(body, status));
            }
        } catch {
            patchRow(dealer.id, { contacts_published: !next });
            setError('Не удалось изменить публикацию контактов');
        } finally {
            setBusyId(null);
        }
    };

    const askRevoke = (dealer) => {
        showConfirm(
            `Отменить авторизацию дилера «${dealer.name}» (ИНН ${dealer.inn})? ` +
            'Дилер перестанет подтверждаться на сайте. Запись не удаляется — ' +
            'она остаётся в справочнике со статусом «авторизация отменена».',
            () => runAction(
                dealer,
                () => dealersApi.revoke(dealer.id),
                'Не удалось отменить авторизацию',
            ),
        );
    };

    const askRestore = (dealer) => {
        showConfirm(
            `Восстановить авторизацию дилера «${dealer.name}» (ИНН ${dealer.inn})? ` +
            'Дилер снова начнёт уходить на сайт и проходить проверку.',
            () => runAction(
                dealer,
                () => dealersApi.restore(dealer.id),
                'Не удалось восстановить авторизацию',
            ),
            false,
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Дилеры</h1>
                {canWrite && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setImportOpen(true)} className={secondaryActionCls}>
                            Импорт из xlsx
                        </button>
                        <button onClick={() => setForm({ dealer: null })} className={primaryActionCls}>
                            Добавить дилера
                        </button>
                    </div>
                )}
            </div>

            {/* Панель управления: чипы статуса со счётчиками по всему справочнику
                (одновременно фильтр и сводка) + поиск справа */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group"
                    aria-label="Фильтр дилеров по статусу">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-0.5">Показать:</span>
                    {STATUS_FILTERS.map(({ key, label, countKey }) => {
                        const selected = filter === key;
                        const value = counts?.[countKey];
                        return (
                            <button key={key} type="button" aria-pressed={selected}
                                onClick={() => { setFilter(key); setPage(1); }}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full
                                    border transition-colors
                                    ${selected
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-neutral-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-neutral-800'}`}>
                                {label}{' '}
                                {value !== undefined && (
                                    <span className={`rounded-full px-1.5 text-[11px] tabular-nums
                                        ${selected
                                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                                            : 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400'}`}>
                                        {value}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="w-full sm:w-48">
                    <select className={inputCls} aria-label="Фильтр по группе" value={groupFilter}
                        onChange={e => { setGroupFilter(e.target.value); setPage(1); }}>
                        <option value="">Все группы</option>
                        {groups.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full sm:w-72 sm:ml-auto">
                    <input className={inputCls} value={searchInput} placeholder="ИНН, код, название…"
                        onChange={e => setSearchInput(e.target.value)} />
                </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                <table className="w-full text-sm block lg:table lg:table-fixed lg:min-w-[1290px]">
                    <thead className="hidden lg:table-header-group">
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className={`${thCls} lg:w-[110px]`}>ИНН</th>
                            <th className={`${thCls} lg:w-[70px]`}>Код</th>
                            <th className={thCls}>Название</th>
                            <th className={`${thCls} lg:w-[130px]`}>Группа</th>
                            <th className={`${thCls} lg:w-[140px]`}>Статус</th>
                            <th className={`${thCls} lg:w-[110px] whitespace-nowrap`}>Письмо</th>
                            <th className={`${thCls} lg:w-[120px]`}>Директор</th>
                            <th className={`${thCls} lg:w-[120px]`}>Телефон</th>
                            <th className={`${thCls} lg:w-[160px]`}>E-mail</th>
                            <th className={`${thCls} lg:w-[100px]`}
                                title="Публиковать контакты на сайте">Публикация</th>
                            <th className={`${thCls} lg:w-[90px] lg:sticky lg:right-0 lg:z-10 lg:bg-white lg:dark:bg-neutral-900
                                lg:border-l lg:border-gray-100 lg:dark:border-gray-800`} />
                        </tr>
                    </thead>
                    <tbody className={`block lg:table-row-group ${loading ? 'opacity-50' : ''}`}>
                        {data.results.map(dealer => {
                            const active = dealer.is_active !== false;
                            return (
                                <tr key={dealer.id}
                                    className={`block lg:table-row px-4 py-2 lg:p-0 border-b last:border-0
                                        border-gray-100 dark:border-gray-800
                                        ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                    <td className={cellCls}>
                                        <CellLabel>ИНН</CellLabel>
                                        <span className="font-mono text-xs whitespace-nowrap">{dealer.inn}</span>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Код</CellLabel>
                                        <span className="font-mono text-xs whitespace-nowrap">{dealer.code || '—'}</span>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Название</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none">
                                            <div className="truncate" title={dealer.name}>
                                                {dealer.name}
                                            </div>
                                            {dealer.legal_address && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500
                                                    truncate" title={dealer.legal_address}>
                                                    {dealer.legal_address}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Группа</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none">
                                            <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap
                                                bg-neutral-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                                                {dealer.group_label || dealer.group || '—'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Статус</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none">
                                            {active ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap
                                                    bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                                    активен
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 rounded-full
                                                    bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400">
                                                    авторизация отменена
                                                </span>
                                            )}
                                            {dealer.note && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5
                                                    truncate" title={dealer.note}>
                                                    {dealer.note}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Письмо</CellLabel>
                                        <span className="whitespace-nowrap">{fmtDate(dealer.letter_sent_at)}</span>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Директор</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none truncate"
                                            title={dealer.director || ''}>
                                            {dealer.director || '—'}
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Телефон</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none truncate"
                                            title={dealer.phones || ''}>
                                            {dealer.phones || '—'}
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>E-mail</CellLabel>
                                        <div className="min-w-0 flex-1 lg:flex-none">
                                            <div className="truncate" title={dealer.email || ''}>
                                                {dealer.email || '—'}
                                            </div>
                                            {dealer.website && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500
                                                    truncate" title={dealer.website}>
                                                    {dealer.website}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className={cellCls}>
                                        <CellLabel>Публикация</CellLabel>
                                        <input type="checkbox" className="rounded"
                                            checked={dealer.contacts_published === true}
                                            disabled={!active || busyId === dealer.id}
                                            onChange={e => toggleContacts(dealer, e.target.checked)}
                                            aria-label={`Публиковать контакты: ${dealer.name}`}
                                            title={active
                                                ? 'Публиковать контакты (телефоны, e-mail, сайт) на сайте'
                                                : 'Сначала восстановите авторизацию: сайт получает только активных дилеров'} />
                                    </td>
                                    <td className={`${cellCls} justify-end lg:text-right
                                        lg:sticky lg:right-0 lg:z-10 lg:bg-white lg:dark:bg-neutral-900
                                        lg:border-l lg:border-gray-100 lg:dark:border-gray-800`}>
                                        {canWrite && (
                                            <span className="inline-flex items-center gap-1">
                                                <button type="button" onClick={() => setForm({ dealer })}
                                                    className={editBtnCls}
                                                    aria-label="Редактировать" title="Редактировать">
                                                    <IconPencil />
                                                </button>
                                                {active ? (
                                                    <button type="button" onClick={() => askRevoke(dealer)}
                                                        disabled={busyId === dealer.id}
                                                        className={revokeBtnCls}
                                                        aria-label="Отменить авторизацию" title="Отменить авторизацию">
                                                        <IconBan />
                                                    </button>
                                                ) : (
                                                    <button type="button" onClick={() => askRestore(dealer)}
                                                        disabled={busyId === dealer.id}
                                                        className={restoreBtnCls}
                                                        aria-label="Восстановить" title="Восстановить">
                                                        <IconUndo />
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && data.results.length === 0 && (
                            <tr>
                                <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                                    {filter === 'inactive' ? 'Неактивных дилеров нет' : 'Дилеров нет'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {data.count > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">←</button>
                    <span>Стр. {page} из {totalPages} · всего {data.count}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">→</button>
                </div>
            )}

            {form && (
                <DealerFormModal
                    dealer={form.dealer}
                    groups={groups}
                    onClose={() => setForm(null)}
                    onSaved={() => { setForm(null); load(); }}
                />
            )}
            {importOpen && (
                <DealerImportModal
                    onClose={() => setImportOpen(false)}
                    onImported={() => load()}
                />
            )}
            {modals}
        </div>
    );
}
