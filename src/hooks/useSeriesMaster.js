import { useState, useCallback, useEffect } from 'react';
import { catalogApi } from '../api/catalog';

/**
 * Универсальный мастер создания серии изделий.
 * Поведение определяется ProductTypeMasterConfig с бэкенда.
 *
 * Шаги:
 *   1 — тип продукции (загружает конфиг)
 *   2 — фиксированные параметры (из config.fixed_axes)
 *   3 — конструктор кода (если has_network или axis_digit в name_positions)
 *   4 — варьируемые оси (если есть heating — мультиселект)
 *   5 — таблица изделий
 *   6 — превью правил
 *   7 — подтверждение и создание
 */
export function useSeriesMaster() {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Шаг 1
    const [productType, setProductType] = useState(null);  // {id, name}
    const [masterConfig, setMasterConfig] = useState(null); // ответ /master-config/
    const [configLoading, setConfigLoading] = useState(false);

    // Шаг 2 — фиксированные оси: axis_code → {id, value}
    const [fixedValues, setFixedValues] = useState({});

    // Шаг 3 — конструктор кода
    const [positions, setPositions] = useState([]);
    const [axisDigitMaps, setAxisDigitMaps] = useState({});
    // axisDigitMaps: { length: [{digit:"3", valueId:13, valueLabel:"1000"}], design: [...] }

    // Шаг 4 — варьируемые оси с мультиселектом (обычно heating)
    // variesSelections: { heating: [{id, value}], ... }
    const [variesSelections, setVariesSelections] = useState({});

    // Шаг 5 — таблица изделий
    const [items, setItems] = useState([]);

    // Шаг 6 — превью правил
    const [rules, setRules] = useState([]);

    // Результат
    const [result, setResult] = useState(null);
    const [savedTemplateId, setSavedTemplateId] = useState(null);

    // ------------------------------------------------------------------
    // Загрузка конфига при выборе типа продукции
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!productType) return;

        setConfigLoading(true);
        setMasterConfig(null);
        setFixedValues({});
        setVariesSelections({});
        setItems([]);
        setRules([]);

        catalogApi.masterConfig(productType.id).then(({ ok, data }) => {
            if (ok && data.success) {
                const config = data.data;
                setMasterConfig(config);

                // Инициализируем positions из name_positions конфига
                // Берём только axis_digit позиции для конструктора кода
                const axisDigitPositions = config.name_positions
                    .filter(p => p.type === 'axis_digit')
                    .map((p, i) => ({
                        pos: String(i + 1),
                        type: 'axis_digit',
                        axis_code: p.axis_code,
                        digits: p.digits || 1,
                    }));

                // Полные позиции для code_positions (бэкенд)
                const fullPositions = config.name_positions.map((p, i) => ({
                    pos: String(i + 1),
                    ...p,
                }));

                setPositions(fullPositions);

                // Инициализируем пустые маппинги для axis_digit осей
                const maps = {};
                for (const p of axisDigitPositions) {
                    maps[p.axis_code] = [];
                }
                setAxisDigitMaps(maps);
            } else {
                setError('Конфиг мастера не найден для этого типа продукции');
            }
            setConfigLoading(false);
        });
    }, [productType]);

    // Генерация items при переходе на шаг 5
    useEffect(() => {
        if (step === 4) {
            // Инициализируем каждую ось независимо
            initAxisDigitMaps();
        }
        if (step === 5) {
            if (items.length === 0) generateItems();
        }
    }, [step]);

    const initAxisDigitMaps = useCallback(() => {
        if (!masterConfig) return;

        const axisDigitPositions = masterConfig.name_positions.filter(
            p => p.type === 'axis_digit'
        );

        setAxisDigitMaps(prev => {
            const maps = { ...prev };

            for (const pos of axisDigitPositions) {
                const isFixed = masterConfig.fixed_axes.includes(pos.axis_code);
                const existing = prev[pos.axis_code] || [];

                if (isFixed) {
                    // Фиксированная ось — одна строка, не трогаем если уже есть цифра
                    const val = fixedValues[pos.axis_code];
                    if (!val) continue;
                    maps[pos.axis_code] = existing.length > 0
                        ? existing  // уже есть — не трогаем
                        : [{ digit: '', valueId: val.id, valueLabel: val.value }];
                } else {
                    // Варьируемая ось — строка на каждое выбранное значение
                    const selected = (variesSelections[pos.axis_code] || [])
                        .slice()
                        .sort((a, b) => {
                            const numA = parseFloat(a.value) || 0;
                            const numB = parseFloat(b.value) || 0;
                            return numA - numB;
                        });

                    // Для каждого выбранного значения — берём существующую строку
                    // или создаём новую с пустой цифрой
                    maps[pos.axis_code] = selected.map(v => {
                        const existingRow = existing.find(r => r.valueId === v.id);
                        return existingRow || { digit: '', valueId: v.id, valueLabel: v.value };
                    });
                }
            }

            return maps;
        });
    }, [masterConfig, fixedValues, variesSelections]);

    // ------------------------------------------------------------------
    // Навигация
    // ------------------------------------------------------------------

    const canNext = useCallback(() => {
        if (!masterConfig) return step === 1 ? !!productType : false;

        if (step === 1) return !!productType && !!masterConfig;

        if (step === 2) {
            // Все fixed_axes должны быть выбраны
            return masterConfig.fixed_axes.every(code => fixedValues[code]?.id);
        }

        if (step === 3) {
            // Варьируемые оси
            return masterConfig.varies_axes.every(code =>
                variesSelections[code]?.length > 0
            );
        }

        if (step === 4) {
            const axisDigitCodes = masterConfig.name_positions
                .filter(p => p.type === 'axis_digit')
                .map(p => p.axis_code);
        
            if (axisDigitCodes.length === 0) return true;
        
            return axisDigitCodes.every(code => {
                const map = axisDigitMaps[code] || [];
                return map.length > 0 && map.every(m =>
                    m.digit !== '' && m.digit !== null && m.digit !== undefined && m.valueId
                );
            });
        }

        if (step === 5) return items.length > 0;
        if (step === 6) return rules.length > 0;

        return true;
    }, [step, productType, masterConfig, fixedValues, axisDigitMaps, variesSelections, items, rules]);

    const next = useCallback(() => { setError(null); setStep(s => Math.min(s + 1, 7)); }, []);
    const prev = useCallback(() => { setError(null); setStep(s => Math.max(s - 1, 1)); }, []);

    // ------------------------------------------------------------------
    // Шаг 2: фиксированные оси
    // ------------------------------------------------------------------

    const setFixedValue = useCallback((axisCode, value) => {
        setFixedValues(prev => ({ ...prev, [axisCode]: value }));
    }, []);

    // ------------------------------------------------------------------
    // Шаг 4: варьируемые оси
    // ------------------------------------------------------------------

    const setVariesSelection = useCallback((axisCode, values) => {
        setVariesSelections(prev => ({ ...prev, [axisCode]: values }));
    }, []);

    // ------------------------------------------------------------------
    // Шаг 5: генерация и управление таблицей
    // ------------------------------------------------------------------

    const generateItems = useCallback(() => {
        if (!masterConfig) return;

        const config = masterConfig;
        const seriesValue = fixedValues['series']?.value || '';
        const seriesParts = getSeriesParts(seriesValue, config.series_prefix_len);

        // Получаем все комбинации варьируемых осей
        // varies_axes: ["heating", "length"] → декартово произведение
        const variesAxes = config.varies_axes;
        const combinations = cartesian(
            variesAxes.map(code => variesSelections[code] || [])
        );

        combinations.sort((a, b) => {
            for (let i = 0; i < variesAxes.length; i++) {
                const valA = a[i]?.value || '';
                const valB = b[i]?.value || '';
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);
                // Если числовые — сортируем по возрастанию
                if (!isNaN(numA) && !isNaN(numB)) {
                    if (numA !== numB) return numA - numB;
                } else {
                    // Строковые — алфавитно
                    if (valA !== valB) return valA.localeCompare(valB);
                }
            }
            return 0;
        });

        const newItems = [];
        let order = 1;

        for (const combo of combinations) {
            // combo: [{id, value}, {id, value}] — по одному значению на каждую варьируемую ось
            const comboMap = {};
            variesAxes.forEach((code, i) => { comboMap[code] = combo[i]; });

            // Определяем нужна ли мощность
            const heatingCode = config.heating_axis_code
                ? comboMap[config.heating_axis_code]?.value
                : null;
            const needsPower = config.has_power &&
                !config.power_not_required_for.includes(heatingCode);

            // Дефолтная цифра сети
            const networkDefault = getDefaultNetwork(heatingCode);

            // varies_values для бэкенда: axis_code → value_id
            const variesValues = {};
            variesAxes.forEach(code => {
                if (comboMap[code]?.id) variesValues[code] = comboMap[code].id;
            });

            // Генерируем название через buildName
            const axisValues = {};
            variesAxes.forEach(code => {
                if (comboMap[code]) axisValues[code] = comboMap[code].value;
            });

            // axis_digits из первой записи маппингов
            const axisDigits = {};
            for (const [code, map] of Object.entries(axisDigitMaps)) {
                if (map[0]) axisDigits[code] = map[0].digit;
            }

            const nameTemplate = buildName({
                config,
                seriesParts,
                networkDigit: '?',
                axisValues: {
                    ...axisValues,
                    ...Object.fromEntries(
                        Object.entries(fixedValues).map(([k, v]) => [k, v?.value])
                    ),
                },
                axisDigits,
                power: needsPower ? '{мощность}' : null,
            });

            newItems.push({
                localId: `${order}-${Date.now()}`,
                variesValues,         // для бэкенда
                comboMap,             // для отображения
                heatingCode,
                networkDigit: networkDefault,
                power: needsPower ? '' : null,
                baseName: nameTemplate,
                name: nameTemplate.replace('?', networkDefault),
                externalId: generateGuid(),
                sort_order: order,
            });
            order++;
        }

        setItems(newItems);
    }, [masterConfig, fixedValues, variesSelections, axisDigitMaps]);

    const addPowerRow = useCallback((localId) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.localId === localId);
            if (idx === -1) return prev;
            const source = prev[idx];
            const newItem = {
                ...source,
                localId: `${source.localId}-copy-${Date.now()}`,
                power: '',
                name: source.baseName.replace('?', source.networkDigit),
                externalId: generateGuid(),
                sort_order: source.sort_order + 0.1,
            };
            const next = [...prev];
            next.splice(idx + 1, 0, newItem);
            return next.map((item, i) => ({ ...item, sort_order: i + 1 }));
        });
    }, []);

    const updateItem = useCallback((localId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.localId !== localId) return item;
            const updated = { ...item, [field]: value };

            if (field === 'power') {
                const powerLabel = value
                    ? (parseFloat(value) % 1 === 0
                        ? String(parseInt(value))
                        : String(parseFloat(value)).replace('.', ','))
                    : '';
                const template = item.baseName.replace('?', item.networkDigit);
                updated.name = powerLabel
                    ? template.replace('{мощность}', powerLabel)
                    : template;
            }

            if (field === 'networkDigit') {
                updated.name = item.name
                    .replace(/\?/g, value)
                    .replace(item.networkDigit, value);
                updated.baseName = item.baseName.replace('?', value);
            }

            return updated;
        }));
    }, []);

    const removeItem = useCallback((localId) => {
        setItems(prev => prev.filter(i => i.localId !== localId));
    }, []);

    // ------------------------------------------------------------------
    // Шаг 6: превью правил
    // ------------------------------------------------------------------

    const loadRules = useCallback(async (templateId) => {
        const { ok, data } = await catalogApi.generateSeriesRules(templateId, true);
        if (ok && data.success) setRules(data.data);
    }, []);

    // ------------------------------------------------------------------
    // Финальное создание
    // ------------------------------------------------------------------

    const buildPayload = useCallback(() => {
        // code_positions: {"1": {...}, ...}
        const codePositions = {};
        for (const p of positions) {
            const entry = { type: p.type };
            if (p.type === 'axis_digit' || p.type === 'axis_value') {
                entry.axis_code = p.axis_code;
                if (p.digits) entry.digits = p.digits;
            }
            if (p.type === 'literal') entry.value = p.value;
            if (p.type === 'series_part') entry.part = p.part;
            codePositions[p.pos] = entry;
        }

        // axis_digit маппинги → length_map, design_map (совместимость с бэкендом)
        const lengthMap = {};
        const designMap = {};
        for (const [code, entries] of Object.entries(axisDigitMaps)) {
            const target = code === 'length' ? lengthMap : designMap;
            for (const e of entries) {
                target[e.digit] = e.valueId;
            }
        }

        // fixed_values: axis_code → value_id
        const fixedValuesPayload = {};
        for (const [code, val] of Object.entries(fixedValues)) {
            if (val?.id) fixedValuesPayload[code] = val.id;
        }

        // items
        const itemsPayload = items
            .filter(i => i.power !== '')
            .map(i => ({
                varies_values: i.variesValues,
                network_digit: i.networkDigit,
                power: i.power !== null ? parseFloat(i.power) : null,
                name: i.name,
                external_id: i.externalId,
                sort_order: i.sort_order,
                // Совместимость со старым бэкендом — пока старые поля ещё есть
                heating: i.variesValues?.heating || null,
                length: i.variesValues?.length || null,
            }));

        // Название шаблона из фиксированных значений
        const nameParts = masterConfig?.fixed_axes
            .map(code => fixedValues[code]?.value)
            .filter(Boolean) || [];

        return {
            name: nameParts.join(' '),
            prefix: masterConfig?.prefix || 'КЭВ-',
            product_type: productType?.id,
            fixed_values: fixedValuesPayload,
            initAxisDigitMaps,
            // Совместимость со старыми полями SeriesTemplate
            series: fixedValuesPayload['series'] || null,
            design: fixedValuesPayload['design'] || null,
            ip: fixedValuesPayload['ip'] || null,
            code_positions: codePositions,
            length_map: lengthMap,
            design_map: designMap,
            items: itemsPayload,
        };
    }, [positions, axisDigitMaps, fixedValues, items, masterConfig, productType]);

    const submit = useCallback(async () => {
        setSaving(true);
        setError(null);

        try {
            let templateId = savedTemplateId;

            if (!templateId) {
                const payload = buildPayload();
                const { ok, data } = await catalogApi.createSeriesTemplate(payload);
                if (!ok || !data.success) {
                    setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
                    setSaving(false);
                    return;
                }
                templateId = data.data.id;
                setSavedTemplateId(templateId);
                await loadRules(templateId);
            }

            const { ok: ok2, data: data2 } = await catalogApi.createSeriesProducts(templateId);
            if (!ok2 || !data2.success) {
                setError(data2.error || 'Ошибка создания изделий');
                setSaving(false);
                return;
            }

            setResult(data2.data);
            setStep(7);
        } catch (e) {
            setError(e.message);
        }

        setSaving(false);
    }, [buildPayload, savedTemplateId, loadRules]);

    return {
        step, next, prev, canNext, error, saving,
        productType, setProductType,
        masterConfig, configLoading,
        fixedValues, setFixedValue,
        positions, setPositions,
        axisDigitMaps, setAxisDigitMaps,
        variesSelections, setVariesSelection,
        items, generateItems, addPowerRow, updateItem, removeItem,
        rules, setRules, loadRules,
        result, savedTemplateId, setSavedTemplateId,
        submit, buildPayload,
    };
}

