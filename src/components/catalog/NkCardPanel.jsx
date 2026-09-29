import { useState, useEffect } from 'react';
import { catalogApi } from '../../api/catalog';
import { parseError } from '../../utils';
import { nkAttrName, nkStatusLabel, NK_COMPARE_LABEL, NK_COMPARE_SHORT, NK_COMPARE_COLOR } from '../../utils/nk';

// Панель карточки НК товара: что не хватает (nk-card) и, только по кнопке, сравнение с НК
// (compare=1 расходует суточный лимит запросов к НК — результат держим в состоянии, автоматом не зовём).
export default function NkCardPanel({ product, onClose }) {
    const [card, setCard] = useState(null);
    const [error, setError] = useState('');
    const [comparing, setComparing] = useState(false);

    const load = async (compare) => {
        setError('');
        compare ? setComparing(true) : setCard(null);
        try {
            const { ok, status, data } = await catalogApi.nkCard(product.id, compare);
            if (ok && data?.success) setCard(data.data);
            else setError(parseError(data, status));
        } catch {
            setError('Не удалось загрузить карточку НК');
        } finally {
            setComparing(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(false); }, [product.id]);

    const compared = card && ('compare' in card || 'compare_error' in card);

    return (
        <div className="min-w-0 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{product.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">GTIN: {card?.gtin || product.gtin || '—'}</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Закрыть">✕</button>
            </div>

            {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
            {!card && !error && <p className="text-gray-500">Загрузка…</p>}
            {card && !card.has_profile && (
                <p className="text-gray-500 dark:text-gray-400">Для этого типа продукции нет профиля карточки НК.</p>
            )}

            {card?.has_profile && (
                <>
                    <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Что не хватает</h4>
                        {card.problems.length === 0
                            ? <p className="text-green-600 dark:text-green-400">Всё заполнено — карточка готова.</p>
                            : <ul className="list-disc pl-5 text-red-600 dark:text-red-400 space-y-0.5">
                                {card.problems.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>}
                    </div>

                    <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                            Атрибуты карточки{card.good_name ? `: ${card.good_name}` : ''}
                        </h4>
                        <table className="w-full table-fixed text-xs">
                            <colgroup><col className="w-2/5" /><col /></colgroup>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {card.good_attrs.map(a => (
                                    <tr key={a.attr_id} className="text-gray-800 dark:text-gray-200">
                                        <td className="py-1 pr-3 text-gray-500 dark:text-gray-400">{nkAttrName(a.attr_id)}</td>
                                        <td className="py-1 font-mono break-words">{a.attr_value}{a.attr_value_type ? ` ${a.attr_value_type}` : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <button onClick={() => load(true)} disabled={comparing}
                            className="px-4 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                            title="Один запрос к НК из суточного лимита">
                            {comparing ? 'Сравнение…' : 'Сравнить с НК'}
                        </button>

                        {card.compare_error && <p className="text-red-600 dark:text-red-400">НК: {card.compare_error}</p>}
                        {compared && !card.compare_error && (
                            <>
                                <p className="text-gray-700 dark:text-gray-300">
                                    {card.nk
                                        ? <>Карточка в НК: <b>{nkStatusLabel(card.nk.status)}</b></>
                                        : 'Карточки в НК нет.'}
                                    {card.nk_usage && (
                                        <span className="ml-3 text-xs text-gray-500">
                                            запросов НК использовано {card.nk_usage[0]}/{card.nk_usage[1]}
                                        </span>
                                    )}
                                </p>
                                {card.compare?.length > 0 && (
                                    <table className="w-full table-fixed text-xs">
                                        <colgroup>
                                            <col className="w-[28%]" /><col className="w-[30%]" />
                                            <col className="w-[30%]" /><col className="w-[12%]" />
                                        </colgroup>
                                        <thead className="text-left text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="py-1 px-1 font-normal">Атрибут</th>
                                                <th className="py-1 px-1 font-normal">У нас</th>
                                                <th className="py-1 px-1 font-normal">В НК</th>
                                                <th className="py-1 px-1" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {card.compare.map(c => (
                                                <tr key={c.attr_id} className={`align-top ${NK_COMPARE_COLOR[c.status]}`}>
                                                    <td className="py-1 px-1 break-words">{nkAttrName(c.attr_id)}</td>
                                                    <td className="py-1 px-1 font-mono break-words">{c.ours ?? '—'}{c.ours && c.unit ? ` ${c.unit}` : ''}</td>
                                                    <td className="py-1 px-1 font-mono break-words">{c.nk ?? '—'}{c.nk && c.unit ? ` ${c.unit}` : ''}</td>
                                                    <td className="py-1 px-1 text-right whitespace-nowrap" title={NK_COMPARE_LABEL[c.status]}>
                                                        {NK_COMPARE_SHORT[c.status]}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
