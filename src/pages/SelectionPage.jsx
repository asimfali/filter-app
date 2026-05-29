import { useState, useEffect, useCallback, useRef } from 'react';
import { selectionApi } from '../api/selection';
import SmartSelect from '../components/common/SmartSelect';
import { useAuth } from '../contexts/AuthContext';

// ── Константы ─────────────────────────────────────────────────────────────────

const INSTALL_TYPES = [
    { value: 'V', label: 'Верхняя' },
    { value: 'BO', label: 'Боковая одностор.' },
    { value: 'BD', label: 'Боковая двустор.' },
];

const TSM_OPTIONS = [0, 5, 12, 18];
const TPR_OPTIONS = [60, 80, 95, 105, 130, 150];

const EMPTY_FORM = {
    heat_type: 'E',
    install_type: 'V',
    ip: 21,
    h: '',
    b: '',
    tn: '',
    tv: 10,
    V: '',
    tsm: 5,
    Tpr: 95,
    optimize: false,
};

// ── Хук загрузки данных формы ────────────────────────────────────────────────

function useFormData() {
    const [heatingValues, setHeatingValues] = useState([]);
    const [ipValues, setIpValues] = useState([]);
    const [standardOpenings, setStandardOpenings] = useState([]);

    useEffect(() => {
        selectionApi.formData().then(({ ok, data }) => {
            if (ok && data.success) {
                setHeatingValues(data.data.heating_values || []);
                setIpValues(data.data.ip_values || []);
                setStandardOpenings(data.data.standard_openings || []);
            }
        });
    }, []);

    return { heatingValues, ipValues, standardOpenings };
}

// ── Компонент поля числа ─────────────────────────────────────────────────────

function NumberField({ label, value, onChange, ...rest }) {
    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg " +
        "px-3 py-2 text-sm bg-white dark:bg-neutral-800 " +
        "text-gray-900 dark:text-white " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500 " +
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none " +
        "[&::-webkit-inner-spin-button]:appearance-none";
    return (
        <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
            <input
                type="number"
                value={value}
                onChange={e => onChange(e.target.value)}
                className={inp}
                {...rest}
            />
        </label>
    );
}

// ── Карточка результата ───────────────────────────────────────────────────────

