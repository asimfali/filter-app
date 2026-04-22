import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tokenStorage } from '../../api/auth';

const API_BASE = '/api/v1/catalog';

export default function ProductSearch({
    onSelect,
    excludeIds = new Set(),
    placeholder = 'Найти изделие...',
    className = '',
    inputClassName = '',
    clearOnSelect = true,
    minChars = 2,
    limit = 15,
    productTypeId = null,
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const inputRef = useRef(null);
    const ref = useRef(null);

    // Позиция дропдауна
    const updateDropdownStyle = () => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
        });
    };

    // Закрытие по клику вне
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Поиск с debounce
    useEffect(() => {
        if (query.length < minChars) { setResults([]); setOpen(false); return; }

        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const params = new URLSearchParams({ q: query, limit });
                if (productTypeId) params.append('product_type', productTypeId);

                const res = await fetch(`${API_BASE}/products/search/?${params}`, {
                    headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
                });
                const data = await res.json();
                if (data.success) {
                    setResults((data.data || []).filter(p => !excludeIds.has(p.id)));
                    updateDropdownStyle();
                    setOpen(true);
                }
            } catch { }
            setSearching(false);
        }, 300);

        return () => clearTimeout(t);
    }, [query, minChars, limit, productTypeId]);

    const handleSelect = (product) => {
        onSelect(product);
        if (clearOnSelect) { setQuery(''); setResults([]); }
        setOpen(false);
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => {
                    if (results.length > 0) {
                        updateDropdownStyle();
                        setOpen(true);
                    }
                }}
                placeholder={placeholder}
                className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg
                           px-3 py-1.5 bg-white dark:bg-neutral-800
                           text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-1 focus:ring-blue-500
                           ${inputClassName}`}
            />
            {searching && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2
                                 text-gray-400 text-xs">···</span>
            )}
            {open && results.length > 0 && createPortal(
                <div
                    style={dropdownStyle}
                    className="bg-white dark:bg-neutral-900
                               border border-gray-200 dark:border-gray-700
                               rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {results.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
                            className="w-full text-left px-3 py-2 text-xs
                                       hover:bg-neutral-50 dark:hover:bg-neutral-800
                                       border-b border-gray-50 dark:border-gray-800
                                       last:border-0 transition-colors">
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