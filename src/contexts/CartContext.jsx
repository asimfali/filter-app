import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { salesApi } from '../api/sales';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [activeCartId, setActiveCartId] = useState(() => {
        const saved = localStorage.getItem('activeCartId');
        return saved ? parseInt(saved) : null;
    });
    const [carts, setCarts] = useState([]);
    const [cartsNext, setCartsNext] = useState(null);
    const [cartsLoading, setCartsLoading] = useState(false);
    const [cartsSearch, setCartsSearch] = useState('');
    // ← были потеряны:
    const [itemsCount, setItemsCount] = useState(0);

    const loadCarts = useCallback(async (search = '', replace = true) => {
        setCartsLoading(true);
        const { ok, data } = await salesApi.listCarts({ search, page: 1 });
        if (ok) {
            const list = data.results ?? [];
            setCarts(replace ? list : prev => [...prev, ...list]);
            setCartsNext(data.next ?? null);
            // Обновляем счётчик активной корзины
            if (activeCartId) {
                const active = list.find(c => c.id === activeCartId);
                if (active) setItemsCount(active.items_count ?? 0);
            }
        }
        setCartsLoading(false);
    }, [activeCartId]);

    const loadMoreCarts = useCallback(async () => {
        if (!cartsNext || cartsLoading) return;
        setCartsLoading(true);
        const { ok, data } = await salesApi.listCartsUrl(cartsNext);
        if (ok) {
            setCarts(prev => [...prev, ...(data.results ?? [])]);
            setCartsNext(data.next ?? null);
        }
        setCartsLoading(false);
    }, [cartsNext, cartsLoading]);

    const searchCarts = useCallback(async (q) => {
        setCartsSearch(q);
        await loadCarts(q, true);
    }, [loadCarts]);

    useEffect(() => {
        loadCarts();
    }, []);

    const selectCart = useCallback((cartId) => {
        setActiveCartId(cartId);
        if (cartId) {
            localStorage.setItem('activeCartId', cartId);
            const cart = carts.find(c => c.id === cartId);
            setItemsCount(cart?.items_count ?? 0);
        } else {
            localStorage.removeItem('activeCartId');
            setItemsCount(0);
        }
    }, [carts]);

    const createCart = useCallback(async (data) => {
        const { ok, data: cart } = await salesApi.createCart(data);
        if (ok) {
            await loadCarts();
            selectCart(cart.id);
        }
        return { ok, cart };
    }, [loadCarts, selectCart]);

    const addToCart = useCallback(async (productId, quantity = 1) => {
        if (!activeCartId) return { ok: false, error: 'Нет активной корзины' };
        const { ok, data } = await salesApi.addItem(activeCartId, { product: productId, quantity });
        if (ok) {
            setItemsCount(prev => data.data?.created ? prev + 1 : prev);
            await loadCarts();
        }
        return { ok, data };
    }, [activeCartId, loadCarts]);

    const refreshCount = useCallback(async () => {
        if (!activeCartId) return;
        const { ok, data } = await salesApi.getCart(activeCartId);
        if (ok) {
            setItemsCount(data.items?.length ?? 0);
        }
    }, [activeCartId]);

    return (
        <CartContext.Provider value={{
            carts,
            activeCartId,
            itemsCount,
            cartsNext,
            cartsLoading,
            cartsSearch,
            loadCarts,
            loadMoreCarts,
            searchCarts,
            selectCart,
            createCart,
            addToCart,
            refreshCount,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within CartProvider');
    return ctx;
}