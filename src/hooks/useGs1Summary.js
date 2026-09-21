import { useState, useEffect, useCallback } from 'react';
import { externalApi } from '../api/external';

const EVENT = 'gs1-summary-changed';

// Страница ГС1 дёргает это после разбора/запуска, чтобы бейдж в Header и вкладки обновились.
export const notifyGs1SummaryChanged = () => window.dispatchEvent(new Event(EVENT));

// Сводка очереди ГС1 ({by_status, conflicts_by_reason, last_run}); refreshKey — любое значение,
// смена которого перезапрашивает сводку (например, текущая страница приложения).
export default function useGs1Summary(enabled, refreshKey) {
    const [summary, setSummary] = useState(null);

    const load = useCallback(async () => {
        try {
            const { ok, data } = await externalApi.getGs1Summary();
            if (ok && data?.success) setSummary(data.data);
        } catch { /* бейдж — второстепенный, ошибку не показываем */ }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        load();
        window.addEventListener(EVENT, load);
        return () => window.removeEventListener(EVENT, load);
    }, [enabled, refreshKey, load]);

    return enabled ? summary : null;
}
