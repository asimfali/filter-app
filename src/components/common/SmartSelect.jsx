// src/components/common/SmartSelect.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { tokenStorage } from '../../api/auth';

/**
 * Универсальный поиск с выбором, inline-create и умным позиционированием.
 *
 * Props:
 *   endpoint        — URL поиска (?q=... добавляется автоматически)
 *   onSelect        — fn(item) при выборе
 *   renderItem      — fn(item) → JSX строки дропдауна (опционально)
 *   nameKey         — ключ для отображения имени (default: 'name')
 *   placeholder
 *   minChars        — минимум символов для поиска (default: 2)
 *   limit           — лимит результатов (default: 15)
 *   allowCreate     — показывать кнопку «+ Добавить»
 *   createEndpoint  — POST URL для создания
 *   createPayload   — fn(query) → body (default: {name: query})
 *   onCreated       — fn(item) после создания (default: onSelect)
 *   value           — выбранное значение {id, name} — показывает чип
 *   onClear         — fn() сброс значения
 *   className
 */
export default function SmartSelect({
    endpoint,
    onSelect,
    renderItem,
    nameKey = 'name',
    placeholder = 'Поиск...',
    minChars = 2,
    limit = 15,
    allowCreate = false,
    createEndpoint,
    createPayload,
    onCreated,
    value = null,
    onClear,
    className = '',
    excludeIds = null,
    inputClassName = '', 
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [creating, setCreating] = useState(false);
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Закрытие по клику вне + скролл
    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            const isDropdown = e.target?.closest?.('[data-smartselect-dropdown]');
            const isContainer = containerRef.current?.contains(e.target);
            if (!isDropdown && !isContainer) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('wheel', close, true);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('wheel', close, true);
        };
    }, [open]);

    // Поиск с debounce
    useEffect(() => {
        if (query.length < minChars) { setResults([]); setOpen(false); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(
                    `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}&limit=${limit}`,
                    { headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` } }
                );
                const data = await res.json();
                if (data.success) {
                    setResults((data.data || []).filter(
                        item => !excludeIds || !excludeIds.has(item.id)
                    ));
                    setOpen(true);
                }
            } catch { }
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [query, endpoint, minChars, limit]);

    const handleSelect = (item) => {
        onSelect(item);
        setQuery('');
        setResults([]);
        setOpen(false);
    };

    const handleCreate = async () => {
        if (!createEndpoint || !query.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(createEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenStorage.getAccess()}`,
                },
                body: JSON.stringify(
                    createPayload ? createPayload(query) : { name: query }
                ),
            });
            const data = await res.json();
            if (data.success) {
                (onCreated || onSelect)(data.data);
                setQuery('');
                setResults([]);
                setOpen(false);
            }
        } catch { }
        setCreating(false);
    };

    const showCreate = allowCreate && query.length >= minChars && !searching;

    // Чип выбранного значения
    if (value) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <span className="flex-1 px-3 py-1.5 text-sm rounded-lg truncate
                                 bg-blue-50 dark:bg-blue-900/30
                                 text-blue-900 dark:text-blue-100
                                 border border-blue-200 dark:border-blue-700">
                    {value[nameKey] ?? value.name}
                </span>
                {onClear && (
                    <button type="button" onClick={onClear}
                        className="text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-200 text-lg leading-none shrink-0">
                        ×
                    </button>
                )}
            </div>
        );
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => { if (results.length > 0) setOpen(true); }}
                placeholder={placeholder}
                className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg
                    px-3 py-1.5 text-sm bg-white dark:bg-neutral-800
                    text-gray-900 dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-1 focus:ring-blue-500
                    ${inputClassName}`}
            />
            {searching && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2
                                 text-gray-400 text-xs pointer-events-none">···</span>
            )}
            {open && (results.length > 0 || showCreate) && (
                <SmartDropdown
                    anchorRef={inputRef}
                    results={results}
                    showCreate={showCreate}
                    creating={creating}
                    query={query}
                    nameKey={nameKey}
                    renderItem={renderItem}
                    onSelect={handleSelect}
                    onCreate={handleCreate}
                />
            )}
        </div>
    );
}

// ── Дропдаун с умным позиционированием ───────────────────────────────────────

function SmartDropdown({
    anchorRef,
    results,
    showCreate,
    creating,
    query,
    nameKey,
    renderItem,
    onSelect,
    onCreate,
}) {
    const [style, setStyle] = useState({ opacity: 0 });
    const dropdownRef = useRef(null);

    useLayoutEffect(() => {
        if (!anchorRef.current || !dropdownRef.current) return;

        const anchor = anchorRef.current.getBoundingClientRect();
        const dropH = dropdownRef.current.offsetHeight;
        const vh = window.innerHeight;

        const spaceBelow = vh - anchor.bottom;
        const spaceAbove = anchor.top;

        const top = (spaceBelow < dropH + 8 && spaceAbove > spaceBelow)
            ? anchor.top - dropH - 4
            : anchor.bottom + 4;

        setStyle({
            position: 'fixed',
            top,
            left: anchor.left,
            width: anchor.width,
            zIndex: 9999,
            opacity: 1,
        });
    }, [anchorRef, results, showCreate]);

    return createPortal(
        <div
            ref={dropdownRef}
            style={style}
            data-smartselect-dropdown="true"
            className="bg-white dark:bg-neutral-900
                       border border-gray-200 dark:border-gray-700
                       rounded-lg shadow-xl max-h-56 overflow-y-auto
                       transition-opacity duration-75">
            {results.map(item => (
                <button
                    key={item.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); onSelect(item); }}
                    className="w-full text-left px-3 py-2 text-xs
                               hover:bg-neutral-50 dark:hover:bg-neutral-800
                               border-b border-gray-50 dark:border-gray-800
                               last:border-0 transition-colors">
                    {renderItem ? renderItem(item) : (
                        <span className="text-gray-900 dark:text-white font-medium block truncate">
                            {item[nameKey] ?? item.name}
                        </span>
                    )}
                </button>
            ))}
            {showCreate && (
                <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); onCreate(); }}
                    disabled={creating}
                    className="w-full text-left px-3 py-2 text-xs
                               text-blue-600 dark:text-blue-400
                               hover:bg-blue-50 dark:hover:bg-blue-900/20
                               border-t border-gray-100 dark:border-gray-800
                               transition-colors disabled:opacity-50">
                    {creating ? 'Создание...' : `+ Добавить «${query}»`}
                </button>
            )}
        </div>,
        document.body
    );
}