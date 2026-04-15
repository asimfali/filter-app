import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

function buildDefault(axes, defs, docTypes) {
    return [
        ...axes.map(a => ({ type: 'axis', id: String(a.id), label: a.name, visible: true })),
        ...defs.map(d => ({ type: 'spec', id: String(d.id), label: d.display_name, visible: true })),
        ...docTypes.map(d => ({ type: 'docs', id: d.code, label: d.name, visible: true })),
    ];
}

function mergeWithPrefs(defaults, saved) {
    if (!saved?.length) return defaults.map((c, i) => ({ ...c, order: i }));
    const savedMap = Object.fromEntries(saved.map(s => [s.type + ':' + s.id, s]));
    const merged = defaults.map(col => {
        const key = col.type + ':' + col.id;
        const pref = savedMap[key];
        return pref
            ? { ...col, visible: pref.visible, order: pref.order }
            : { ...col, visible: true, order: 9999 };
    });
    return merged.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
}

/**
 * Управление порядком и видимостью колонок таблицы.
 *
 * columns: [{ type: 'axis'|'spec'|'docs', id: string, label: string, visible: bool, order: number }]
 *
 * Порядок из prefs применяется к динамическим колонкам из API.
 * Новые колонки (которых нет в prefs) добавляются в конец видимыми.
 */
export function useColumnPrefs(tableKey, rawAxes, rawDefinitions, rawDocTypes) {
    const [columns, setColumns] = useState(() =>
        buildDefault(rawAxes, rawDefinitions, rawDocTypes).map((c, i) => ({ ...c, order: i }))
    );
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const defaults = buildDefault(rawAxes, rawDefinitions, rawDocTypes);
        if (!defaults.length) return;

        authApi.getPreferences().then(({ ok, data }) => {
            if (ok && data.success) {
                const saved = data.data.table_column_prefs?.[tableKey]?.columns;
                setColumns(mergeWithPrefs(defaults, saved));
            } else {
                setColumns(defaults.map((c, i) => ({ ...c, order: i })));
            }
            setLoaded(true);
        });
    }, [rawAxes.length, rawDefinitions.length, rawDocTypes.length]);

    useEffect(() => {
        const defaults = buildDefault(rawAxes, rawDefinitions, rawDocTypes);
        if (!defaults.length) return;
        // Если prefs уже загружены — мержим с новыми данными
        if (loaded) {
            setColumns(prev => mergeWithPrefs(defaults, prev));
            return;
        }
        setColumns(defaults.map((c, i) => ({ ...c, order: i })));
    }, [rawAxes.length, rawDefinitions.length, rawDocTypes.length]);

    const save = useCallback(async (newColumns) => {
        setColumns(newColumns);
        await authApi.saveColumnPrefs(tableKey, newColumns);
    }, [tableKey]);

    const toggle = useCallback((type, id) => {
        const next = columns.map(c =>
            c.type === type && c.id === id ? { ...c, visible: !c.visible } : c
        );
        save(next);
    }, [columns, save]);

    const reorder = useCallback((fromIdx, toIdx) => {
        const next = [...columns];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        save(next.map((c, i) => ({ ...c, order: i })));
    }, [columns, save]);

    return { columns, loaded, toggle, reorder };
}