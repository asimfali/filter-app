import React, { useState, useEffect } from 'react';
import { salesApi } from '../api/sales';

export default function CartKPPage({ cartId, onBack }) {
    const [kp, setKp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!cartId) return;
        setLoading(true);
        salesApi.getKP(cartId)
            .then(({ ok, data }) => {
                if (ok && data.success) setKp(data.data);
                else setError('Ошибка загрузки КП');
            })
            .catch(() => setError('Ошибка сети'))
            .finally(() => setLoading(false));
    }, [cartId]);

    if (loading) return (
        <div className="flex items-center justify-center py-24
                        text-gray-400 dark:text-gray-500 text-sm">
            Загрузка...
        </div>
    );

    if (error) return (
        <div className="max-w-4xl mx-auto">
            <button onClick={onBack} className="text-sm text-gray-500 mb-4">← Назад</button>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4
                            text-red-600 dark:text-red-400 text-sm">{error}</div>
        </div>
    );

    if (!kp) return null;

    const { cart, manager, items, totals } = kp;

    // Считаем итоги по всем позициям включая комплектующие
    let grandTotal = 0;
    let hasAnyPrice = false;
    items.forEach(item => {
        if (item.line_total != null) { grandTotal += item.line_total; hasAnyPrice = true; }
        item.children?.forEach(acc => {
            if (acc.line_total != null) { grandTotal += acc.line_total; hasAnyPrice = true; }
        });
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6">

            {/* Шапка */}
            <div className="flex items-start justify-between">
                <button onClick={onBack}
                    className="text-sm text-gray-500 dark:text-gray-400
                               hover:text-gray-700 dark:hover:text-gray-300">
                    ← Назад
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-4 py-2 text-sm rounded-lg bg-neutral-100
                               dark:bg-neutral-800 text-gray-700 dark:text-gray-300
                               hover:bg-neutral-200 dark:hover:bg-neutral-700
                               transition-colors">
                    🖨 Печать
                </button>
            </div>

            {/* Карточка КП */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow px-6 py-5 space-y-5
                            print:shadow-none print:border print:border-gray-200">

                {/* Заголовок */}
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                        Коммерческое предложение
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {cart.name}
                    </h1>
                    {cart.client_name && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Клиент: <span className="text-gray-700 dark:text-gray-300 font-medium">
                                {cart.client_name}
                            </span>
                        </div>
                    )}
                    {cart.notes && (
                        <div className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            {cart.notes}
                        </div>
                    )}
                </div>

                {/* Менеджер */}
                <div className="flex gap-6 text-sm">
                    <div>
                        <span className="text-gray-400 dark:text-gray-500">Менеджер: </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                            {manager.name}
                        </span>
                    </div>
                    {manager.phone && (
                        <div>
                            <span className="text-gray-400 dark:text-gray-500">Тел: </span>
                            <span className="text-gray-900 dark:text-white">{manager.phone}</span>
                        </div>
                    )}
                    <div>
                        <span className="text-gray-400 dark:text-gray-500">Email: </span>
                        <span className="text-gray-900 dark:text-white">{manager.email}</span>
                    </div>
                </div>

                {/* Таблица позиций */}
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 pr-4 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-8">
                                №
                            </th>
                            <th className="text-left py-2 pr-4 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Наименование
                            </th>
                            <th className="text-right py-2 pr-4 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-16">
                                Кол-во
                            </th>
                            <th className="text-right py-2 pr-4 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-32">
                                Цена, ₽
                            </th>
                            <th className="text-right py-2 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide w-32">
                                Сумма, ₽
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {items.map((item, idx) => (
                            <React.Fragment key={item.id}>
                                {/* Основное изделие */}
                                <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                                    <td className="py-2.5 pr-4 text-gray-400 dark:text-gray-500
                                                   align-top text-xs">
                                        {idx + 1}
                                    </td>
                                    <td className="py-2.5 pr-4 align-top">
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {item.product_name}
                                        </div>
                                        {item.product_sku && (
                                            <div className="text-xs font-mono text-gray-400 mt-0.5">
                                                {item.product_sku}
                                            </div>
                                        )}
                                        {/* Параметры */}
                                        {item.parameters && Object.keys(item.parameters).length > 0 && (
                                            <div className="flex flex-wrap gap-x-3 mt-1">
                                                {Object.entries(item.parameters).map(([k, v]) => (
                                                    <span key={k}
                                                        className="text-xs text-gray-400 dark:text-gray-500">
                                                        {k}: <span className="text-gray-600
                                                                              dark:text-gray-300">{v}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2.5 pr-4 text-right align-top
                                                   text-gray-900 dark:text-white">
                                        {item.quantity}
                                    </td>
                                    <td className="py-2.5 pr-4 text-right align-top
                                                   text-gray-700 dark:text-gray-300">
                                        {item.price != null
                                            ? item.price.toLocaleString('ru-RU')
                                            : <span className="text-gray-300 dark:text-gray-600">—</span>
                                        }
                                    </td>
                                    <td className="py-2.5 text-right align-top font-medium
                                                   text-gray-900 dark:text-white">
                                        {item.line_total != null
                                            ? item.line_total.toLocaleString('ru-RU')
                                            : <span className="text-gray-300 dark:text-gray-600">—</span>
                                        }
                                    </td>
                                </tr>

                                {/* Комплектующие */}
                                {item.children?.map(acc => (
                                    <tr key={acc.id}
                                        className="bg-neutral-50/50 dark:bg-neutral-800/20">
                                        <td className="py-1.5 pr-4 text-gray-300
                                                       dark:text-gray-600 text-xs align-top">
                                        </td>
                                        <td className="py-1.5 pr-4 align-top">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-300 dark:text-gray-600
                                                                 text-xs">└</span>
                                                <span className="text-xs text-gray-600
                                                                 dark:text-gray-400">
                                                    {acc.product_name}
                                                </span>
                                                {acc.suggested_by_rule && (
                                                    <span className="text-[10px] text-blue-400">
                                                        авто
                                                    </span>
                                                )}
                                                {acc.product_sku && (
                                                    <span className="text-[10px] font-mono
                                                                     text-gray-400">
                                                        {acc.product_sku}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-1.5 pr-4 text-right align-top
                                                       text-xs text-gray-500 dark:text-gray-400">
                                            {acc.quantity}
                                        </td>
                                        <td className="py-1.5 pr-4 text-right align-top
                                                       text-xs text-gray-500 dark:text-gray-400">
                                            {acc.price != null
                                                ? acc.price.toLocaleString('ru-RU')
                                                : <span className="text-gray-300 dark:text-gray-600">—</span>
                                            }
                                        </td>
                                        <td className="py-1.5 text-right align-top
                                                       text-xs text-gray-600 dark:text-gray-300">
                                            {acc.line_total != null
                                                ? acc.line_total.toLocaleString('ru-RU')
                                                : <span className="text-gray-300 dark:text-gray-600">—</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>

                    {/* Итог */}
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                            <td colSpan={4}
                                className="pt-3 text-right text-sm font-medium
                                           text-gray-500 dark:text-gray-400 pr-4">
                                Итого:
                            </td>
                            <td className="pt-3 text-right text-base font-bold
                                           text-gray-900 dark:text-white">
                                {hasAnyPrice
                                    ? grandTotal.toLocaleString('ru-RU') + ' ₽'
                                    : <span className="text-gray-300 dark:text-gray-600
                                                       font-normal text-sm">Цены не указаны</span>
                                }
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}