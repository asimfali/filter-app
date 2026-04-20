import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mediaApi } from '../../api/media';

function DirectProductsPanel({ entityId, entityType, canWrite }) {
    const [open, setOpen] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(null);
    const [dropdownStyle, setDropdownStyle] = useState({});

    const inputRef = useRef(null);

    // Позиция дропдауна
    useEffect(() => {
        if (suggestions.length > 0 && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            });
        }
    }, [suggestions]);

    // Загрузка привязок при открытии
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        const req = entityType === 'heat-exchanger'
            ? mediaApi.addProductsToHeatExchanger(entityId, [product.id])
            : entityType === 'accessory-kit'
                ? mediaApi.addProductsToAccessoryKit(entityId, [product.id])
                : mediaApi.addProductsToDocument(entityId, [product.id]);
        req
            .then(({ ok, data }) => { if (ok) setProducts(data.products || []); })
            .finally(() => setLoading(false));
    }, [open, entityId, entityType]);

    // Поиск с дебаунсом
    useEffect(() => {
        if (query.length < 2) { setSuggestions([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(
                    `/api/v1/catalog/products/search/?q=${encodeURIComponent(query)}&limit=10`,
                    { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
                );
                const data = await res.json();
                if (data.success) {
                    const attachedIds = new Set(products.map(p => p.id));
                    setSuggestions(data.data.filter(p => !attachedIds.has(p.id)));
                }
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query, products]);

    // Закрытие дропдауна по клику вне
    useEffect(() => {
        if (!suggestions.length) return;
        const handler = (e) => {
            if (!inputRef.current?.contains(e.target)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [suggestions]);

    const handleAdd = async (product) => {
        setAdding(product.id);
        setSuggestions([]);
        setQuery('');
        const req = entityType === 'heat-exchanger'
            ? mediaApi.removeProductsFromHeatExchanger(entityId, [productId])
            : entityType === 'accessory-kit'
                ? mediaApi.removeProductsFromAccessoryKit(entityId, [productId])
                : mediaApi.removeProductsFromDocument(entityId, [productId]);
        const { ok } = await req;
        if (ok) setProducts(prev => [...prev, product]);
        setAdding(null);
    };

    const handleRemove = async (productId) => {
        setRemovingId(productId);
        const req = entityType === 'heat-exchanger'
            ? mediaApi.getHeatExchangerProducts(entityId)
            : entityType === 'accessory-kit'
                ? mediaApi.getAccessoryKitProducts(entityId)
                : mediaApi.getDocumentProducts(entityId);
        const { ok } = await req;
        if (ok) setProducts(prev => prev.filter(p => p.id !== productId));
        setRemovingId(null);
    };

    return (
        <div className="border-t border-gray-100 dark:border-gray-700">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-5 py-2.5
                           hover:bg-neutral-50 dark:hover:bg-neutral-800/50
                           transition-colors text-left"
            >
                <svg className={`w-3 h-3 text-gray-400 shrink-0 transition-transform
                                 ${open ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Прямые привязки к изделиям
                </span>
                {products.length > 0 && !open && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        ({products.length})
                    </span>
                )}
            </button>

            {open && (
                <div className="px-5 pb-3 bg-neutral-50 dark:bg-neutral-800/30">
                    {loading ? (
                        <p className="text-xs text-gray-400 py-2">Загрузка...</p>
                    ) : (
                        <>
                            {products.length > 0 ? (
                                <div className="space-y-1 mb-2">
                                    {products.map(p => (
                                        <div key={p.id}
                                            className="flex items-center justify-between
                                                       px-3 py-1.5 rounded-lg
                                                       bg-white dark:bg-neutral-900
                                                       border border-gray-200 dark:border-gray-700">
                                            <div className="text-xs min-w-0">
                                                <span className="text-gray-800 dark:text-gray-200
                                                                 font-medium truncate block">
                                                    {p.name}
                                                </span>
                                                {p.external_id && (
                                                    <span className="text-gray-400 font-mono">
                                                        {p.external_id}
                                                    </span>
                                                )}
                                            </div>
                                            {canWrite && (
                                                <button
                                                    onClick={() => handleRemove(p.id)}
                                                    disabled={removingId === p.id}
                                                    className="text-gray-300 hover:text-red-500
                                                               transition-colors ml-3 text-xs
                                                               shrink-0 disabled:opacity-50">
                                                    {removingId === p.id ? '···' : '×'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 pt-1">
                                    Прямых привязок нет
                                </p>
                            )}

                            {canWrite && (
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Найти изделие..."
                                        className="w-full border border-gray-200 dark:border-gray-600
                                                   rounded-lg px-3 py-1.5 text-xs
                                                   bg-white dark:bg-neutral-900
                                                   text-gray-900 dark:text-white
                                                   placeholder-gray-400 dark:placeholder-gray-500
                                                   focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {searching && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2
                                                         text-gray-400 text-xs">···</span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Дропдаун через портал — вне любых overflow:hidden */}
            {suggestions.length > 0 && createPortal(
                <div
                    style={dropdownStyle}
                    className="bg-white dark:bg-neutral-900
                               border border-gray-200 dark:border-gray-700
                               rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {suggestions.map(p => (
                        <button
                            key={p.id}
                            onMouseDown={e => { e.preventDefault(); handleAdd(p); }}
                            disabled={adding === p.id}
                            className="w-full text-left px-3 py-2 text-xs
                                       hover:bg-neutral-50 dark:hover:bg-neutral-800
                                       border-b border-gray-50 dark:border-gray-800
                                       last:border-0 transition-colors disabled:opacity-50">
                            <span className="text-gray-900 dark:text-white
                                             font-medium block truncate">
                                {p.name}
                            </span>
                            {p.sku && (
                                <span className="text-gray-400 font-mono">{p.sku}</span>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

export default DirectProductsPanel;