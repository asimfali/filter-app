import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Dropdown({ anchorRef, items, onSelect, renderItem }) {
    const [style, setStyle] = useState({ opacity: 0 });
    const dropdownRef = useRef(null);

    useLayoutEffect(() => {
        if (!anchorRef.current || !dropdownRef.current) return;

        const anchorRect = anchorRef.current.getBoundingClientRect();
        const dropdownHeight = dropdownRef.current.offsetHeight;
        const viewportHeight = window.innerHeight;

        const spaceBelow = viewportHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;

        const top = (spaceBelow < dropdownHeight + 20 && spaceAbove > spaceBelow)
            ? anchorRect.top - dropdownHeight - 4
            : anchorRect.bottom + 4;

        setStyle({
            position: 'fixed',
            top,
            left: anchorRect.left,
            width: anchorRect.width,
            zIndex: 9999,
            opacity: 1,
        });
    }, [anchorRef, items]);

    if (!items.length) return null;

    return createPortal(
        <div
            ref={dropdownRef}
            style={style}
            data-dropdown="true"
            className="bg-white dark:bg-neutral-900
                       border border-gray-200 dark:border-gray-700
                       rounded-lg shadow-xl max-h-48 overflow-y-auto
                       transition-opacity duration-75">
            {items.map((item, i) => (
                <button key={i}
                    onMouseDown={e => { e.preventDefault(); onSelect(item); }}
                    className="w-full text-left px-3 py-2 text-xs
                               hover:bg-neutral-50 dark:hover:bg-neutral-800
                               border-b border-gray-50 dark:border-gray-800 last:border-0">
                    {renderItem(item)}
                </button>
            ))}
        </div>,
        document.body
    );
}