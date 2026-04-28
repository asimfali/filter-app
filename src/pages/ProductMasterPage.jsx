import React, { useEffect, useState } from 'react';
import { useSeriesMaster } from '../hooks/useSeriesMaster';
import { catalogApi } from '../api/catalog';
import { inputCls } from '../utils/styles';
import { useModals } from '../hooks/useModals';
import CodePositionBuilder from '../components/catalog/CodePositionBuilder';
import SeriesItemsTable from '../components/catalog/SeriesItemsTable';
import RulePreview from '../components/catalog/RulePreview';

const STEPS = [
    'Тип продукции',
    'Параметры серии',
    'Варьируемые оси',
    'Маппинг кода',
    'Изделия',
    'Правила',
    'Готово',
];

export default function ProductMasterPage({ onBack }) {
    const master = useSeriesMaster();
    const { showConfirm, modals } = useModals();

    const handleSubmit = () => {
        showConfirm(
            `Будет создано ${master.items.filter(i => i.power !== '').length} изделий. Продолжить?`,
            () => master.submit(),
            false,
        );
    };

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            {modals}

            <div>
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={onBack}
                        className="text-sm text-gray-500 hover:text-gray-700
                                   dark:text-gray-400 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Мастер создания серии
                    </h1>
                </div>

                <div className="flex items-center gap-1">
                    {STEPS.map((label, i) => {
                        const num = i + 1;
                        const active = num === master.step;
                        const done = num < master.step;
                        return (
                            <React.Fragment key={num}>
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs
                                    ${active
                                        ? 'bg-blue-600 text-white font-medium'
                                        : done
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-gray-400 dark:text-gray-600'
                                    }`}>
                                    <span>{done ? '✓' : num}</span>
                                    <span className="hidden sm:inline">{label}</span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`h-px flex-1 ${done
                                        ? 'bg-emerald-400'
                                        : 'bg-gray-200 dark:bg-gray-700'}`}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-6">
                {master.step === 1 && <Step1 master={master} />}
                {master.step === 2 && <Step2 master={master} />}
                {master.step === 3 && <Step4 master={master} />} 
                {master.step === 4 && <Step3 master={master} />} 
                {master.step === 5 && <Step5 master={master} />}
                {master.step === 6 && <Step6 master={master} />}
                {master.step === 7 && <Step7 master={master} onBack={onBack} />}

                {master.error && (
                    <div className="mt-4 text-xs text-red-500 bg-red-50 dark:bg-red-900/20
                                    px-3 py-2 rounded">
                        {master.error}
                    </div>
                )}
            </div>

            {master.step < 7 && (
                <div className="flex justify-between">
                    <button
                        onClick={master.step === 1 ? onBack : master.prev}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200
                                   dark:border-gray-700 text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        {master.step === 1 ? 'Отмена' : '← Назад'}
                    </button>
                    {master.step < 6 && (
                        <button
                            onClick={master.next}
                            disabled={!master.canNext()}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                       hover:bg-blue-700 text-white disabled:opacity-50">
                            Далее →
                        </button>
                    )}
                    {master.step === 6 && (
                        <button
                            onClick={handleSubmit}
                            disabled={master.saving || !master.canNext()}
                            className="px-4 py-2 text-sm rounded-lg bg-emerald-600
                                       hover:bg-emerald-700 text-white disabled:opacity-50">
                            {master.saving ? 'Создание...' : 'Создать серию'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Шаг 1: Тип продукции ─────────────────────────────────────────────────

function Step1({ master }) {
    const [productTypes, setProductTypes] = useState([]);

    useEffect(() => {
        catalogApi.productTypes().then(({ data }) => {
            if (data.results) setProductTypes(data.results);
            else if (Array.isArray(data)) setProductTypes(data);
        });
    }, []);

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Тип продукции
            </h2>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">Тип продукции *</label>
                <select
                    value={master.productType?.id || ''}
                    onChange={e => {
                        const pt = productTypes.find(p => p.id === Number(e.target.value));
                        master.setProductType(pt || null);
                    }}
                    className={inputCls}
                >
                    <option value="">Выберите...</option>
                    {productTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                </select>
            </div>

            {/* Индикатор загрузки конфига */}
            {master.productType && master.configLoading && (
                <p className="text-xs text-gray-400 animate-pulse">
                    Загрузка конфига мастера...
                </p>
            )}
            {master.productType && !master.configLoading && master.masterConfig && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50
                                dark:bg-emerald-900/20 px-3 py-2 rounded">
                    ✓ Конфиг загружен: {master.masterConfig.prefix}
                    {' · '}
                    Фиксированные оси: {master.masterConfig.fixed_axes.join(', ')}
                    {' · '}
                    Варьируемые: {master.masterConfig.varies_axes.join(', ')}
                </div>
            )}
            {master.productType && !master.configLoading && !master.masterConfig && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
                    Конфиг мастера не настроен для этого типа продукции
                </div>
            )}
        </div>
    );
}

// ── Шаг 2: Фиксированные параметры серии ─────────────────────────────────
// Динамически рендерит оси из masterConfig.fixed_axes

function Step2({ master }) {
    const { masterConfig, fixedValues, setFixedValue } = master;
    if (!masterConfig) return null;

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Фиксированные параметры серии
            </h2>
            <p className="text-xs text-gray-500">
                Эти параметры одинаковы для всех изделий серии.
            </p>
            {masterConfig.fixed_axes.map(axisCode => {
                const axisData = masterConfig.axes[axisCode];
                if (!axisData) return (
                    <div key={axisCode} className="text-xs text-red-400">
                        Ось «{axisCode}» не найдена
                    </div>
                );
                return (
                    <div key={axisCode}>
                        <label className="text-xs text-gray-500 mb-1 block">
                            {axisData.name} *
                        </label>
                        <select
                            value={fixedValues[axisCode]?.id || ''}
                            onChange={e => {
                                const v = axisData.values.find(
                                    x => x.id === Number(e.target.value)
                                );
                                setFixedValue(axisCode, v || null);
                            }}
                            className={inputCls}
                        >
                            <option value="">Выберите...</option>
                            {axisData.values.map(v => (
                                <option key={v.id} value={v.id}>{v.value}</option>
                            ))}
                        </select>
                    </div>
                );
            })}
        </div>
    );
}

// ── Шаг 3: Конструктор кода ───────────────────────────────────────────────
// Показывает только если есть axis_digit позиции в name_positions

function Step3({ master }) {
    const { masterConfig, axisDigitMaps, setAxisDigitMaps, fixedValues, variesSelections } = master;
    if (!masterConfig) return null;

    const axisDigitPositions = masterConfig.name_positions.filter(
        p => p.type === 'axis_digit'
    );

    if (axisDigitPositions.length === 0) {
        return (
            <div className="space-y-2">
                <h2 className="text-base font-medium text-gray-900 dark:text-white">
                    Маппинг кода
                </h2>
                <p className="text-xs text-gray-400">
                    Для этого типа продукции маппинг цифр не требуется.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Маппинг цифр кода
            </h2>
            <p className="text-xs text-gray-500">
                Задайте соответствие цифр кода значениям осей.
            </p>
            {axisDigitPositions.map(pos => {
                const axisData = masterConfig.axes[pos.axis_code];
                const isFixed = masterConfig.fixed_axes.includes(pos.axis_code);
                const currentMap = axisDigitMaps[pos.axis_code] || [];

                // Для варьируемых осей — только выбранные значения
                // Для фиксированных — одно значение из fixedValues
                const availableValues = isFixed
                    ? (fixedValues[pos.axis_code]
                        ? [{ id: fixedValues[pos.axis_code].id, value: fixedValues[pos.axis_code].value }]
                        : [])
                    : (variesSelections[pos.axis_code] || []);

                const addRow = () => setAxisDigitMaps(prev => {
                    const valueId = isFixed ? (fixedValues[pos.axis_code]?.id || null) : null;
                    const valueLabel = isFixed ? (fixedValues[pos.axis_code]?.value || '') : '';
                    return {
                        ...prev,
                        [pos.axis_code]: [
                            ...(prev[pos.axis_code] || []),
                            { digit: '', valueId, valueLabel },
                        ],
                    };
                });

                const updateRow = (idx, field, value) => setAxisDigitMaps(prev => {
                    const map = [...(prev[pos.axis_code] || [])];
                    if (field === 'valueId') {
                        const v = availableValues.find(x => x.id === Number(value));
                        map[idx] = { ...map[idx], valueId: Number(value), valueLabel: v?.value || '' };
                    } else {
                        map[idx] = { ...map[idx], [field]: value };
                    }
                    return { ...prev, [pos.axis_code]: map };
                });

                const removeRow = (idx) => setAxisDigitMaps(prev => ({
                    ...prev,
                    [pos.axis_code]: (prev[pos.axis_code] || []).filter((_, i) => i !== idx),
                }));

                return (
                    <div key={pos.axis_code} className="space-y-2">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Маппинг оси «{axisData?.name || pos.axis_code}»
                            {pos.digits > 1 && (
                                <span className="ml-2 text-gray-400">
                                    ({pos.digits} цифры)
                                </span>
                            )}
                        </div>
                        {currentMap.map((row, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input
                                    value={row.digit}
                                    onChange={e => updateRow(idx, 'digit', e.target.value)}
                                    placeholder={pos.digits > 1 ? '10' : '3'}
                                    className="w-14 text-center text-xs rounded border
                                               border-gray-200 dark:border-gray-700
                                               bg-white dark:bg-neutral-900
                                               text-gray-900 dark:text-white px-2 py-1.5
                                               focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-gray-400 text-xs shrink-0">→</span>
                                {isFixed ? (
                                    <span className="flex-1 text-xs text-gray-500
                                                     dark:text-gray-400 px-2 py-1.5 rounded
                                                     border border-gray-100 dark:border-gray-800
                                                     bg-neutral-50 dark:bg-neutral-900">
                                        {fixedValues[pos.axis_code]?.value || '—'}
                                    </span>
                                ) : (
                                    <select
                                        value={row.valueId || ''}
                                        onChange={e => updateRow(idx, 'valueId', e.target.value)}
                                        className="flex-1 text-xs rounded border border-gray-200
                                                   dark:border-gray-700 bg-white dark:bg-neutral-900
                                                   text-gray-900 dark:text-white px-2 py-1.5
                                                   focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Значение...</option>
                                        {availableValues.map(v => (
                                            <option key={v.id} value={v.id}>{v.value}</option>
                                        ))}
                                    </select>
                                )}
                                <button
                                    onClick={() => removeRow(idx)}
                                    className="text-red-400 hover:text-red-600 text-xs px-1 shrink-0">
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addRow}
                            className="text-xs text-blue-500 hover:text-blue-700">
                            + добавить
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ── Шаг 4: Варьируемые оси ────────────────────────────────────────────────
// Для heating — мультиселект кнопками
// Для остальных varies_axes — мультиселект чекбоксами

function Step4({ master }) {
    const { masterConfig, variesSelections, setVariesSelection } = master;
    if (!masterConfig) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Варьируемые параметры
            </h2>
            <p className="text-xs text-gray-500">
                Выберите значения которые будут варьироваться между изделиями серии.
            </p>
            {masterConfig.varies_axes.map(axisCode => {
                const axisData = masterConfig.axes[axisCode];
                if (!axisData) return null;

                const selected = variesSelections[axisCode] || [];
                const isHeating = axisCode === masterConfig.heating_axis_code;

                const toggle = (v) => {
                    const exists = selected.find(s => s.id === v.id);
                    setVariesSelection(
                        axisCode,
                        exists ? selected.filter(s => s.id !== v.id) : [...selected, v]
                    );
                };

                return (
                    <div key={axisCode} className="space-y-2">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {axisData.name} *
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {axisData.values.map(v => {
                                const isSelected = selected.some(s => s.id === v.id);
                                const nopower = masterConfig.power_not_required_for.includes(v.value);
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => toggle(v)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium
                                            transition-colors
                                            ${isSelected
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-neutral-200'
                                            }`}
                                    >
                                        {v.value}
                                        {isHeating && nopower && (
                                            <span className="ml-1 text-xs opacity-70">
                                                (без мощности)
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {selected.length > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Выбрано: {selected.map(s => s.value).join(', ')}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Шаг 5: Таблица изделий ────────────────────────────────────────────────

function Step5({ master }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-900 dark:text-white">
                    Изделия серии
                </h2>
                <span className="text-xs text-gray-400">
                    {master.items.filter(i => i.power !== '').length} изделий
                </span>
            </div>
            <SeriesItemsTable
                items={master.items}
                masterConfig={master.masterConfig}
                onAddPower={master.addPowerRow}
                onUpdate={master.updateItem}
                onRemove={master.removeItem}
            />
        </div>
    );
}

// ── Шаг 6: Превью правил ──────────────────────────────────────────────────

function Step6({ master }) {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadPreview();
    }, []);

    const loadPreview = async () => {
        setLoading(true);
        const payload = master.buildPayload();
        if (!payload) { setLoading(false); return; }

        const { ok, data } = await catalogApi.createSeriesTemplate(payload);
        if (!ok || !data.success) { setLoading(false); return; }

        const templateId = data.data.id;
        master.setSavedTemplateId(templateId);
        await master.loadRules(templateId);
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Превью правил AxisCombinationRule
            </h2>
            <p className="text-xs text-gray-500">
                Эти правила будут созданы для корректной привязки осей
                при синхронизации с 1С.
            </p>
            {loading ? (
                <div className="text-sm text-gray-400 animate-pulse">Загрузка...</div>
            ) : (
                <RulePreview rules={master.rules} />
            )}
        </div>
    );
}

// ── Шаг 7: Результат ──────────────────────────────────────────────────────

function Step7({ master, onBack }) {
    const r = master.result;
    if (!r) return null;

    return (
        <div className="space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Серия создана
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-xs mx-auto">
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">{r.products_created}</div>
                    <div className="text-xs text-gray-500 mt-1">Изделий создано</div>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-600">{r.rules_created}</div>
                    <div className="text-xs text-gray-500 mt-1">Правил создано</div>
                </div>
            </div>
            {r.items && (
                <div className="text-left space-y-1 max-h-48 overflow-y-auto">
                    {r.items.map(item => (
                        <div key={item.id}
                            className="flex items-center justify-between text-xs
                                       px-3 py-1.5 rounded bg-neutral-50 dark:bg-neutral-800">
                            <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                            <span className={item.created ? 'text-emerald-500' : 'text-gray-400'}>
                                {item.created ? '+ создано' : 'пропущено'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <button onClick={onBack}
                className="px-6 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700
                           text-white transition-colors">
                Готово
            </button>
        </div>
    );
}