import { useState, useEffect } from 'react';
import { selectionApi } from '../../api/selection';

export default function SelectionConfigModal({ open, onClose, onSaved }) {
    const [config, setConfig] = useState({ excluded_designs: [], excluded_series: [] });
    const [allDesigns, setAllDesigns] = useState([]);
    const [allSeries, setAllSeries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        Promise.all([
            selectionApi.getConfig(),
            selectionApi.allOptions(),
        ]).then(([cfgRes, optsRes]) => {
            if (cfgRes.ok && cfgRes.data.success) setConfig(cfgRes.data.data);
            if (optsRes.ok && optsRes.data.success) {
                setAllDesigns(optsRes.data.data.all_designs);
                setAllSeries(optsRes.data.data.all_series);
            }
            setLoading(false);
        });
    }, [open]);

    const toggleDesign = (d) => setConfig(prev => ({
        ...prev,
        excluded_designs: prev.excluded_designs.includes(d)
            ? prev.excluded_designs.filter(x => x !== d)
            : [...prev.excluded_designs, d],
    }));

    const toggleSeries = (s) => setConfig(prev => ({
        ...prev,
        excluded_series: prev.excluded_series.includes(s)
            ? prev.excluded_series.filter(x => x !== s)
            : [...prev.excluded_series, s],
    }));

    const handleSave = async () => {
        setSaving(true);
        const { ok } = await selectionApi.updateConfig(config);
        setSaving(false);
        if (ok) { onSaved?.(); onClose(); }
    };

    if (!open) return null;

    const btnBase = "px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer";
    const btnActive = `${btnBase} border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400`;
    const btnInactive = `${btnBase} border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400`;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}>
                <div className="w-full max-w-lg bg-white dark:bg-neutral-900
                    rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700
                    flex flex-col max-h-[80vh]"
                    onClick={e => e.stopPropagation()}>

                    {/* Шапка */}
                    <div className="flex items-center justify-between px-5 py-4
                        border-b border-gray-200 dark:border-gray-700 shrink-0">
                        <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Настройки подбора
                            </span>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                Исключённые позиции не участвуют в расчёте
                            </p>
                        </div>
                        <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                            ×
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-xs
                            text-gray-400 animate-pulse">
                            Загрузка...
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                            {/* Серии */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide">
                                    Исключить серии
                                    {config.excluded_series.length > 0 && (
                                        <span className="ml-2 text-red-500 normal-case tracking-normal">
                                            ({config.excluded_series.length} выбрано)
                                        </span>
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {allSeries.map(s => (
                                        <button key={s} type="button"
                                            onClick={() => toggleSeries(s)}
                                            className={config.excluded_series.includes(s)
                                                ? btnActive : btnInactive}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Дизайны */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide">
                                    Исключить дизайны
                                    {config.excluded_designs.length > 0 && (
                                        <span className="ml-2 text-red-500 normal-case tracking-normal">
                                            ({config.excluded_designs.length} выбрано)
                                        </span>
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {allDesigns.map(d => (
                                        <button key={d} type="button"
                                            onClick={() => toggleDesign(d)}
                                            className={config.excluded_designs.includes(d)
                                                ? btnActive : btnInactive}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Футер */}
                    <div className="flex gap-3 px-5 py-4
                        border-t border-gray-200 dark:border-gray-700 shrink-0">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-gray-200
                                dark:border-gray-700 text-sm text-gray-600
                                dark:text-gray-400 hover:border-gray-400 transition-colors">
                            Отмена
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                                disabled:opacity-50 text-white text-sm font-semibold
                                transition-colors">
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}