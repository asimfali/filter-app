// src/hooks/useMultiSelect.js
import { useState, useRef } from 'react';

export function useMultiSelect(items) {
    const [selected, setSelected] = useState(new Set());
    const lastClickedIdx = useRef(null);

    const handleClick = (e, itemId, idx) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (e.shiftKey && lastClickedIdx.current !== null) {
                const from = Math.min(lastClickedIdx.current, idx);
                const to = Math.max(lastClickedIdx.current, idx);
                for (let i = from; i <= to; i++) {
                    next.add(items[i].id);
                }
            } else if (e.ctrlKey || e.metaKey) {
                next.has(itemId) ? next.delete(itemId) : next.add(itemId);
            } else {
                if (next.has(itemId) && next.size === 1) next.clear();
                else { next.clear(); next.add(itemId); }
            }
            return next;
        });
        lastClickedIdx.current = idx;
    };

    const selectAll = () => setSelected(new Set(items.map(i => i.id)));
    const clearAll = () => setSelected(new Set());
    const toggle = (itemId) => setSelected(prev => {
        const next = new Set(prev);
        next.has(itemId) ? next.delete(itemId) : next.add(itemId);
        return next;
    });

    return { selected, setSelected, handleClick, selectAll, clearAll, toggle };
}