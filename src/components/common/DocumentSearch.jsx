import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mediaApi } from '../../api/media';

/**
 * @param {number}   docTypeId    — id типа документа для поиска
 * @param {Function} onSelect     — колбэк при выборе: (doc) => void
 * @param {string}   [placeholder]
 * @param {string}   [className]
 * @param {string}   [inputClassName]
 */
export default function DocumentSearch({
    docTypeId,
    onSelect,
    placeholder = 'Поиск по external_id...',
    className = '',
    inputClassName = '',
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const inputRef = useRef(null);
    const ref = useRef(null);

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

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!docTypeId || query.length < 2) { setResults([]); setOpen(false); return; }

        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const { ok, data } = await mediaApi.searchDocuments(
                    String(docTypeId), query
                );
                if (ok) {
                    setResults(data.results || []);
                    updateDropdownStyle();
                    setOpen(true);
                }
            } catch { }
            setSearching(false);
        }, 300);

        return () => clearTimeout(t);
    }, [query, docTypeId]);

    const handleSelect = (doc) => {
        onSelect(doc);
        setQuery('');
        setResults([]);
        setOpen(false);
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => {
                    if (results.length > 0) { updateDropdownStyle(); setOpen(true); }
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
                <div style={dropdownStyle}
                    className="bg-white dark:bg-neutral-900
                               border border-gray-200 dark:border-gray-700
                               rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {results.map(doc => (
                        <button key={doc.id} type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelect(doc); }}
                            className="w-full text-left px-3 py-2 text-xs
                                       hover:bg-neutral-50 dark:hover:bg-neutral-800
                                       border-b border-gray-50 dark:border-gray-800
                                       last:border-0">
                            <span className="text-gray-900 dark:text-white font-medium block">
                                {doc.external_id}
                            </span>
                            {doc.name && (
                                <span className="text-gray-400">{doc.name}</span>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}