// ------------------------------------------------------------------
// Утилиты
// ------------------------------------------------------------------

function generateGuid() {
    return 'GUID-' + Math.random().toString(36).substr(2, 12).toUpperCase();
}

function getDefaultNetwork(heatingCode) {
    if (!heatingCode) return '0';
    return (heatingCode === 'W' || heatingCode === 'A') ? '1' : '0';
}

/**
 * Декартово произведение массивов.
 * cartesian([[1,2],[3,4]]) → [[1,3],[1,4],[2,3],[2,4]]
 */
function cartesian(arrays) {
    if (arrays.length === 0) return [[]];
    return arrays.reduce((acc, arr) =>
        acc.flatMap(combo => arr.map(val => [...combo, val])),
        [[]]
    );
}

/**
 * Разбить значение серии на части по series_prefix_len.
 * getSeriesParts('TW', 1) → {prefix:'T', suffix:'W', number:'', full:'TW'}
 * getSeriesParts('200', 0) → {prefix:'', suffix:'', number:'200', full:'200'}
 */
function getSeriesParts(seriesValue, prefixLen) {
    if (!prefixLen) {
        return { prefix: '', suffix: '', number: seriesValue, full: seriesValue };
    }
    return {
        prefix: seriesValue.slice(0, prefixLen),
        suffix: seriesValue.slice(prefixLen),
        number: '',
        full: seriesValue,
    };
}

/**
 * Построить имя изделия из name_positions конфига.
 * Аналог Python NameBuilder.build() — для превью на фронте.
 */
function buildName({ config, seriesParts, networkDigit, axisValues, axisDigits, power }) {
    const segments = [config.prefix];

    for (const pos of config.name_positions) {
        switch (pos.type) {
            case 'power':
                segments.push(power !== null && power !== undefined ? String(power) : '');
                break;
            case 'literal':
                segments.push(pos.value || '');
                break;
            case 'series_part':
                segments.push(seriesParts[pos.part] || '');
                break;
            case 'series_digit':
                segments.push(seriesParts.number?.[0] || '');
                break;
            case 'network':
                segments.push(networkDigit || '?');
                break;
            case 'axis_value':
                segments.push(axisValues[pos.axis_code] || '');
                break;
            case 'axis_digit':
                segments.push(axisDigits[pos.axis_code] || '');
                break;
            default:
                break;
        }
    }

    return segments.join('');
}