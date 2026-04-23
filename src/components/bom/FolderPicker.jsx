import React, { useState, useEffect, useRef } from 'react';
import { bomApi } from '../../api/bom';
import Dropdown from '../common/Dropdown';

export default function FolderPicker({ value, onChange, folderType = 'nomenclature', rootPath = '' }) {
    const [query, setQuery] = useState(value?.path || '');
    const [results, setResults] = useState([]);
    const [allFolders, setAllFolders] = useState([]);  // ← кэш для spec
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const handleEvent = (e) => {
            // e.target может быть window/document при scroll — у них нет closest
            if (!e.target || typeof e.target.closest !== 'function') return;

            const isInsideDropdown = e.target.closest('[data-dropdown="true"]');
            const isInsideInput = containerRef.current?.contains(e.target);

            if (!isInsideDropdown && !isInsideInput) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleEvent);
        window.addEventListener('scroll', handleEvent, true);
        window.addEventListener('wheel', handleEvent, true);

        return () => {
            document.removeEventListener('mousedown', handleEvent);
            window.removeEventListener('scroll', handleEvent, true);
            window.removeEventListener('wheel', handleEvent, true);
        };
    }, [open]);

    // Для spec — загрузить все папки один раз при монтировании
    useEffect(() => {
        if (folderType !== 'spec') return;
        bomApi.getFolders('spec').then(({ ok, data }) => {
            if (ok && data.success) {
                const folders = rootPath
                    ? data.data.filter(f => f.path.toLowerCase().startsWith(rootPath.toLowerCase()))
                    : data.data;
                setAllFolders(folders);
            }
        });
    }, [folderType, rootPath]);

    // Хлебные крошки из текущего query
    const breadcrumbs = query.trim()
        ? query.trim().split(' / ').filter(Boolean)
        : [];

    const handleSearch = async (q) => {
        setQuery(q);
        setCreated(false);
        setOpen(true); // Открываем список при вводе // <---

        if (folderType === 'spec') {
            if (q.trim().length < 1) {
                setResults(allFolders.slice(0, 30)); // Показываем корень если пусто // <---
                return;
            }
            setResults(
                allFolders
                    .filter(f => f.path.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 30)
            );
            return;
        }

        const effectiveRoot = folderType === 'manufacture' ? "ПРОИЗВОДСТВО" : rootPath;

        if (q.trim().length < 2) { setResults([]); return; }
        const { ok, data } = await bomApi.searchFolders(folderType, q.trim(), effectiveRoot);
        if (ok && data.success) setResults(data.data);
    };

    const handleSelect = (folder) => {
        setQuery(folder.path);
        setResults([]);
        setOpen(false); // Закрываем при выборе // <---
        onChange(folder);
    };

    // Клик по части пути — подставляет путь до этой части
    const handleBreadcrumbClick = (idx) => {
        const newPath = breadcrumbs.slice(0, idx + 1).join(' / ');
        setQuery(newPath);
        setResults([]);
        // Не вызываем onChange — пользователь ещё не выбрал, просто навигирует
    };

    const handleCreate = async () => {
        if (!query.trim()) return;
        setCreating(true);
        const parts = query.trim().split(/\s*\/\s*/).filter(Boolean);
        const name = parts[parts.length - 1].trim();
        const parentPath = parts.slice(0, -1).join(' / ').trim();

        // Ищем parent_code по parentPath в результатах поиска
        let parentCode = '';
        if (parentPath) {
            const { ok, data } = await bomApi.searchFolders('nomenclature', parentPath);
            if (ok && data.success) {
                const found = data.data.find(f => f.path === parentPath);
                parentCode = found?.onec_code || '';
            }
        }

        const { ok, data } = await bomApi.createFolder({
            name,
            parent_path: parentPath,
            parent_code: parentCode,
            folder_type: folderType,  // ← передаём тип
        });

        if (ok && data.success) {
            const folder = data.data;
            setQuery(folder.path);
            setCreated(true);
            onChange(folder);
            setResults([]);
            if (folderType === 'spec') {
                setAllFolders(prev => [...prev, folder]);
            }
        }
        setCreating(false);
    };

    const handleFocus = () => {
        // Для spec — показать все при фокусе если query пустой
        if (folderType === 'spec' && !query.trim()) {
            setResults(allFolders.slice(0, 30));
        }
    };

    return (
        <div className="space-y-2" ref={containerRef}>
            {/* Хлебные крошки */}
            {breadcrumbs.length > 0 && (
                <div className="flex items-center flex-wrap gap-0.5 text-xs">
                    {breadcrumbs.map((part, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && (
                                <span className="text-gray-400 px-0.5">/</span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleBreadcrumbClick(idx)}
                                className={`px-1.5 py-0.5 rounded hover:bg-blue-50
                                           dark:hover:bg-blue-900/20 transition-colors
                                           ${idx === breadcrumbs.length - 1
                                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600'
                                    }`}>
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Поиск */}
            <div className="relative">
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={handleFocus}
                    placeholder="Введите 2+ символа для поиска или полный путь для создания"
                    className="w-full px-3 py-1.5 text-sm rounded-lg
                               bg-neutral-50 dark:bg-neutral-800
                               border border-gray-200 dark:border-gray-700
                               text-gray-900 dark:text-white
                               focus:outline-none focus:border-blue-500"
                />
                {open && results.length > 0 && (
                    <Dropdown
                        anchorRef={inputRef}
                        items={results}
                        onSelect={handleSelect}
                        renderItem={f => (
                            <div className="text-gray-900 dark:text-white text-xs">{f.path}</div>
                        )}
                    />
                )}
            </div>

            {/* Создать папку */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                    Нет нужной папки? Введите полный путь и нажмите «Создать»
                </span>
                <button
                    onClick={handleCreate}
                    disabled={creating || !query.trim() || created}
                    className="px-3 py-1 text-xs rounded-lg
                               bg-emerald-600 hover:bg-emerald-700
                               text-white disabled:opacity-50 transition-colors">
                    {creating ? '...' : '+ Создать папку'}
                </button>
            </div>
        </div>
    );
}