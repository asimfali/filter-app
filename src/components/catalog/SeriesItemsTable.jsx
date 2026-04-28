import React, { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalog';
import SmartSelect from '../common/SmartSelect';

// Цвета для значений оси heating
const HEATING_COLORS = {
    E: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    W: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    A: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    G: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const cellCls = `w-full text-xs rounded border border-gray-200
    dark:border-gray-700 bg-white dark:bg-neutral-900
    text-gray-900 dark:text-white px-2 py-1
    focus:outline-none focus:border-blue-500`;

export default function SeriesItemsTable({ items, masterConfig, onAddPower, onUpdate, onRemove }) {
    const [activeLocalId, setActiveLocalId] = useState(null);

    if (!items.length) {
        return (
            <p className="text-sm text-gray-400 text-center py-8">
                Нет изделий — вернитесь назад и выберите значения
            </p>
        );
    }

    const variesAxes = masterConfig?.varies_axes || [];
    const heatingAxisCode = masterConfig?.heating_axis_code || 'heating';
    const powerNotRequired = masterConfig?.power_not_required_for || [];
    const hasNetwork = masterConfig?.has_network ?? true;
    const hasPower = masterConfig?.has_power ?? true;

    const gridStyle = buildGridStyle(variesAxes, hasNetwork, hasPower);

    const readyCount = items.filter(item => {
        const heatingVal = item.comboMap?.[heatingAxisCode]?.value;
        const needsPower = hasPower && !powerNotRequired.includes(heatingVal);
        return !needsPower || item.power;
    }).length;

    const hasEmpty = items.some(item => {
        const heatingVal = item.comboMap?.[heatingAxisCode]?.value;
        return hasPower && !powerNotRequired.includes(heatingVal) && !item.power;
    });

    return (
        <div className="space-y-1 overflow-x-auto">
            {/* Шапка */}
            <div style={gridStyle} className="px-3 py-1">
                {variesAxes.map(code => (
                    <span key={code} className="text-xs text-gray-400">
                        {masterConfig?.axes?.[code]?.name || code}
                    </span>
                ))}
                {hasNetwork && <span className="text-xs text-gray-400">Сеть</span>}
                {hasPower && <span className="text-xs text-gray-400">Мощность</span>}
                <span className="text-xs text-gray-400">Название</span>
                <span />
            </div>

            {items.map(item => {
                const heatingVal = item.comboMap?.[heatingAxisCode]?.value;
                const needsPower = hasPower && !powerNotRequired.includes(heatingVal);
                const isEmpty = needsPower && !item.power;

                return (
                    <div
                        key={item.localId}
                        style={gridStyle}
                        className={`px-3 py-2 rounded-lg items-center
                                ${isEmpty
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                : 'bg-neutral-50 dark:bg-neutral-800'
                            }`}
                    >
                        {/* Варьируемые оси */}
                        {variesAxes.map(code => {
                            const val = item.comboMap?.[code];
                            const isHeating = code === heatingAxisCode;
                            return (
                                <span key={code}
                                    className={`text-xs truncate self-center
                                            ${isHeating
                                            ? `font-medium px-1.5 py-0.5 rounded text-center
                                                   ${HEATING_COLORS[val?.value] || 'bg-gray-100 text-gray-700'}`
                                            : 'text-gray-700 dark:text-gray-300'
                                        }`}>
                                    {val?.value || '—'}
                                </span>
                            );
                        })}

                        {/* Сеть */}
                        {hasNetwork && (
                            <input
                                value={item.networkDigit ?? '0'}
                                onChange={e => onUpdate(item.localId, 'networkDigit', e.target.value)}
                                maxLength={1}
                                className={`${cellCls} text-center self-center`}
                            />
                        )}

                        {/* Мощность */}
                        {hasPower && (
                            needsPower ? (
                                <div className="flex items-center gap-1 self-center">
                                    <SmartSelect
                                        endpoint="/api/v1/catalog/power-values/"
                                        placeholder="кВт..."
                                        nameKey="name"
                                        minChars={1}
                                        allowCreate
                                        createEndpoint="/api/v1/catalog/power-values/"
                                        createPayload={(q) => ({ name: q })}
                                        value={item.power
                                            ? { id: item.power, name: `${item.power} кВт` }
                                            : null}
                                        onSelect={v => onUpdate(item.localId, 'power', v.value)}
                                        onClear={() => onUpdate(item.localId, 'power', '')}
                                        className="flex-1 min-w-0"
                                    />
                                    <button
                                        onClick={() => onAddPower(item.localId)}
                                        title="Добавить изделие с другой мощностью"
                                        className="text-blue-500 hover:text-blue-600 text-base
                                                       leading-none shrink-0">
                                        +
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400 text-center self-center">—</span>
                            )
                        )}

                        {/* Название */}
                        <input
                            value={item.name}
                            onChange={e => onUpdate(item.localId, 'name', e.target.value)}
                            className={`${cellCls} self-center`}
                        />

                        {/* Удалить */}
                        <button
                            onClick={() => onRemove(item.localId)}
                            className="text-red-400 hover:text-red-600 text-xs
                                           transition-colors self-center">
                            ✕
                        </button>
                    </div>
                );
            })}

            <div className="text-xs text-gray-400 px-3 pt-1">
                Итого: {readyCount} изделий
                {hasEmpty && (
                    <span className="text-amber-500 ml-2">· есть незаполненные мощности</span>
                )}
            </div>
        </div>
    );
}

function buildGridStyle(variesAxes, hasNetwork, hasPower) {
    const cols = [
        ...variesAxes.map(() => '60px'),
        hasNetwork ? '55px' : null,
        hasPower ? '140px' : null,
        '1fr',    // name
        '28px',   // delete
    ].filter(Boolean).join(' ');

    return {
        display: 'grid',
        gridTemplateColumns: cols,
        gap: '6px',
        alignItems: 'center',
    };
}