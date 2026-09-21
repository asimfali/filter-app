import { useState, useEffect } from 'react';
import { externalApi } from '../../api/external';
import { gs1Error, fmtGs1Date, GS1_STATUS_LABEL, GS1_STATUS_COLOR, GS1_REASON_LABEL } from '../../utils/gs1';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import SmartSelect from '../common/SmartSelect';

const btnCls = 'px-3 py-1.5 text-xs rounded-lg text-white disabled:opacity-50 transition-colors';

const Field = ({ label, children }) => (
    <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm text-gray-900 dark:text-white break-words">{children}</div>
    </div>
);

// Разбор одной записи очереди ГС1 (external.gs1_resolve): кандидаты, ручной выбор товара,
// замена GTIN через подтверждение, игнор/возврат в очередь.
export default function Gs1ItemModal({ itemId, onClose, onChanged }) {
    const [item, setItem] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [picked, setPicked] = useState(null);
    // {product: {id, name}, currentGtin} — ждём подтверждения замены GTIN
    const [replacing, setReplacing] = useState(null);

    useEffect(() => {
        let alive = true;
        externalApi.getGs1Item(itemId).then(({ ok, data, status }) => {
            if (!alive) return;
            if (ok && data?.success) setItem(data.data);
            else setError(gs1Error(data, status));
        }).catch(() => alive && setError('Не удалось загрузить запись'));
        return () => { alive = false; };
    }, [itemId]);

    const currentGtin = item?.reason === 'product_has_other_gtin' ? item.candidates?.[0]?.gtin : null;

    const resolve = async (action, product = null) => {
        setBusy(true);
        setError('');
        setReplacing(null);
        try {
            const { ok, data, status } = await externalApi.resolveGs1Item(item.id, action, product?.id);
            if (ok && data?.success) {
                setItem(data.data);
                setPicked(null);
                onChanged?.();
            } else if (status === 409 && data?.error?.code === 'product_has_other_gtin') {
                setReplacing({ product, currentGtin: data.error.current_gtin });
            } else {
                setError(gs1Error(data, status));
            }
        } catch {
            setError('Не удалось выполнить действие');
        } finally {
            setBusy(false);
        }
    };

    // У кандидата уже есть другой GTIN — сразу предлагаем замену, иначе обычное назначение
    // (если бэкенд всё же ответит product_has_other_gtin, разбор уйдёт в то же подтверждение)
    const assign = (product) => (product.gtin && product.gtin !== item.gtin
        ? setReplacing({ product, currentGtin: product.gtin })
        : resolve('assign', product));

    const candidates = item?.candidates ?? [];
    const first = candidates[0] ?? {};
    const isProposal = item?.status === 'new' && candidates.length === 1;
    const canResolve = item && item.status !== 'matched' && item.status !== 'ignored';

    return (
        <Modal title={item ? `GTIN ${item.gtin}` : 'Запись ГС1'} onClose={onClose} maxWidth="2xl" scrollBody>
            {!item && !error && <p className="text-sm text-gray-400">Загрузка…</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
            {item && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${GS1_STATUS_COLOR[item.status] ?? ''}`}>
                            {GS1_STATUS_LABEL[item.status] ?? item.status}
                        </span>
                        {item.reason && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {GS1_REASON_LABEL[item.reason] ?? item.reason}
                            </span>
                        )}
                        {!item.is_active_in_gs1 && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">деактивирован в ГС1</span>
                        )}
                    </div>

                    <Field label="Описание">{item.prod_desc_full || item.prod_desc}</Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Дата регистрации в ГС1">{fmtGs1Date(item.prod_regdate)}</Field>
                        {item.product && (
                            <Field label="Товар">{item.product_name}{item.product_sku && ` (${item.product_sku})`}</Field>
                        )}
                    </div>

                    {currentGtin && (
                        <div className="text-xs rounded-lg border border-amber-200 dark:border-amber-800
                                        bg-amber-50 dark:bg-amber-900/20 p-3 text-gray-700 dark:text-gray-300">
                            У товара уже записан GTIN <b className="font-mono">{currentGtin}</b>
                            {' '}(регистрация {item.candidates[0].current_gtin_regdate
                                ? fmtGs1Date(item.candidates[0].current_gtin_regdate)
                                : 'дата неизвестна'}).
                            Этот GTIN — <b className="font-mono">{item.gtin}</b> (регистрация {fmtGs1Date(item.prod_regdate)}).
                            Как правило, новая регистрация актуальнее, но решение — за вами.
                        </div>
                    )}
                    {item.reason === 'duplicate_in_gs1' && first.competing_gtins?.length > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            На этот же товар претендуют GTIN:{' '}
                            <span className="font-mono">{first.competing_gtins.join(', ')}</span>
                        </p>
                    )}
                    {item.reason === 'gtin_taken' && first.taken_by && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            GTIN уже записан на товар #{first.taken_by}.
                        </p>
                    )}

                    {canResolve && candidates.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {isProposal ? 'Предложенное совпадение'
                                    : item.status === 'unmatched' ? 'Возможно, подойдут (только подсказки — проверьте вручную)'
                                        : 'Кандидаты'}
                            </h4>
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                                {candidates.map(c => (
                                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                        <div className="min-w-0 text-sm text-gray-900 dark:text-white">
                                            <div className="truncate">{c.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {c.sku && <>{c.sku} · </>}
                                                {c.is_active === false && <>неактивен · </>}
                                                {c.gtin ? <>GTIN <span className="font-mono">{c.gtin}</span></> : 'GTIN не задан'}
                                            </div>
                                        </div>
                                        <button disabled={busy} onClick={() => assign(c)}
                                            className={`${btnCls} shrink-0 ${c.gtin && c.gtin !== item.gtin
                                                ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                            {c.gtin && c.gtin !== item.gtin ? 'Заменить GTIN' : 'Назначить'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {canResolve && (
                        <div>
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Назначить другой товар
                            </h4>
                            <div className="flex items-center gap-2">
                                <SmartSelect
                                    className="flex-1"
                                    endpoint="/api/v1/catalog/products/search/"
                                    placeholder="Поиск товара по названию, артикулу или GTIN…"
                                    value={picked}
                                    onSelect={setPicked}
                                    onClear={() => setPicked(null)}
                                />
                                <button disabled={busy || !picked} onClick={() => assign(picked)}
                                    className={`${btnCls} bg-blue-600 hover:bg-blue-700 shrink-0`}>
                                    Назначить
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        {canResolve && (
                            <button disabled={busy} onClick={() => resolve('ignore')}
                                className={`${btnCls} bg-neutral-500 hover:bg-neutral-600`}>
                                Игнорировать
                            </button>
                        )}
                        {item.status === 'ignored' && (
                            <button disabled={busy} onClick={() => resolve('reopen')}
                                className={`${btnCls} bg-blue-600 hover:bg-blue-700`}>
                                Вернуть в очередь
                            </button>
                        )}
                    </div>

                    <details className="text-xs text-gray-600 dark:text-gray-400">
                        <summary className="cursor-pointer select-none">Все атрибуты ГС1</summary>
                        <pre className="mt-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 overflow-x-auto">
                            {JSON.stringify(item.raw ?? {}, null, 2)}
                        </pre>
                    </details>
                </div>
            )}

            {replacing && (
                <ConfirmModal
                    message={<>
                        У товара «{replacing.product?.name}» уже записан другой GTIN.
                        <span className="block mt-2">Старый: <b className="font-mono">{replacing.currentGtin}</b></span>
                        <span className="block">Новый: <b className="font-mono">{item.gtin}</b></span>
                        <span className="block mt-2">Заменить GTIN?</span>
                    </>}
                    onConfirm={() => resolve('replace', replacing.product)}
                    onCancel={() => setReplacing(null)}
                />
            )}
        </Modal>
    );
}
