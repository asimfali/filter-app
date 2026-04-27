import React, { useEffect, useState } from 'react';
import { useSeriesMaster } from '../hooks/useSeriesMaster';
import { catalogApi } from '../api/catalog';
import { inputCls } from '../utils/styles';
import { useModals } from '../hooks/useModals';
import ModalFooter from '../components/common/ModalFooter';
import WarningsList from '../components/common/WarningsList';
import CodePositionBuilder from '../components/catalog/CodePositionBuilder';
import SeriesItemsTable from '../components/catalog/SeriesItemsTable';
import RulePreview from '../components/catalog/RulePreview';

const STEPS = [
    'Тип продукции',
    'Параметры серии',
    'Конструктор кода',
    'Виды нагрева',
    'Изделия',
    'Правила',
    'Готово',
];

export default function ProductMasterPage({ onBack }) {
    const master = useSeriesMaster();
    const { showConfirm, modals } = useModals();

    const handleNext = () => {
        master.next();  // просто переходим
    };

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

            {/* Заголовок + прогресс */}
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

                {/* Степпер */}
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
                                    <div className={`h-px flex-1 ${done ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Контент шага */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-6">
                {master.step === 1 && <Step1 master={master} />}
                {master.step === 2 && <Step2 master={master} />}
                {master.step === 3 && <Step3 master={master} />}
                {master.step === 4 && <Step4 master={master} />}
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

            {/* Навигация */}
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
                            onClick={handleNext}
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
            <div>
                <label className="text-xs text-gray-500 mb-1 block">Префикс названия</label>
                <input
                    value={master.prefix}
                    onChange={e => master.setPrefix(e.target.value)}
                    placeholder="КЭВ-П"
                    className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                    Часть названия до мощности: КЭВ-П, КЭВ-М и т.д.
                </p>
            </div>
        </div>
    );
}

// ── Шаг 2: Параметры серии ────────────────────────────────────────────────

function Step2({ master }) {
    const [axes, setAxes] = useState({});  // {axis_code: [{id, value}]}

    useEffect(() => {
        if (!master.productType) return;
    
        const loadAxis = async (code, isGlobal = false) => {
            const { ok, data } = await catalogApi.parameterAxes(
                isGlobal ? null : master.productType.id
            );
            if (!ok) return [];
            const all = data.results || data;
            const axis = all.find(a => a.code === code);
            if (!axis) return [];
            const { data: vdata } = await catalogApi.parameterValues(axis.id);
            return vdata.results || vdata;
        };
    
        Promise.all([
            loadAxis('series'),
            loadAxis('design'),
            loadAxis('ip', true),   // ← общая ось
        ]).then(([seriesVals, designVals, ipVals]) => {
            setAxes({ series: seriesVals, design: designVals, ip: ipVals });
        });
    }, [master.productType]);

    const Select = ({ label, values, selected, onSelect }) => (
        <div>
            <label className="text-xs text-gray-500 mb-1 block">{label} *</label>
            <select
                value={selected?.id || ''}
                onChange={e => {
                    const v = values.find(x => x.id === Number(e.target.value));
                    onSelect(v || null);
                }}
                className={inputCls}
            >
                <option value="">Выберите...</option>
                {values.map(v => (
                    <option key={v.id} value={v.id}>{v.value}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Фиксированные параметры серии
            </h2>
            <p className="text-xs text-gray-500">
                Эти параметры одинаковы для всех изделий серии.
            </p>
            <Select
                label="Серия"
                values={axes.series || []}
                selected={master.series}
                onSelect={master.setSeries}
            />
            <Select
                label="Дизайн"
                values={axes.design || []}
                selected={master.design}
                onSelect={master.setDesign}
            />
            <Select
                label="IP"
                values={axes.ip || []}
                selected={master.ip}
                onSelect={master.setIp}
            />
        </div>
    );
}

// ── Шаг 3: Конструктор кода ───────────────────────────────────────────────

function Step3({ master }) {
    const [lengthValues, setLengthValues] = useState([]);

    useEffect(() => {
        if (!master.productType) return;
        catalogApi.parameterAxes(master.productType.id).then(({ ok, data }) => {
            if (!ok) return;
            const all = data.results || data;
            const axis = all.find(a => a.code === 'length');
            if (!axis) return;
            catalogApi.parameterValues(axis.id).then(({ data: vdata }) => {
                setLengthValues(vdata.results || vdata);
            });
        });
    }, [master.productType]);

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Конструктор кода
            </h2>
            <CodePositionBuilder
                positions={master.positions}
                onPositionsChange={master.setPositions}
                lengthValues={lengthValues}
                lengthMap={master.lengthMap}
                onLengthMapChange={master.setLengthMap}
                designMap={master.designMap}
                onDesignMapChange={master.setDesignMap}
                design={master.design}
            />
        </div>
    );
}

// ── Шаг 4: Виды нагрева ───────────────────────────────────────────────────

function Step4({ master }) {
    const [heatingValues, setHeatingValues] = useState([]);

    useEffect(() => {
        catalogApi.parameterAxes(null).then(({ ok, data }) => {
            if (!ok) return;
            const all = data.results || data;
            const axis = all.find(a => a.code === 'heating');
            if (!axis) return;
            catalogApi.parameterValues(axis.id).then(({ data: vdata }) => {
                setHeatingValues(vdata.results || vdata);
            });
        });
    }, []);

    const toggle = (v) => {
        master.setHeatings(prev => {
            const exists = prev.find(h => h.id === v.id);
            return exists ? prev.filter(h => h.id !== v.id) : [...prev, v];
        });
    };

    const isSelected = (v) => master.heatings.some(h => h.id === v.id);

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Виды нагрева
            </h2>
            <p className="text-xs text-gray-500">
                Выберите виды нагрева для этой серии. Для E и W мощность обязательна.
            </p>
            <div className="flex flex-wrap gap-2">
                {heatingValues.map(v => (
                    <button
                        key={v.id}
                        onClick={() => toggle(v)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                            ${isSelected(v)
                                ? 'bg-blue-600 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-neutral-200'
                            }`}
                    >
                        {v.value}
                        {v.value === 'A' && ' (воздух, без мощности)'}
                        {v.value === 'E' && ' (электро)'}
                        {v.value === 'W' && ' (вода)'}
                        {v.value === 'G' && ' (газ)'}
                    </button>
                ))}
            </div>
            {master.heatings.length > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Выбрано: {master.heatings.map(h => h.value).join(', ')}
                </p>
            )}
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
        
        const { ok: ok2, data: data2 } = await catalogApi.generateSeriesRules(templateId, true);
        
        await master.loadRules(templateId);
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Превью правил AxisCombinationRule
            </h2>
            <p className="text-xs text-gray-500">
                Эти правила будут созданы для корректной привязки осей при синхронизации с 1С.
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
                            <span className={item.created
                                ? 'text-emerald-500' : 'text-gray-400'}>
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