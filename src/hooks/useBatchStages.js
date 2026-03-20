import { useState, useEffect, useCallback } from 'react';
import { plmApi } from '../api/plm';

/**
 * Загрузка стадий для списка изделий.
 * Возвращает { stagesByProduct, loading, reload }
 * stagesByProduct: { [productId]: stages[] }
 */
export function useBatchStages(productIds) {
    const [stagesByProduct, setStagesByProduct] = useState({});
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!productIds?.length) return;
        setLoading(true);

        const results = await Promise.all(
            productIds.map(id =>
                plmApi.getStages(id).then(({ ok, data }) => ({
                    productId: id,
                    stages: ok && data.success ? data.data : [],
                }))
            )
        );

        const map = {};
        results.forEach(({ productId, stages }) => {
            map[productId] = stages;
        });
        setStagesByProduct(map);
        setLoading(false);
    }, [productIds?.join(',')]);

    useEffect(() => { load(); }, [load]);

    return { stagesByProduct, loading, reload: load };
}

/**
 * Стадии для одного изделия.
 */
export function useProductStages(productId) {
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStage, setSelectedStage] = useState(null);

    const load = useCallback(async () => {
        if (!productId) return;
        setLoading(true);
        const { ok, data } = await plmApi.getStages(productId);
        if (ok && data.success) {
            setStages(data.data);
            // Автовыбор: первая активная стадия
            const active = data.data.find(s => s.status === 'active');
            setSelectedStage(active || data.data[0] || null);
        }
        setLoading(false);
    }, [productId]);

    useEffect(() => { load(); }, [load]);

    return { stages, loading, selectedStage, setSelectedStage, reload: load };
}