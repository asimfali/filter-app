import React from 'react';
import { inputCls } from '../../utils/styles';

const POSITION_TYPES = [
    { value: 'series_digit', label: 'Цифра серии (авто)' },
    { value: 'network', label: 'Сеть (задаётся на изделие)' },
    { value: 'axis', label: 'Ось параметра' },
];

const AXIS_CODES = [
    { value: 'length', label: 'Длина' },
    { value: 'design', label: 'Дизайн' },
    { value: 'heating', label: 'Нагрев' },
];

export default function CodePositionBuilder({
    positions,
    onPositionsChange,
    lengthValues,
    lengthMap,
    onLengthMapChange,
    designMap,
    onDesignMapChange,
    design,
}) {
    // ── Управление позициями ──────────────────────────────────────────

    const updatePosition = (pos, field, value) => {
        onPositionsChange(prev => prev.map(p =>
            p.pos === pos ? { ...p, [field]: value } : p
        ));
    };

    const addPosition = () => {
        const maxPos = Math.max(...positions.map(p => Number(p.pos)), 0);
        onPositionsChange(prev => [
            ...prev,
            { pos: String(maxPos + 1), type: 'network' },
        ]);
    };

    const removePosition = (pos) => {
        onPositionsChange(prev => prev.filter(p => p.pos !== pos));
    };

    // ── Управление маппингом длин ─────────────────────────────────────

    const addLengthMap = () => {
        onLengthMapChange(prev => [
            ...prev,
            { digit: '', valueId: '', valueLabel: '' },
        ]);
    };

    const updateLengthMap = (idx, field, value) => {
        onLengthMapChange(prev => prev.map((lm, i) => {
            if (i !== idx) return lm;
            if (field === 'valueId') {
                const found = lengthValues.find(v => v.id === Number(value));
                return { ...lm, valueId: Number(value), valueLabel: found?.value || '' };
            }
            return { ...lm, [field]: value };
        }));
    };

    const removeLengthMap = (idx) => {
        onLengthMapChange(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Управление маппингом дизайна ──────────────────────────────────

    const addDesignMap = () => {
        onDesignMapChange(prev => [
            ...prev,
            { digit: '', valueId: design?.id || '', valueLabel: design?.value || '' },
        ]);
    };

    const updateDesignMap = (idx, field, value) => {
        onDesignMapChange(prev => prev.map((dm, i) =>
            i === idx ? { ...dm, [field]: value } : dm
        ));
    };

    const removeDesignMap = (idx) => {
        onDesignMapChange(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Превью кода ───────────────────────────────────────────────────

    const previewCode = () => {
        return [...positions]
            .sort((a, b) => Number(a.pos) - Number(b.pos))
            .map(p => {
                if (p.type === 'series_digit') return '{С}';
                if (p.type === 'network') return '{N}';
                if (p.type === 'axis' && p.axis_code === 'length') return '{Д}';
                if (p.type === 'axis' && p.axis_code === 'design') return '{Диз}';
                return '?';
            }).join('');
    };

    return (
        <div className="space-y-6">
            {/* Превью */}
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">Структура кода:</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white">
                    КЭВ-<span className="text-blue-500">{'{мощность}'}</span>П
                    <span className="text-emerald-500">{previewCode()}</span>
                    <span className="text-amber-500">{'{нагрев}'}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    С=серия, N=сеть, Д=длина, Диз=дизайн
                </p>
            </div>

            {/* Позиции */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Позиции кода
                    </p>
                    <button onClick={addPosition}
                        className="text-xs text-blue-500 hover:text-blue-600">
                        + позиция
                    </button>
                </div>
                <div className="space-y-2">
                    {[...positions]
                        .sort((a, b) => Number(a.pos) - Number(b.pos))
                        .map(p => (
                            <div key={p.pos}
                                className="flex items-center gap-2 p-2 rounded-lg
                                           bg-neutral-50 dark:bg-neutral-800">
                                <span className="text-xs text-gray-400 w-6 text-center">
                                    {p.pos}
                                </span>

                                <select
                                    value={p.type}
                                    onChange={e => updatePosition(p.pos, 'type', e.target.value)}
                                    className="flex-1 text-xs rounded border border-gray-200
                                               dark:border-gray-700 bg-white dark:bg-neutral-900
                                               text-gray-900 dark:text-white px-2 py-1
                                               focus:outline-none"
                                >
                                    {POSITION_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>

                                {p.type === 'axis' && (
                                    <>
                                        <select
                                            value={p.axis_code || ''}
                                            onChange={e => updatePosition(p.pos, 'axis_code', e.target.value)}
                                            className="text-xs rounded border border-gray-200
                                                       dark:border-gray-700 bg-white dark:bg-neutral-900
                                                       text-gray-900 dark:text-white px-2 py-1
                                                       focus:outline-none"
                                        >
                                            <option value="">Ось...</option>
                                            {AXIS_CODES.map(a => (
                                                <option key={a.value} value={a.value}>{a.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={p.digits || 1}
                                            onChange={e => updatePosition(p.pos, 'digits', Number(e.target.value))}
                                            className="w-16 text-xs rounded border border-gray-200
                                                       dark:border-gray-700 bg-white dark:bg-neutral-900
                                                       text-gray-900 dark:text-white px-2 py-1
                                                       focus:outline-none"
                                        >
                                            <option value={1}>1 цифра</option>
                                            <option value={2}>2 цифры</option>
                                        </select>
                                    </>
                                )}

                                <button
                                    onClick={() => removePosition(p.pos)}
                                    disabled={positions.length <= 1}
                                    className="text-xs text-red-400 hover:text-red-600
                                               disabled:opacity-30 px-1"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                </div>
            </div>

            {/* Маппинг длин */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Маппинг длин
                    </p>
                    <button onClick={addLengthMap}
                        className="text-xs text-blue-500 hover:text-blue-600">
                        + длина
                    </button>
                </div>
                {lengthMap.length === 0 && (
                    <p className="text-xs text-gray-400">
                        Добавьте маппинг цифры кода → значение длины
                    </p>
                )}
                <div className="space-y-2">
                    {lengthMap.map((lm, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-12">Цифра:</span>
                            <input
                                value={lm.digit}
                                onChange={e => updateLengthMap(idx, 'digit', e.target.value)}
                                placeholder="3"
                                maxLength={2}
                                className="w-14 text-xs rounded border border-gray-200
                                           dark:border-gray-700 bg-white dark:bg-neutral-900
                                           text-gray-900 dark:text-white px-2 py-1
                                           focus:outline-none text-center"
                            />
                            <span className="text-xs text-gray-400">→</span>
                            <select
                                value={lm.valueId || ''}
                                onChange={e => updateLengthMap(idx, 'valueId', e.target.value)}
                                className="flex-1 text-xs rounded border border-gray-200
                                           dark:border-gray-700 bg-white dark:bg-neutral-900
                                           text-gray-900 dark:text-white px-2 py-1
                                           focus:outline-none"
                            >
                                <option value="">Длина...</option>
                                {lengthValues.map(v => (
                                    <option key={v.id} value={v.id}>{v.value} мм</option>
                                ))}
                            </select>
                            <button onClick={() => removeLengthMap(idx)}
                                className="text-xs text-red-400 hover:text-red-600 px-1">
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Маппинг дизайна */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Маппинг дизайна в коде
                    </p>
                    <button onClick={addDesignMap}
                        className="text-xs text-blue-500 hover:text-blue-600">
                        + цифра
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                    Если дизайн зашит в код — укажите цифру(ы).
                    Оставьте пустым если дизайн не в коде.
                </p>
                <div className="space-y-2">
                    {designMap.map((dm, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-12">Цифра:</span>
                            <input
                                value={dm.digit}
                                onChange={e => updateDesignMap(idx, 'digit', e.target.value)}
                                placeholder="0"
                                maxLength={2}
                                className="w-14 text-xs rounded border border-gray-200
                                           dark:border-gray-700 bg-white dark:bg-neutral-900
                                           text-gray-900 dark:text-white px-2 py-1
                                           focus:outline-none text-center"
                            />
                            <span className="text-xs text-gray-400">→</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">
                                {design?.value || '(дизайн из шага 2)'}
                            </span>
                            <button onClick={() => removeDesignMap(idx)}
                                className="text-xs text-red-400 hover:text-red-600 px-1">
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}