function CombinationRow({ combo, index, selected, onSelect }) {
    const tsmColor = combo.tsm >= 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-500 dark:text-red-400';

    return (
        <label className={`block rounded-lg border p-4 space-y-3 cursor-pointer transition-colors
            ${selected
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <input type="radio" checked={selected} onChange={onSelect}
                        className="accent-blue-600" />
                    Вариант {index + 1}
                </span>
                <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                        Угол: <strong className="text-gray-900 dark:text-white">{combo.angle}°</strong>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                        T выход: <strong className="text-gray-900 dark:text-white">
                            {combo.Tz > 0 ? '+' : ''}{combo.Tz}°C</strong>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                        T смеси: <strong className={tsmColor}>
                            {combo.tsm > 0 ? '+' : ''}{combo.tsm}°C</strong>
                    </span>
                </div>
                {combo.aero && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500
                    border-t border-gray-100 dark:border-gray-800 pt-2">
                        {combo.aero.q != null && (
                            <span>q: <strong className="text-gray-700 dark:text-gray-300">{combo.aero.q}</strong></span>
                        )}
                        {combo.aero.Gn != null && (
                            <span>Gн: <strong className="text-gray-700 dark:text-gray-300">{combo.aero.Gn}</strong> кг/с</span>
                        )}
                        {combo.aero.Gz != null && (
                            <span>Gз: <strong className="text-gray-700 dark:text-gray-300">{combo.aero.Gz}</strong> кг/с</span>
                        )}
                        {combo.aero.Ge != null && (
                            <span>Gэ: <strong className="text-gray-700 dark:text-gray-300">{combo.aero.Ge}</strong> кг/с</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {combo.products.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-1.5">
                        <span className="font-mono text-sm font-semibold text-blue-800 dark:text-blue-200">{p.name}</span>
                        <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full px-2 py-0.5 font-semibold">×{p.count}</span>
                    </div>
                ))}
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500">
                Суммарная длина: <strong>{combo.total_length} м</strong>
            </div>
        </label>
    );
}

function SeriaCard({ seria, selectedKey, onSelect }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
            border border-gray-200 dark:border-gray-700">
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="text-base font-semibold
                        text-gray-900 dark:text-white">
                        Серия {seria.seria}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                        {seria.combinations.length} вар.
                    </span>
                </div>
                <span className="text-gray-400 text-sm">
                    {expanded ? '▲' : '▼'}
                </span>
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-3">
                    {seria.combinations.map((combo, idx) => {
                        const key = `${seria.seria}:${idx}`;
                        return (
                            <CombinationRow key={idx} combo={combo} index={idx}
                                selected={selectedKey === key}
                                onSelect={() => onSelect(key, combo)} />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────────

export default function SelectionPage() {
    const { heatingValues, ipValues, standardOpenings } = useFormData();
    const [form, setForm] = useState(EMPTY_FORM);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [coordInput, setCoordInput] = useState('');
    const [coordError, setCoordError] = useState('');
    const [locating, setLocating] = useState(false);
    const [lastParams, setLastParams] = useState(null);
    const resultsRef = useRef(null);
    const [selectedKey, setSelectedKey] = useState(null);
    const [selectedCombo, setSelectedCombo] = useState(null);
    const { user } = useAuth();
    const [customer, setCustomer] = useState('');
    const [accessories, setAccessories] = useState(null);   // {items, has_pcb}
    const [selectedExtra, setSelectedExtra] = useState([]); // accessory_id прочего оборудования (чекбоксы)
    const [selectedMix, setSelectedMix] = useState(null);   // accessory_id смесительного узла (один)
    const [selectedWA, setSelectedWA] = useState(null);

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const tn = parseFloat(form.tn);
    const tv = parseFloat(form.tv);
    const tempWarning = !isNaN(tn) && !isNaN(tv) && tv - tn < 5 && tv - tn >= 0;
    const tempError = !isNaN(tn) && !isNaN(tv) && tn >= tv;

    const handleSubmit = useCallback(async e => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResults(null);
        setSelectedKey(null);
        setSelectedCombo(null);
        try {
            const payload = {
                ...form,
                h: parseFloat(form.h),
                b: parseFloat(form.b),
                tn: parseFloat(form.tn),
                tv: parseFloat(form.tv),
                V: parseFloat(form.V),
                tsm: parseInt(form.tsm),
                ip: parseInt(form.ip),
                Tpr: form.heat_type === 'W' ? parseInt(form.Tpr) : undefined,
            };
            const { ok, data } = await selectionApi.calculate(payload);
            if (ok && data.success) {
                setResults(data.data);
                setLastParams(payload);
                setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                setError(data.error?.message || data.error?.details || 'Ошибка расчёта');
            }
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    }, [form]);

    const handleNearestByCoords = useCallback(async () => {
        setCoordError('');
        // Парсим "59.939003, 30.313994" или "59.939003 30.313994"
        const parts = coordInput.trim().split(/[\s,]+/);
        if (parts.length < 2) {
            setCoordError('Введите координаты: 59.9390, 30.3139');
            return;
        }
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lon)) {
            setCoordError('Неверный формат координат');
            return;
        }
        setLocating(true);
        try {
            const res = await selectionApi.nearestRegion(lat, lon);
            if (res.ok && res.data.success) {
                const r = res.data.data;
                setSelectedRegion(r);
                setCoordInput('');
                set('tn', r.tn);
                set('V', r.V);
            } else {
                setCoordError('Регион не найден');
            }
        } catch {
            setCoordError('Ошибка соединения');
        } finally {
            setLocating(false);
        }
    }, [coordInput]);

    const radioClass = active =>
        `flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
        transition-colors text-sm
        ${active
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'}`;

    return (
        <div className="space-y-4">
            {/* Шапка */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Подбор воздушных завес
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Аэродинамический и тепловой расчёт завода Тепломаш
                </p>
            </div>

            <form onSubmit={handleSubmit}
                className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-5 space-y-5">

                {/* 1. Организация (заказчик) */}
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        Организация (заказчик)
                    </span>
                    <input
                        type="text"
                        value={customer}
                        onChange={e => setCustomer(e.target.value)}
                        placeholder="Название фирмы заказчика"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                            px-3 py-2 text-sm bg-white dark:bg-neutral-800
                            text-gray-900 dark:text-white placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </label>

                {/* 2. Типовой проём (пресеты) */}
                {standardOpenings.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Типовой проём</p>
                        <div className="flex flex-wrap gap-2">
                            {standardOpenings.map(o => (
                                <button key={o.id} type="button"
                                    onClick={() => { set('h', o.h); set('b', o.b); }}
                                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors
                                        ${form.h == o.h && form.b == o.b
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'}`}>
                                    {o.name} <span className="text-gray-400 dark:text-gray-500">{o.h}×{o.b}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Размеры проёма */}
                <div className="grid grid-cols-2 gap-4">
                    <NumberField label="Высота проёма, м" value={form.h}
                        onChange={v => set('h', v)} step="0.1" min="1.5" max="7" required />
                    <NumberField label="Ширина проёма, м" value={form.b}
                        onChange={v => set('b', v)} step="0.1" min="1.5" max="7" required />
                </div>

                {/* 4. Регион + координаты — одна строка */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Регион (необязательно)</span>
                        <SmartSelect
                            endpoint="/api/v1/selection/regions/"
                            placeholder="Начните вводить город..."
                            nameKey="name"
                            value={selectedRegion}
                            onClear={() => setSelectedRegion(null)}
                            renderItem={r => (
                                <div className="flex justify-between">
                                    <span className="text-gray-900 dark:text-white font-medium">{r.name}</span>
                                    <span className="text-gray-400">{r.tn}°C / {r.V} м/с</span>
                                </div>
                            )}
                            onSelect={r => { setSelectedRegion(r); set('tn', r.tn); set('V', r.V); }}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Поиск по координатам</span>
                        <div className="flex gap-2">
                            <input type="text" value={coordInput}
                                onChange={e => setCoordInput(e.target.value)}
                                placeholder="59.9390, 30.3139"
                                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg
                                    px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                    text-gray-900 dark:text-white placeholder-gray-400
                                    focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            <button type="button" onClick={handleNearestByCoords} disabled={locating}
                                className="shrink-0 px-3 py-2 rounded-lg border border-gray-200
                                    dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400
                                    hover:border-blue-400 hover:text-blue-500
                                    disabled:opacity-40 transition-colors whitespace-nowrap">
                                {locating ? '···' : 'Найти город'}
                            </button>
                        </div>
                        {coordError && <span className="text-xs text-red-500">{coordError}</span>}
                    </div>
                </div>

                {/* 5. Tн, Tв, Tсмеси, Скорость — одна строка */}
                <div className="grid grid-cols-4 gap-4">
                    <NumberField label="T наружная, °C" value={form.tn}
                        onChange={v => set('tn', v)} step="1" min="-70" max="5" required />
                    <NumberField label="T внутренняя, °C" value={form.tv}
                        onChange={v => set('tv', v)} step="1" min="-5" max="30" required />
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Желат. T смеси, °C</span>
                        <select value={form.tsm}
                            onChange={e => set('tsm', parseInt(e.target.value))}
                            className="border border-gray-300 dark:border-gray-600 rounded-lg
                                px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                text-gray-900 dark:text-white
                                focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {TSM_OPTIONS.map(v => <option key={v} value={v}>{v}°C</option>)}
                        </select>
                    </label>
                    <NumberField label="Скорость ветра, м/с" value={form.V}
                        onChange={v => set('V', v)} step="0.1" min="0" max="5" required />
                </div>

                {/* 6. Способ установки */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Способ установки
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {INSTALL_TYPES.map(t => (
                            <label key={t.value} className={radioClass(form.install_type === t.value)}>
                                <input type="radio" className="hidden"
                                    checked={form.install_type === t.value}
                                    onChange={() => set('install_type', t.value)} />
                                {t.label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* 7. Источник тепла (Газ вместо G) */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Источник тепла
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {heatingValues.map(h => (
                            <label key={h.id} className={radioClass(form.heat_type === h.value)}>
                                <input type="radio" className="hidden"
                                    checked={form.heat_type === h.value}
                                    onChange={() => set('heat_type', h.value)} />
                                {h.value === 'E' ? 'Электро' :
                                    h.value === 'W' ? 'Вода' :
                                        h.value === 'A' ? 'Без нагрева' :
                                            h.value === 'G' ? 'Газ' :
                                                h.value}
                            </label>
                        ))}
                    </div>
                </div>

                {/* 8. Степень защиты (IP) */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Степень защиты
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {ipValues
                            .filter(v => v.value === 'IP21' || v.value === 'IP54')
                            .map(v => (
                                <label key={v.id}
                                    className={radioClass(form.ip === parseInt(v.value.replace('IP', '')))}>
                                    <input type="radio" className="hidden"
                                        checked={form.ip === parseInt(v.value.replace('IP', ''))}
                                        onChange={() => set('ip', parseInt(v.value.replace('IP', '')))} />
                                    {v.value}
                                </label>
                            ))}
                    </div>
                </div>

                {/* 9. Параметры воды */}
                {form.heat_type === 'W' && (
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-lg
                        bg-orange-50 dark:bg-orange-900/10
                        border border-orange-200 dark:border-orange-800">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-400 dark:text-gray-500">T прямой ветки, °C</span>
                            <select value={form.Tpr}
                                onChange={e => set('Tpr', parseInt(e.target.value))}
                                className="border border-gray-300 dark:border-gray-600 rounded-lg
                                    px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                    text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {TPR_OPTIONS.map(v => <option key={v} value={v}>{v}°C</option>)}
                            </select>
                        </label>
                        <div className="flex items-end pb-2 text-xs text-gray-400 dark:text-gray-500">
                            Обратная T рассчитывается автоматически
                        </div>
                    </div>
                )}

                {/* 10. Оптимизация */}
                <label className="flex items-center gap-2 cursor-pointer text-sm
                    text-gray-700 dark:text-gray-300">
                    <input type="checkbox" className="rounded"
                        checked={form.optimize}
                        onChange={e => set('optimize', e.target.checked)} />
                    Оптимизировать по температуре смеси
                </label>

                {/* Предупреждения температур */}
                {tempError && (
                    <div className="text-xs text-red-600 dark:text-red-400
                        bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                        rounded-lg px-4 py-2">
                        Расчёт охлаждения не поддерживается (Tн ≥ Tв)
                    </div>
                )}
                {tempWarning && !tempError && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400
                        bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200
                        dark:border-yellow-800 rounded-lg px-4 py-2">
                        Рекомендуется завеса без источника тепла
                    </div>
                )}

                <button type="submit" disabled={loading || tempError}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                        disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                    {loading ? 'Выполняется расчёт...' : 'Подобрать завесы'}
                </button>
            </form>

            {/* Ошибка */}
            {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200
                    dark:border-red-800 rounded-lg p-4 text-sm
                    text-red-700 dark:text-red-400">
                    {typeof error === 'object' ? JSON.stringify(error) : error}
                </div>
            )}

            {/* Результаты */}
            {results && (
                <div ref={resultsRef} className="space-y-3">
                    {results.error && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20
                            border border-yellow-200 dark:border-yellow-800
                            rounded-lg p-4 text-sm
                            text-yellow-700 dark:text-yellow-300">
                            {results.error_message || results.error}
                        </div>
                    )}
                    {results.results?.map(seria => (
                        <SeriaCard key={seria.seria} seria={seria}
                            selectedKey={selectedKey}
                            onSelect={async (key, combo) => {
                                setSelectedKey(key);
                                setSelectedCombo(combo);
                                setSelectedExtra([]); setSelectedMix(null); setSelectedWA(null);
                                const ids = combo.products.map(p => p.id);
                                const { ok, data } = await selectionApi.accessories(ids);
                                setAccessories(ok && data.success ? data.data : null);
                            }}
                        />
                    ))}
                </div>
            )}
            {selectedCombo && accessories && accessories.items.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                    border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Дополнительное оборудование
                    </p>

                    {/* Смесительные узлы — один из */}
                    {accessories.items.filter(i => i.kind === 'mix_unit').length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-400">Марка смесительного узла</p>
                            {accessories.items.filter(i => i.kind === 'mix_unit').map(i => (
                                <label key={i.accessory_id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="mix-unit" className="accent-blue-600"
                                        checked={selectedMix === i.accessory_id}
                                        onChange={() => setSelectedMix(i.accessory_id)} />
                                    {i.name}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Блок-WA — один из */}
                    {accessories.items.filter(i => i.kind === 'control_wa').length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-400">Блок управления (WA)</p>
                            {accessories.items.filter(i => i.kind === 'control_wa').map(i => (
                                <label key={i.accessory_id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="wa-unit" className="accent-blue-600"
                                        checked={selectedWA === i.accessory_id}
                                        onChange={() => setSelectedWA(i.accessory_id)} />
                                    {i.name}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Прочее — много */}
                    {accessories.items.filter(i => i.kind === 'other').length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-400">Комплектующие / автоматика</p>
                            {accessories.items.filter(i => i.kind === 'other').map(i => (
                                <label key={i.accessory_id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" className="rounded accent-blue-600"
                                        checked={selectedExtra.includes(i.accessory_id)}
                                        onChange={e => setSelectedExtra(prev =>
                                            e.target.checked
                                                ? [...prev, i.accessory_id]
                                                : prev.filter(x => x !== i.accessory_id))} />
                                    {i.name}{i.quantity > 1 && <span className="text-xs text-gray-400">×{i.quantity}</span>}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {results && results.results?.length > 0 && (
                <button
                    type="button"
                    disabled={!selectedCombo}
                    onClick={async () => {
                        const acc = accessories?.items || [];
                        const byId = id => acc.find(i => i.accessory_id === id);
                        const proposalParams = {
                            ...lastParams,
                            customer,
                            mix_unit: selectedMix ? byId(selectedMix)?.name : '',
                            control_unit: selectedWA ? byId(selectedWA)?.name : '',
                            extra_equipment: selectedExtra.map(id => byId(id)?.name).filter(Boolean),
                            has_pcb: accessories?.has_pcb || false,
                        };
                        const res = await selectionApi.proposal(proposalParams, selectedCombo);
                        if (!res.ok) { setError('Ошибка формирования предложения'); return; }
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = customer ? `Предложение для ${customer}.pdf` : 'Предложение.pdf';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                    }}
                    className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700
                        disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                    {selectedCombo ? 'Скачать предложение (PDF)' : 'Выберите вариант для предложения'}
                </button>
            )}
        </div>
    );
}