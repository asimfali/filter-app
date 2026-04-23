import React, { useState, useEffect, useRef } from 'react';
import { bomApi } from '../../api/bom';
import Dropdown from '../../components/common/Dropdown';
import MaterialCombobox from '../../components/bom/MaterialCombobox';
import { inputCls } from '../../utils/styles';

export default function MaterialsPanel({ materials, presets, sheetMappings, onSave, saving, canWrite, canView, validation }) {
    const [rows, setRows] = useState(materials);
    const [partSearch, setPartSearch] = useState({});
    const [partResults, setPartResults] = useState({});
    const [matSearch, setMatSearch] = useState({});
    const [matResults, setMatResults] = useState({});
    const partRefs = useRef({});
    const matRefs = useRef({});
    const [units, setUnits] = useState([]);

    useEffect(() => {
        bomApi.getUnits().then(({ ok, data }) => {
            if (ok && data.success) setUnits(data.data);
        });
    }, []);

    useEffect(() => {
        if (!materials.length) return;
        setRows(materials.map(row => {
            // Не перезаписываем если source_material уже задан
            if (row.source_material_id || !row.thickness || !row.material_type) return row;
            const mapping = sheetMappings.find(m =>
                m.material_type === row.material_type &&
                m.thickness === String(row.thickness)
            );
            return mapping
                ? { ...row, source_material_id: mapping.part_id, source_material_name: mapping.part_name }
                : row;
        }));
    }, [materials, sheetMappings]);

    // Дефолтный пресет
    const defaultPreset = presets.find(p => p.is_default);
    const defaultStageName = defaultPreset?.stages?.[0]?.name || '';

    const update = (idx, field, value) => {
        setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    };

    const addRow = () => setRows(r => [...r, {
        stage_name: defaultStageName,
        part: null, part_name: '',
        quantity: 1, unit: 'шт.', in_process: false,
        sort_order: r.length,
        material_type: '', thickness: null, size1: null, size2: null, weight_calc: null,
        source_material_id: null, source_material_name: '',
    }]);

    const removeRow = (idx) => setRows(r => r.filter((_, i) => i !== idx));

    const handlePartSearch = async (idx, q) => {
        setPartSearch(s => ({ ...s, [idx]: q }));
        update(idx, 'part_name', q);
        update(idx, 'part', null);
        if (q.length < 2) { setPartResults(r => ({ ...r, [idx]: [] })); return; }
        const { ok, data } = await bomApi.getParts({ q, limit: 10 });
        if (ok && data.success) setPartResults(r => ({ ...r, [idx]: data.data }));
    };

    const handlePartSelect = (idx, part) => {
        update(idx, 'part', part.id);
        update(idx, 'part_name', part.onec_name);
        update(idx, 'unit', part.unit);
        setPartSearch(s => ({ ...s, [idx]: '' }));
        setPartResults(r => ({ ...r, [idx]: [] }));
    };

    const handleMatSearch = async (idx, q) => {
        setMatSearch(s => ({ ...s, [idx]: q }));
        update(idx, 'source_material_name', q);
        update(idx, 'source_material_id', null);
        if (q.length < 2) { setMatResults(r => ({ ...r, [idx]: [] })); return; }

        const row = rows[idx];
        const { ok, data } = await bomApi.getMaterialGroup(
            row.material_type || '',
            row.thickness ? String(row.thickness) : '',
            q,
        );
        if (ok && data.success) setMatResults(r => ({ ...r, [idx]: data.data }));
    };

    const handleMatSelect = (idx, part) => {
        update(idx, 'source_material_id', part.id);
        update(idx, 'source_material_name', part.onec_name);
        bomApi.trackPartUse(part.id);
        setMatSearch(s => ({ ...s, [idx]: undefined }));
        setMatResults(r => ({ ...r, [idx]: [] }));
    };

    const errorMap = {};
    if (validation?.errors) {
        validation.errors.forEach(e => {
            const match = e.field?.match(/^material_(\d+)$/);
            if (match) errorMap[e.part_name] = e.message;
        });
    }

    const dirty = JSON.stringify(rows) !== JSON.stringify(materials);

    return (
        <div className="space-y-3">
            {rows.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                    Нет материалов
                </p>
            ) : (
                <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table style={{ minWidth: '1000px' }} className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase
                                           border-b border-gray-100 dark:border-gray-800">
                                <th className="text-left py-2 pr-3 w-36">Пресет</th>
                                <th className="text-left py-2 pr-3">Деталь</th>
                                <th className="text-left py-2 pr-3 w-24">Чертёж</th>
                                <th className="text-left py-2 pr-3 w-24">Тип мат.</th>
                                <th className="text-left py-2 pr-3 w-28">Т×Р1×Р2</th>
                                <th className="text-left py-2 pr-3 w-16">Вес, кг</th>
                                <th className="text-left py-2 pr-3 min-w-44">Материал 1С</th>
                                <th className="text-left py-2 pr-3 w-20">Покраска, м²</th>
                                <th className="text-left py-2 pr-3 w-20">Кол-во</th>
                                <th className="text-left py-2 pr-3 w-20">Ед.</th>
                                <th className="text-left py-2 pr-3 w-10">В процессе</th>
                                {canWrite && <th className="w-6" />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => {
                                const hasError = errorMap[row.part_name];
                                // Предупреждение: есть толщина но не выбран материал 1С
                                const missingMat = row.thickness && !row.source_material_id;
                                return (
                                    <tr key={idx}
                                        className={`border-b border-gray-50 dark:border-gray-800
                                            ${hasError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>

                                        {/* Пресет */}
                                        <td className="py-1.5 pr-3">
                                            <select
                                                value={row.stage_preset_id || ''}
                                                onChange={e => update(idx, 'stage_preset_id', e.target.value || null)}
                                                disabled={!canWrite}
                                                className={`${inputCls} text-xs`}>
                                                <option value="">—</option>
                                                {presets.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Деталь с autocomplete */}
                                        <td className="py-1.5 pr-3 relative">
                                            <div className="flex items-center gap-1">
                                                {row.detail_spec && (
                                                    <span
                                                        title={
                                                            row.detail_spec_status === 'pushed'
                                                                ? 'Уже существует в 1С'
                                                                : 'Спецификация детали создана'
                                                        }
                                                        className={`text-xs shrink-0 ${row.detail_spec_status === 'pushed'
                                                            ? 'text-blue-400'   // ● уже была
                                                            : 'text-emerald-500' // ✓ создана сейчас
                                                            }`}>
                                                        {row.detail_spec_status === 'pushed' ? '●' : '✓'}
                                                    </span>
                                                )}
                                                <input
                                                    ref={el => { if (el) partRefs.current[idx] = el; }}
                                                    value={partSearch[idx] ?? row.part_name}
                                                    onChange={e => handlePartSearch(idx, e.target.value)}
                                                    disabled={!canWrite}
                                                    className={`${inputCls} ${hasError ? 'border-red-300' : ''}`}
                                                    placeholder="Наименование"
                                                />
                                            </div>
                                            <Dropdown
                                                anchorRef={{ current: partRefs.current[idx] }}
                                                items={partResults[idx] || []}
                                                onSelect={part => handlePartSelect(idx, part)}
                                                renderItem={part => (
                                                    <div>
                                                        <div className="text-gray-900 dark:text-white">{part.onec_name}</div>
                                                        {part.sku && <div className="text-gray-400 text-[10px]">{part.sku}</div>}
                                                    </div>
                                                )}
                                            />
                                        </td>

                                        {/* Чертёж — readonly */}
                                        <td className="py-1.5 pr-3">
                                            <span className="text-xs text-gray-400">{row.drawing_number || '—'}</span>
                                        </td>

                                        {/* Тип материала — readonly */}
                                        <td className="py-1.5 pr-3">
                                            <span className="text-xs text-gray-500">{row.material_type || '—'}</span>
                                        </td>

                                        {/* Размеры — readonly */}
                                        <td className="py-1.5 pr-3">
                                            {row.thickness ? (
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                    {row.thickness}×{row.size1}×{row.size2}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                            )}
                                        </td>

                                        {/* Вес — readonly если есть thickness (считается автоматически), иначе редактируемый */}
                                        <td className="py-1.5 pr-3">
                                            {row.thickness ? (
                                                row.weight_calc ? (
                                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                        {parseFloat(row.weight_calc).toFixed(3)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                )
                                            ) : (
                                                <input
                                                    type="number" min={0} step="0.001"
                                                    value={row.weight_calc || ''}
                                                    onChange={e => update(idx, 'weight_calc', e.target.value || null)}
                                                    disabled={!canWrite}
                                                    placeholder="0.000"
                                                    className={inputCls}
                                                />
                                            )}
                                        </td>

                                        {/* Материал 1С — autocomplete, всегда активно */}
                                        <td className="py-1.5 pr-3 relative">
                                            <MaterialCombobox
                                                row={row}
                                                idx={idx}
                                                canWrite={canWrite || canView}
                                                onSelect={handleMatSelect}
                                                matRefs={matRefs}
                                            />
                                        </td>

                                        {/* Площадь покраски */}
                                        <td className="py-1.5 pr-3">
                                            <input
                                                type="number" min={0} step="0.0001"
                                                value={row.paint_area || ''}
                                                onChange={e => update(idx, 'paint_area', e.target.value || null)}
                                                disabled={!canWrite}
                                                placeholder="0.0000"
                                                className={inputCls}
                                            />
                                        </td>

                                        {/* Количество */}
                                        <td className="py-1.5 pr-3">
                                            <input
                                                type="number" min={0} step="0.001"
                                                value={row.quantity}
                                                onChange={e => update(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                disabled={!canWrite}
                                                className={inputCls}
                                            />
                                        </td>

                                        {/* Единица */}
                                        <td className="py-1.5 pr-3">
                                            <select
                                                value={row.unit}
                                                onChange={e => update(idx, 'unit', e.target.value)}
                                                disabled={!canWrite}
                                                className={`${inputCls} text-xs min-w-full`}>
                                                <option value="">—</option>
                                                {units.map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                                {/* Если текущее значение не в списке — показываем его */}
                                                {row.unit && !units.includes(row.unit) && (
                                                    <option value={row.unit}>{row.unit}</option>
                                                )}
                                            </select>
                                        </td>

                                        {/* В процессе */}
                                        <td className="py-1.5 pr-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={row.in_process}
                                                onChange={e => update(idx, 'in_process', e.target.checked)}
                                                disabled={!canWrite}
                                                className="w-4 h-4 rounded"
                                            />
                                        </td>

                                        {canWrite && (
                                            <td className="py-1.5">
                                                <button onClick={() => removeRow(idx)}
                                                    className="text-gray-300 dark:text-gray-600
                                                               hover:text-red-500 transition-colors
                                                               text-base leading-none">
                                                    ×
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Липкая нижняя панель действий */}
            {(canWrite || canView) && (
                <div className="sticky bottom-0 left-0 right-0 -mx-4 -mb-4 mt-2
                                bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md
                                border-t border-gray-100 dark:border-gray-800
                                p-4 flex items-center justify-between z-20
                                rounded-b-lg shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                                   text-blue-600 dark:text-blue-400 hover:bg-blue-50 
                                   dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                        <span className="text-lg leading-none">+</span>
                        Добавить материал
                    </button>

                    <div className="flex items-center gap-4">
                        {canWrite && (
                            <>
                                {dirty && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                                        Есть несохраненные изменения
                                    </span>
                                )}
                                <button
                                    onClick={() => onSave(rows)}
                                    disabled={saving || !dirty}
                                    className={`px-6 py-2 text-sm font-semibold rounded-lg shadow-sm
                            transition-all duration-200
                            ${dirty
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white scale-105'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-gray-400 cursor-not-allowed'
                                        }
                            disabled:opacity-50`}
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Сохранение...
                                        </span>
                                    ) : 'Сохранить изменения'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}