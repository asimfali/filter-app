import React, { useState, useEffect } from 'react';
import { catalogApi } from '../../api/catalog';
import SmartSelect from '../common/SmartSelect';

const NEEDS_POWER = ['E', 'W'];

export default function SeriesItemsTable({ items, onAddPower, onUpdate, onRemove }) {
    const [powerValues, setPowerValues] = useState([]);

    useEffect(() => {
        catalogApi.powerValues().then(({ ok, data }) => {
            if (ok && data.success) setPowerValues(data.data);
        });
    }, []);

    const handleAddPower = async (localId, newPowerStr) => {
        if (!newPowerStr) return;
        const val = parseFloat(newPowerStr);
        if (isNaN(val)) return;

        // Проверяем есть ли уже в списке
        const exists = powerValues.find(p => parseFloat(p.value) === val);
        if (!exists) {
            // Создаём через API
            const res = await fetch('/api/v1/catalog/power-values/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: JSON.stringify({ value: val, sort_order: 0 }),
            });
            const data = await res.json();
            if (data.success) {
                setPowerValues(prev => [...prev, data.data].sort((a, b) => a.value - b.value));
            }
        }
    };

    if (!items.length) {
        return (
            <p className="text-sm text-gray-400 text-center py-8">
                Нет изделий — вернитесь на шаг 3 и добавьте длины
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {/* Шапка */}
            <div className="grid grid-cols-[120px_60px_60px_120px_80px_1fr_32px] gap-2 px-3 py-1">
                {['Длина', 'Нагрев', 'Сеть', 'Мощность', 'External ID', 'Название', ''].map(h => (
                    <span key={h} className="text-xs text-gray-400">{h}</span>
                ))}
            </div>

            {items.map(item => {
                const needsPower = NEEDS_POWER.includes(item.heating?.value);
                const isEmpty = needsPower && !item.power;

                return (
                    <div key={item.localId}
                        className={`grid grid-cols-[120px_60px_60px_120px_80px_1fr_32px]
                                    gap-2 items-center px-3 py-2 rounded-lg
                                    ${isEmpty
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                : 'bg-neutral-50 dark:bg-neutral-800'
                            }`}>

                        {/* Длина */}
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                            {item.length?.value} мм
                        </span>

                        {/* Нагрев */}
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded text-center
                            ${item.heating?.value === 'E' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                            ${item.heating?.value === 'W' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                            ${item.heating?.value === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                            ${item.heating?.value === 'G' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : ''}
                        `}>
                            {item.heating?.value}
                        </span>

                        {/* Сеть */}
                        <input
                            value={item.networkDigit ?? '0'}
                            onChange={e => onUpdate(item.localId, 'networkDigit', e.target.value)}
                            maxLength={1}
                            className="w-full text-xs rounded border border-gray-200
                                       dark:border-gray-700 bg-white dark:bg-neutral-900
                                       text-gray-900 dark:text-white px-2 py-1
                                       focus:outline-none focus:border-blue-500 text-center"
                        />

                        {/* Мощность */}
                        {needsPower ? (
                            <div className="flex items-center gap-1">
                                <SmartSelect
                                    endpoint="/api/v1/catalog/power-values/"
                                    placeholder="кВт..."
                                    nameKey="name"
                                    minChars={0}
                                    allowCreate
                                    createEndpoint="/api/v1/catalog/power-values/"
                                    createPayload={(q) => ({ name: q })}
                                    value={item.power ? { id: item.power, name: `${item.power} кВт` } : null}
                                    onSelect={v => onUpdate(item.localId, 'power', v.value)}
                                    onClear={() => onUpdate(item.localId, 'power', '')}
                                    className="flex-1"
                                />
                                <button
                                    onClick={() => onAddPower(item.localId)}
                                    title="Добавить изделие с другой мощностью"
                                    className="text-blue-500 hover:text-blue-600 text-base leading-none shrink-0"
                                >
                                    +
                                </button>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-400 text-center">—</span>
                        )}

                        {/* External ID */}
                        <input
                            value={item.externalId}
                            onChange={e => onUpdate(item.localId, 'externalId', e.target.value)}
                            className="w-full text-xs rounded border border-gray-200
                                       dark:border-gray-700 bg-white dark:bg-neutral-900
                                       text-gray-900 dark:text-white px-2 py-1
                                       focus:outline-none focus:border-blue-500 font-mono"
                        />

                        {/* Название */}
                        <input
                            value={item.name}
                            onChange={e => onUpdate(item.localId, 'name', e.target.value)}
                            className="w-full text-xs rounded border border-gray-200
                                       dark:border-gray-700 bg-white dark:bg-neutral-900
                                       text-gray-900 dark:text-white px-2 py-1
                                       focus:outline-none focus:border-blue-500"
                        />

                        {/* Удалить */}
                        <button
                            onClick={() => onRemove(item.localId)}
                            className="text-red-400 hover:text-red-600 text-xs transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            <div className="text-xs text-gray-400 px-3 pt-1">
                Итого: {items.filter(i => !NEEDS_POWER.includes(i.heating?.value) || i.power).length} изделий
                {items.some(i => NEEDS_POWER.includes(i.heating?.value) && !i.power) && (
                    <span className="text-amber-500 ml-2">· есть незаполненные мощности</span>
                )}
            </div>
        </div>
    );
}