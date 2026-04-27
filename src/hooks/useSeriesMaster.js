import { useState, useCallback, useEffect } from 'react';
import { catalogApi } from '../api/catalog';

/**
 * Состояние мастера создания серии изделий.
 *
 * Шаги:
 *   1 — тип продукции + префикс
 *   2 — фиксированные параметры (серия, дизайн, IP)
 *   3 — конструктор кода (позиции + маппинг длин)
 *   4 — виды нагрева
 *   5 — таблица изделий
 *   6 — превью правил
 *   7 — подтверждение и создание
 */
export function useSeriesMaster() {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Шаг 1
    const [productType, setProductType] = useState(null);   // {id, name}
    const [prefix, setPrefix] = useState('КЭВ-П');

    // Шаг 2
    const [series, setSeries] = useState(null);             // {id, value}
    const [design, setDesign] = useState(null);
    const [ip, setIp] = useState(null);

    // Шаг 3 — позиции кода
    // positions: [{pos: "1", type: "series_digit"|"network"|"axis", axis_code, digits}]
    const [positions, setPositions] = useState([
        { pos: '1', type: 'series_digit' },
        { pos: '2', type: 'network' },
        { pos: '3', type: 'axis', axis_code: 'length', digits: 1 },
        { pos: '4', type: 'axis', axis_code: 'design', digits: 1 },
    ]);
    // lengthMap: [{digit: "3", valueId: 13, valueLabel: "1000"}]
    const [lengthMap, setLengthMap] = useState([]);
    // designMap: [{digit: "0", valueId: 61, valueLabel: "Бриллиант Плюс"}]
    const [designMap, setDesignMap] = useState([]);

    // Шаг 4
    const [heatings, setHeatings] = useState([]);           // [{id, value}] выбранные

    // Шаг 5 — таблица изделий
    // items: [{id(local), heating, length, networkDigit, power, name, externalId}]
    const [items, setItems] = useState([]);

    // Шаг 6 — превью правил (загружается с бэкенда)
    const [rules, setRules] = useState([]);

    // Результат создания
    const [result, setResult] = useState(null);             // {products_created, rules_created, ...}
    const [savedTemplateId, setSavedTemplateId] = useState(null);

    useEffect(() => {
        if (step === 5) {
            generateItems();
        }
    }, [step]);

    // ------------------------------------------------------------------
    // Навигация между шагами
    // ------------------------------------------------------------------

    const canNext = useCallback(() => {
        if (step === 1) return !!productType;
        if (step === 2) return !!(series && design && ip);
        if (step === 3) return lengthMap.length > 0 && lengthMap.every(lm => lm.digit && lm.valueId);
        if (step === 4) return heatings.length > 0;
        if (step === 5) return items.length > 0;
        if (step === 6) return rules.length > 0;
        return true;
    }, [step, productType, series, design, ip, lengthMap, heatings, items, rules]);

    const next = useCallback(() => {
        setError(null);
        setStep(s => Math.min(s + 1, 7));
    }, []);

    const prev = useCallback(() => {
        setError(null);
        setStep(s => Math.max(s - 1, 1));
    }, []);

    // ------------------------------------------------------------------
    // Шаг 5: управление таблицей изделий
    // ------------------------------------------------------------------

    /**
     * Генерировать строки таблицы из комбинаций (длина × нагрев).
     * Вызывается при переходе на шаг 5.
     */
    const generateItems = useCallback(() => {
        console.log('lengthMap:', lengthMap);
        console.log('heatings:', heatings);
        console.log('positions:', positions);
        console.log('series:', series);
        console.log('designMap:', designMap);
        const newItems = [];
        let order = 1;

        for (const lengthEntry of lengthMap) {
            console.log('--- lengthEntry:', JSON.stringify(lengthEntry));
            for (const heating of heatings) {
                console.log('--- heating:', JSON.stringify(heating));
                const needsPower = heating.value === 'E' || heating.value === 'W';
                const heatingCode = heating.value;
                const lengthLabel = lengthEntry.valueLabel;

                // Генерируем базовое название
                const codeStr = buildCode(positions, series, lengthEntry.digit, designMap, heatingCode);
                const cleanPrefix = prefix.replace(/^КЭВ-/, ''); // "П"
                const networkDefault = (heating.value === 'W' || heating.value === 'A') ? '1' : '0';

                const baseTemplate = needsPower
                    ? `КЭВ-{мощность}${cleanPrefix}${codeStr}${heatingCode}`
                    : `КЭВ-${cleanPrefix}${codeStr}${heatingCode}`;

                const baseName = baseTemplate;  // шаблон с ?
                const name = baseTemplate.replace('?', networkDefault);  // сразу подставляем сеть
                console.log('baseTemplate:', baseTemplate);
                console.log('networkDefault:', networkDefault);
                console.log('name after replace:', name);

                newItems.push({
                    localId: `${lengthEntry.digit}-${heating.id}-${order}`,
                    heating,
                    length: { id: lengthEntry.valueId, value: lengthLabel },
                    networkDigit: networkDefault,
                    power: needsPower ? '' : null,
                    baseName,   // шаблон для регенерации при смене мощности
                    name,       // уже с подставленной сетью
                    externalId: generateGuid(),
                    sort_order: order,
                });
                order++;
            }
        }

        setItems(newItems);
        console.log('FINAL newItems:', newItems.length, newItems);
    }, [lengthMap, heatings, positions, series, designMap, prefix]);

    const addPowerRow = useCallback((localId) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.localId === localId);
            if (idx === -1) return prev;
            const source = prev[idx];
            const newItem = {
                ...source,
                localId: `${source.localId}-copy-${Date.now()}`,
                power: '',
                name: source.baseName,  // ← сбрасываем к шаблону
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
                // Используем name (с подставленной сетью), а не baseName
                const template = item.name.includes('{мощность}')
                    ? item.name
                    : item.baseName.replace('?', item.networkDigit);
                updated.name = powerLabel
                    ? template.replace('{мощность}', powerLabel)
                    : template;
            }

            // При изменении сети — заменяем ? в названии
            if (field === 'networkDigit') {
                updated.name = item.name.replace('?', value);
                updated.baseName = item.baseName.replace('?', value);
            }

            return updated;
        }));
    }, []);

    const removeItem = useCallback((localId) => {
        setItems(prev => prev.filter(i => i.localId !== localId));
    }, []);

    // ------------------------------------------------------------------
    // Шаг 6: загрузить превью правил
    // ------------------------------------------------------------------

    const loadRules = useCallback(async (templateId) => {
        const { ok, data } = await catalogApi.generateSeriesRules(templateId, true);
        if (ok && data.success) {
            setRules(data.data);
        }
    }, []);

    // ------------------------------------------------------------------
    // Финальное создание
    // ------------------------------------------------------------------

    const buildPayload = useCallback(() => {
        // code_positions как объект {"1": {...}, ...}
        const codePositions = {};
        for (const p of positions) {
            const entry = { type: p.type };
            if (p.type === 'axis') {
                entry.axis_code = p.axis_code;
                entry.digits = p.digits || 1;
            }
            codePositions[p.pos] = entry;
        }

        // length_map как объект {"3": value_id, ...}
        const lengthMapObj = {};
        for (const lm of lengthMap) {
            lengthMapObj[lm.digit] = lm.valueId;
        }

        // design_map
        const designMapObj = {};
        for (const dm of designMap) {
            designMapObj[dm.digit] = dm.valueId;
        }

        // items
        const itemsPayload = items
            .filter(i => i.power !== '')  // пропускаем незаполненные мощности
            .map(i => ({
                heating: i.heating.id,
                length: i.length.id,
                network_digit: i.networkDigit,
                power: i.power !== null ? parseFloat(i.power) : null,
                name: i.name,
                external_id: i.externalId,
                sort_order: i.sort_order,
            }));

        return {
            name: `${series?.value} ${design?.value}`,
            prefix,
            product_type: productType?.id,
            series: series?.id,
            design: design?.id,
            ip: ip?.id,
            code_positions: codePositions,
            length_map: lengthMapObj,
            design_map: designMapObj,
            items: itemsPayload,
        };
    }, [positions, lengthMap, designMap, items, series, design, ip, prefix, productType]);

    const submit = useCallback(async () => {
        setSaving(true);
        setError(null);

        try {
            let templateId = savedTemplateId;

            // Создаём шаблон только если ещё не создан (не было шага 6)
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
            }

            // Создаём продукты + правила
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
    }, [buildPayload, savedTemplateId]);

    return {
        // Навигация
        step, next, prev, canNext, error,
        saving,

        // Шаг 1
        productType, setProductType,
        prefix, setPrefix,

        // Шаг 2
        series, setSeries,
        design, setDesign,
        ip, setIp,

        // Шаг 3
        positions, setPositions,
        lengthMap, setLengthMap,
        designMap, setDesignMap,

        // Шаг 4
        heatings, setHeatings,

        // Шаг 5
        items,
        generateItems,
        addPowerRow,
        updateItem,
        removeItem,

        // Шаг 6
        rules, setRules,
        loadRules,

        // Финал
        result,
        savedTemplateId,
        setSavedTemplateId,
        submit,
        buildPayload,
    };
}

// ------------------------------------------------------------------
// Утилиты
// ------------------------------------------------------------------

function generateGuid() {
    return 'GUID-' + Math.random().toString(36).substr(2, 12).toUpperCase();
}

function buildCode(positions, series, lengthDigit, designMap) {
    let code = '';
    for (const p of [...positions].sort((a, b) => Number(a.pos) - Number(b.pos))) {
        if (p.type === 'series_digit') {
            code += series?.value?.[0] || '';
        } else if (p.type === 'network') {
            code += '?';
        } else if (p.type === 'axis') {
            if (p.axis_code === 'length') {
                code += lengthDigit;
            } else if (p.axis_code === 'design') {
                const dm = designMap[0];
                code += dm?.digit || '?';
            }
        }
    }
    return code;
}