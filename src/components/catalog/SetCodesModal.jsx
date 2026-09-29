import { useState } from 'react';
import { catalogApi } from '../../api/catalog';
import { parseError } from '../../utils';
import { inputCls } from '../../utils/styles';
import { normTnved, normOkpd2, validateTnved, validateOkpd2 } from '../../utils/productCodes';
import Modal from '../common/Modal';

const CHUNK = 5000; // лимит set-codes на один запрос

// Пакетная запись ТНВЭД/ОКПД2 в tmdata (catalog.product_codes.write). Конфликт = у товара уже
// другой код: без overwrite он пропущен целиком, дальше — «Перезаписать у N товаров».
export default function SetCodesModal({ productIds, onClose, onDone }) {
    const [tnved, setTnved] = useState('');
    const [okpd2, setOkpd2] = useState('');
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const run = async (overwrite, ids) => {
        const e = {
            ...(tnved.trim() && validateTnved(tnved) && { tnved: validateTnved(tnved) }),
            ...(okpd2.trim() && validateOkpd2(okpd2) && { okpd2: validateOkpd2(okpd2) }),
        };
        if (!tnved.trim() && !okpd2.trim()) e.tnved = 'Укажите ТНВЭД и/или ОКПД2';
        setErrors(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        setError('');
        const acc = { total: 0, changed: 0, unchanged: 0, conflicts: [], not_found: [] };
        try {
            for (let i = 0; i < ids.length; i += CHUNK) {
                const { ok, status, data } = await catalogApi.setCodes({
                    product_ids: ids.slice(i, i + CHUNK),
                    ...(tnved.trim() && { tnved: normTnved(tnved) }),
                    ...(okpd2.trim() && { okpd2: normOkpd2(okpd2) }),
                    overwrite,
                });
                if (!ok || !data?.success) {
                    const details = data?.error?.details;
                    if (details) setErrors({ tnved: details.tnved?.[0], okpd2: details.okpd2?.[0] });
                    setError(details ? '' : parseError(data, status));
                    break;
                }
                const d = data.data;
                acc.total += d.total; acc.changed += d.changed; acc.unchanged += d.unchanged;
                acc.conflicts.push(...d.conflicts); acc.not_found.push(...d.not_found);
            }
            setResult(acc);
            onDone?.(acc);
        } catch {
            setError('Не удалось сохранить коды');
        } finally {
            setBusy(false);
        }
    };

    const conflictIds = result?.conflicts.map(c => c.product_id) ?? [];

    return (
        <Modal title="Задать коды" subtitle={`Выбрано товаров: ${productIds.length}`} onClose={onClose}
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400">
                        Закрыть
                    </button>
                    {conflictIds.length > 0 && (
                        <button onClick={() => run(true, conflictIds)} disabled={busy}
                            className="px-4 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
                            Перезаписать у {conflictIds.length} товаров
                        </button>
                    )}
                    <button onClick={() => run(false, productIds)} disabled={busy}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                        {busy ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            }>
            <div className="space-y-3">
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                    ТНВЭД
                    <input className={`${inputCls} mt-1 font-mono`} value={tnved} placeholder="8537109800"
                        onChange={e => setTnved(e.target.value)} />
                    {errors.tnved && <span className="text-xs text-red-600 dark:text-red-400">{errors.tnved}</span>}
                </label>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                    ОКПД2
                    <input className={`${inputCls} mt-1 font-mono`} value={okpd2} placeholder="27.12.31.000"
                        onChange={e => setOkpd2(e.target.value)} />
                    {errors.okpd2 && <span className="text-xs text-red-600 dark:text-red-400">{errors.okpd2}</span>}
                </label>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                {result && (
                    <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <p>Изменено: {result.changed}, без изменений: {result.unchanged}.</p>
                        {result.conflicts.length > 0 && (
                            <p className="text-amber-600 dark:text-amber-400">
                                Конфликтов: {result.conflicts.length} — у этих товаров уже стоит другой код, они пропущены.
                            </p>
                        )}
                        {result.not_found.length > 0 && <p>Не найдено или неактивно: {result.not_found.length}.</p>}
                    </div>
                )}
            </div>
        </Modal>
    );
}
