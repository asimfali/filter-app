import { useState, useCallback, useRef } from 'react';
import { catalogApi } from '../api/catalog';

export function useChainSearch(productTypeId, { partial = false } = {}) {
    const [products, setProducts] = useState([]);
    const [count, setCount] = useState(0);
    const [pathsCount, setPathsCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [partialProducts, setPartialProducts] = useState([]);

    // ← ref всегда содержит актуальное значение, без пересоздания search
    const partialRef = useRef(partial);
    partialRef.current = partial;

    const search = useCallback(async (chainValueIds) => {
        if (!chainValueIds.length || !productTypeId) {
            setProducts([]);
            setCount(0);
            setPathsCount(0);
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const { ok, data } = await catalogApi.filterByChain(
                productTypeId,
                chainValueIds,
                partialRef.current,  // ← всегда актуальное значение
            );

            if (!ok || !data.success) {
                setProducts([]);
                setCount(0);
                setError(data?.error || 'Ошибка запроса');
                return null;
            }

            setProducts(data.data.products);
            setCount(data.data.count);
            setPathsCount(data.data.paths_count);
            setPartialProducts(data.data.partial_products || []);
            return data.data;

        } finally {
            setLoading(false);
        }
    }, [productTypeId]); // ← partial убран из deps

    const reset = useCallback(() => {
        setProducts([]);
        setCount(0);
        setPathsCount(0);
        setError(null);
        setPartialProducts([]);
    }, []);

    return { products, partialProducts, count, pathsCount, loading, error, search, reset };
}