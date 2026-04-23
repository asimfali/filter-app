import React, { useState, useEffect, useRef } from 'react';
import { bomApi } from '../../api/bom';
import { catalogApi } from '../../api/catalog';
import { inputCls } from '../../utils/styles';

export default function PullModal({ onClose, onPulled }) {
    const [mode, setMode] = useState('product'); // product | name
    const [value, setValue] = useState('');
    const [selected, setSelected] = useState(null); // выбранный Product из каталога
    const [suggestions, setSuggestions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // Поиск в локальном каталоге
    useEffect(() => {
        if (mode !== 'product') { setSuggestions([]); return; }
        if (value.length < 2) { setSuggestions([]); return; }
        if (selected && selected.name === value) { setSuggestions([]); return; }

        setSearching(true);
        const t = setTimeout(async () => {
            const { ok, data } = await catalogApi.searchProducts(value, { limit: 10 });
            if (ok) setSuggestions(data.data || []);
            setSearching(false);
        }, 250);
        return () => { clearTimeout(t); setSearching(false); };
    }, [value, mode, selected]);

    const handleSelect = (product) => {
        setSelected(product);
        setValue(product.name);
        setSuggestions([]);
    };

    const handlePull = async () => {
        if (!value.trim()) return;
        setLoading(true);
        setError('');
        const payload = mode === 'product'
            ? { product_name: value.trim() }
            : { name: value.trim() };
        const { ok, data } = await bomApi.pullSpec(payload);
        if (ok && data.success) {
            onPulled(data.data);
        } else {
            setError(data.error || 'Ошибка загрузки');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Загрузить спецификацию из 1С
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600
                                   dark:hover:text-gray-300 text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Режим поиска */}
                <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                    {[
                        { id: 'product', label: 'По изделию' },
                        { id: 'name', label: 'По имени спецификации' },
                    ].map(m => (
                        <button key={m.id}
                            onClick={() => {
                                setMode(m.id);
                                setValue('');
                                setSelected(null);
                                setSuggestions([]);
                                setError('');
                            }}
                            className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors
                                ${mode === m.id
                                    ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                            {m.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            value={value}
                            onChange={e => {
                                setValue(e.target.value);
                                setSelected(null);
                                setError('');
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !suggestions.length) handlePull();
                                if (e.key === 'Escape') setSuggestions([]);
                            }}
                            placeholder={mode === 'product' ? 'КЭВ-4П1141Е' : 'КЭВ-4П1141Е(Сборка)'}
                            className={`${inputCls} w-full`}
                            autoFocus
                        />
                        {searching && (
                            <span className="absolute right-3 top-2.5 text-xs
                                             text-gray-400 animate-pulse">···</span>
                        )}
                    </div>

                    {/* Автокомплит из каталога */}
                    {suggestions.length > 0 && (
                        <div className="border border-gray-200 dark:border-gray-700
                                        rounded-lg overflow-hidden divide-y
                                        divide-gray-50 dark:divide-gray-800 max-h-48 overflow-y-auto">
                            {suggestions.map(p => (
                                <button key={p.id} onClick={() => handleSelect(p)}
                                    className="flex items-center justify-between w-full
                                               px-3 py-2 text-left hover:bg-neutral-50
                                               dark:hover:bg-neutral-800 transition-colors">
                                    <span className="text-sm text-gray-900 dark:text-white truncate">
                                        {p.name}
                                    </span>
                                    {p.sku && (
                                        <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">
                                            {p.sku}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800
                                   transition-colors">
                        Отмена
                    </button>
                    <button onClick={handlePull}
                        disabled={loading || !value.trim()}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                   hover:bg-blue-700 text-white
                                   disabled:opacity-50 transition-colors">
                        {loading ? 'Загрузка...' : 'Загрузить'}
                    </button>
                </div>
            </div>
        </div>
    );
}