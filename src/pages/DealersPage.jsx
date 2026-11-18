import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dealersApi } from '../api/dealers';
import { can, PERM } from '../utils/permissions';
import { inputCls } from '../utils/styles';
import { envelopeError } from '../utils';
import { useModals } from '../hooks/useModals';
import DealerFormModal from '../components/dealers/DealerFormModal';

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

// Портал сейчас отдаёт список массивом целиком, без filter_backends и пагинации
// (?search/?is_active игнорируются) — поэтому фильтруем и режем страницы на клиенте.
// Заявлено, что дальше будет «везде конверт {success, data}», поэтому разворачиваем
// и его: data может быть массивом или страницей {count, results}.
const unwrap = (body) => (
    body && !Array.isArray(body) && typeof body === 'object' && 'success' in body
        ? body.data
        : body
);

const normalize = (body, search, showInactive, page) => {
    const data = unwrap(body);
    if (!Array.isArray(data)) {
        return { count: data?.count ?? 0, results: data?.results ?? [] };
    }
    const filtered = data
        .filter(dealer => showInactive || dealer.is_active !== false)
        .filter(dealer => matchesSearch(dealer, search));
    const start = (page - 1) * PAGE_SIZE;
    return { count: filtered.length, results: filtered.slice(start, start + PAGE_SIZE) };
};

const primaryActionCls = 'px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors';
const linkBtnCls = 'text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50';
const dangerBtnCls = 'text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50';

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
    const [showInactive, setShowInactive] = useState(false);
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ count: 0, results: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState(null); // null — модалка закрыта; иначе { dealer } (null = создание)
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
            const { ok, data: body, status } = await dealersApi.list({
                search,
                isActive: showInactive ? null : true,
                page,
                pageSize: PAGE_SIZE,
            });
            if (req !== reqRef.current) return;
            if (ok && body?.success !== false) setData(normalize(body, search, showInactive, page));
            else setError(envelopeError(body, status));
        } catch {
            if (req === reqRef.current) setError('Не удалось загрузить дилеров');
        } finally {
            if (req === reqRef.current) setLoading(false);
        }
    }, [search, showInactive, page]);

    useEffect(() => { if (canView) load(); }, [canView, load]);

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
                    <button onClick={() => setForm({ dealer: null })} className={primaryActionCls}>
                        Добавить дилера
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="w-72">
                    <input className={inputCls} value={searchInput} placeholder="ИНН, код, название…"
                        onChange={e => setSearchInput(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input type="checkbox" className="rounded" checked={showInactive}
                        onChange={e => { setShowInactive(e.target.checked); setPage(1); }} />
                    Показать неактивных
                </label>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-3 py-2 font-medium">ИНН</th>
                            <th className="px-3 py-2 font-medium">Код</th>
                            <th className="px-3 py-2 font-medium">Название</th>
                            <th className="px-3 py-2 font-medium">Статус</th>
                            <th className="px-3 py-2 font-medium whitespace-nowrap">Письмо</th>
                            <th className="px-3 py-2 font-medium">Директор</th>
                            <th className="px-3 py-2 font-medium">Телефон</th>
                            <th className="px-3 py-2 font-medium">E-mail</th>
                            <th className="px-3 py-2 sticky right-0 z-10 bg-white dark:bg-neutral-900
                                border-l border-gray-100 dark:border-gray-800" />
                        </tr>
                    </thead>
                    <tbody className={loading ? 'opacity-50' : ''}>
                        {data.results.map(dealer => {
                            const active = dealer.is_active !== false;
                            return (
                                <tr key={dealer.id}
                                    className={`border-b last:border-0 border-gray-100 dark:border-gray-800
                                        ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{dealer.inn}</td>
                                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{dealer.code || '—'}</td>
                                    <td className="px-3 py-2">
                                        <div className="max-w-[240px] truncate" title={dealer.name}>
                                            {dealer.name}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        {active ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap
                                                bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                                активен
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap
                                                bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400">
                                                авторизация отменена
                                            </span>
                                        )}
                                        {dealer.note && (
                                            <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5
                                                max-w-[200px] truncate" title={dealer.note}>
                                                {dealer.note}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(dealer.letter_sent_at)}</td>
                                    <td className="px-3 py-2">
                                        <div className="max-w-[170px] truncate" title={dealer.director || ''}>
                                            {dealer.director || '—'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{dealer.phones || '—'}</td>
                                    <td className="px-3 py-2">
                                        <div className="max-w-[200px] truncate" title={dealer.email || ''}>
                                            {dealer.email || '—'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right sticky right-0 z-10
                                        bg-white dark:bg-neutral-900 border-l border-gray-100 dark:border-gray-800">
                                        {canWrite && (
                                            <span className="inline-flex gap-3">
                                                <button onClick={() => setForm({ dealer })} className={linkBtnCls}>
                                                    Редактировать
                                                </button>
                                                {active ? (
                                                    <button onClick={() => askRevoke(dealer)}
                                                        disabled={busyId === dealer.id}
                                                        className={dangerBtnCls}>
                                                        Отменить авторизацию
                                                    </button>
                                                ) : (
                                                    <button onClick={() => askRestore(dealer)}
                                                        disabled={busyId === dealer.id}
                                                        className={linkBtnCls}>
                                                        Восстановить
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
                                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                                    Дилеров нет
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
                    onClose={() => setForm(null)}
                    onSaved={() => { setForm(null); load(); }}
                />
            )}
            {modals}
        </div>
    );
}
