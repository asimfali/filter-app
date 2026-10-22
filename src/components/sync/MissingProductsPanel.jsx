import { useState } from 'react';
import { externalApi } from '../../api/external';
import useTaskPolling from '../../hooks/useTaskPolling';
import { envelopeError } from '../../utils';
import ConfirmModal from '../common/ConfirmModal';

// Типы продукции из папок синхронизации: [{slug, name}] в порядке появления
const groupByProductType = (configs) => {
    const seen = new Map();
    configs.forEach(c => {
        if (c.product_type_slug && !seen.has(c.product_type_slug)) {
            seen.set(c.product_type_slug, { slug: c.product_type_slug, name: c.product_type_name || c.product_type_slug });
        }
    });
    return [...seen.values()];
};

// Проверка «Товары, которых нет в 1С» одного типа и снятие найденных с активных (external.sync_catalog)
function TypeCheck({ type }) {
    const [result, setResult] = useState(null);     // результат задачи {configs, errors, missing}
    const [checked, setChecked] = useState(new Set());
    const [confirming, setConfirming] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [done, setDone] = useState(null);         // число снятых
    const [actionError, setActionError] = useState('');

    const { busy, info, error, start } = useTaskPolling(externalApi.taskStatus, (r, err) => {
        // success:false с errors по папкам — не сбой задачи, а результат проверки: показываем ошибки
        if (err && !r?.errors?.length) return;
        setResult(r);
        setChecked(new Set((r.missing || []).map(p => p.id)));
    });

    const check = () => {
        setResult(null);
        setDone(null);
        setActionError('');
        start(() => externalApi.missingProducts(type.slug), 'Не удалось запустить проверку');
    };

    const toggle = (id) => setChecked(prev => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    const deactivate = async () => {
        setConfirming(false);
        setDeactivating(true);
        setActionError('');
        const ids = result.missing.filter(p => checked.has(p.id)).map(p => p.id);
        try {
            const { ok, data, status } = await externalApi.deactivateProducts(type.slug, ids);
            if (ok && data?.success) {
                setDone(data.data.deactivated);
                setResult(null);
            } else {
                setActionError(envelopeError(data, status));
            }
        } catch {
            setActionError('Не удалось снять товары с активных');
        }
        setDeactivating(false);
    };

    const missing = result?.missing || [];
    const errors = result?.errors || [];
    const hasErrors = errors.length > 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 dark:text-gray-200">{type.name}</span>
                <button onClick={check} disabled={busy || deactivating}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg text-white
                               bg-violet-600 hover:bg-violet-700 disabled:opacity-40 transition-colors">
                    {busy ? (info?.status || 'Проверка…') : 'Проверить товары не из 1С'}
                </button>
            </div>

            {error && !result && <p className="text-xs text-red-500">{error}</p>}
            {actionError && <p className="text-xs text-red-500">{actionError}</p>}
            {done !== null && <p className="text-xs text-emerald-500">✓ Снято с активных: {done}</p>}

            {result && (
                <div className="text-xs space-y-2">
                    <p className="text-gray-500 dark:text-gray-400">
                        Папок опрошено: {result.configs?.length ?? 0}, товаров в 1С: {(result.configs || []).reduce((s, c) => s + c.count, 0)}
                    </p>

                    {hasErrors && (
                        <ul className="text-red-500 list-disc pl-4">
                            {errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    )}

                    {!hasErrors && missing.length === 0 && (
                        <p className="text-emerald-500">✓ Все товары типа есть в 1С</p>
                    )}

                    {!hasErrors && missing.length > 0 && (
                        <>
                            <table className="w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                                <thead className="text-left text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="w-6 p-1.5" />
                                        <th className="p-1.5">Название</th>
                                        <th className="p-1.5">Артикул</th>
                                        <th className="p-1.5">На сайте</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                                    {missing.map(p => (
                                        <tr key={p.id}>
                                            <td className="p-1.5">
                                                <input type="checkbox" checked={checked.has(p.id)}
                                                    onChange={() => toggle(p.id)} aria-label={p.name} />
                                            </td>
                                            <td className="p-1.5">{p.name}</td>
                                            <td className="p-1.5">{p.sku || '—'}</td>
                                            <td className="p-1.5">{p.is_published ? 'да' : 'нет'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => setConfirming(true)}
                                disabled={checked.size === 0 || deactivating}
                                className="w-full px-3 py-2 text-xs font-medium rounded-lg text-white
                                           bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors">
                                Снять с активных ({checked.size})
                            </button>
                        </>
                    )}
                </div>
            )}

            {confirming && (
                <ConfirmModal
                    message={`Снять с активных товаров: ${checked.size}? Товары не удаляются: останутся в портале неактивными, на сайте скроются сразу. Вернуть можно по одному.`}
                    onConfirm={deactivate}
                    onCancel={() => setConfirming(false)} />
            )}
        </div>
    );
}

export default function MissingProductsPanel({ configs }) {
    const types = groupByProductType(configs);
    if (!types.length) return null;
    return (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Товары, которых нет в 1С
            </h3>
            {types.map(t => <TypeCheck key={t.slug} type={t} />)}
        </div>
    );
}
