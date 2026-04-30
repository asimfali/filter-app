import React, { useState, useEffect, useRef } from 'react';
import { bomApi } from '../../api/bom';
import Dropdown from '../common/Dropdown';
import { inputCls } from "../../utils/styles";
import { IconStar } from '../common/Icons';

export default function MaterialCombobox({ row, idx, canWrite, onSelect, matRefs }) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null); // Реф для контейнера инпута

    const context = row.in_process ? 'detail' : 'assembly';

    // Закрытие по клику вне инпута и вне выпадающего списка
    useEffect(() => {
        if (!open) return;

        // Универсальная функция закрытия
        const closeDropdown = (e) => {
            // Проверяем, не является ли целью клика/скролла сам выпадающий список
            // Используем селектор атрибута, который мы добавили в Dropdown
            const isInsideDropdown = e.target.closest('[data-dropdown="true"]');
            const isInsideInput = containerRef.current && containerRef.current.contains(e.target);

            if (!isInsideDropdown && !isInsideInput) {
                setOpen(false);
            }
        };

        // 1. Клик вне области
        document.addEventListener('mousedown', closeDropdown);

        // 2. Скролл (обязательно с true в конце, чтобы поймать событие на любом уровне)
        window.addEventListener('scroll', closeDropdown, true);

        // 3. Колесо мыши (часто работает лучше чем scroll в браузерах)
        window.addEventListener('wheel', closeDropdown, true);

        // 4. Тач-события для мобильных
        window.addEventListener('touchmove', closeDropdown, true);

        return () => {
            document.removeEventListener('mousedown', closeDropdown);
            window.removeEventListener('scroll', closeDropdown, true);
            window.removeEventListener('wheel', closeDropdown, true);
            window.removeEventListener('touchmove', closeDropdown, true);
        };
    }, [open]);

    const handleFocus = async () => {
        setOpen(true);
        if (options.length) return;
        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            '',
            context,
        );
        if (ok && data.success) setOptions(data.data);
        setLoading(false);
    };

    const handleChange = async (q) => {
        setQuery(q);
        setOpen(true);
        if (q.length < 2) return;  // ← убрать ранний return, всегда запрашиваем

        setLoading(true);
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            q,
            context,
        );
        if (ok && data.success) setOptions(data.data);  // ← обновляем options
        setLoading(false);
    };

    const handleSelect = (part) => {
        onSelect(idx, part);
        bomApi.trackPartUse(part.id);
        setQuery('');
        setOpen(false);
    };

    const filtered = options;

    const displayValue = query !== '' ? query : (row.source_material_name || '');

    if (inputRef.current && !matRefs.current[idx]) {
        matRefs.current[idx] = inputRef.current;
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    value={displayValue}
                    onChange={e => handleChange(e.target.value)}
                    onFocus={handleFocus}
                    // onBlur={handleBlur} <-- УДАЛЯЕМ ЭТО
                    disabled={!canWrite}
                    placeholder="Выберите материал..."
                    className={`${inputCls} pr-7 ${row.thickness && !row.source_material_id
                        ? 'border-amber-400'
                        : ''
                        }`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">
                    ▾
                </span>
            </div>

            {open && (
                <Dropdown
                    anchorRef={inputRef}
                    items={loading ? [{ id: '__loading__', onec_name: 'Загрузка...' }] : filtered}
                    onSelect={part => part.id !== '__loading__' && handleSelect(part)}
                    renderItem={part => part.id === '__loading__'
                        ? <span className="text-gray-400 italic">Загрузка...</span>
                        : (
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-gray-900 dark:text-white truncate">{part.onec_name}</div>
                                    {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                                </div>
                                <button
                                    onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        bomApi.togglePriority(part.id).then(() => {
                                            // Обновляем priority локально без перезапроса
                                            setOptions(opts => opts.map(o =>
                                                o.id === part.id
                                                    ? { ...o, priority: o.priority > 0 ? 0 : 10 }
                                                    : o
                                            ));
                                        });
                                    }}
                                    className="shrink-0 text-base leading-none transition-colors"
                                    title={part.priority > 0 ? 'Убрать из избранного' : 'В избранное'}
                                >
                                    {part.priority > 0 ? <IconStar className="w-3 h-3 text-yellow-400" /> : '☆'}
                                </button>
                            </div>
                        )
                    }
                />
            )}
        </div>
    );
}