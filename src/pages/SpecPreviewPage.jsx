import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/catalog';

export default function SpecPreviewPage({ productIds, onBack, onOpenEditor }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Какие группы колонок показывать
    const [showParams, setShowParams] = useState(true);
    const [showSpecs, setShowSpecs] = useState(true);
    const [showDocs, setShowDocs] = useState(true);

    useEffect(() => {
        if (!productIds?.length) return;
        setLoading(true);
        setError(null);
        catalogApi.previewBulk(productIds)
            .then(({ ok, data }) => {
                if (ok && data.success) setData(data.data);
                else setError(data.error || 'Ошибка загрузки');
            })
            .catch(() => setError('Ошибка сети'))
            .finally(() => setLoading(false));
    }, [productIds]);

    if (loading) return (
        <div className="flex items-center justify-center py-24
                        text-gray-400 dark:text-gray-500 text-sm">
            Загрузка...
        </div>
    );

    if (error) return (
        <div className="max-w-4xl mx-auto space-y-4">
            <button onClick={onBack}
                className="text-sm text-gray-500 dark:text-gray-400
                           hover:text-gray-700 dark:hover:text-gray-300">
                ← Назад
            </button>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4
                            text-red-600 dark:text-red-400 text-sm">
                {error}
            </div>
        </div>
    );

    if (!data) return null;

    const { axes, definitions, products } = data;

    // Собираем все типы документов из всех товаров
    const docTypes = [];
    const seenDocTypes = new Set();
    products.forEach(p => {
        p.documents.forEach(d => {
            if (!seenDocTypes.has(d.doc_type_code)) {
                seenDocTypes.add(d.doc_type_code);
                docTypes.push({ code: d.doc_type_code, name: d.doc_type });
            }
        });
    });

    const hasImages = products.some(p => p.images.length > 0);

    return (
        <div className="space-y-4">

            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack}
                        className="text-sm text-gray-500 dark:text-gray-400
                                   hover:text-gray-700 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Просмотр товаров
                        </h1>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {products.length} изделий
                            {axes.length > 0 && ` · ${axes.length} параметров`}
                            {definitions.length > 0 && ` · ${definitions.length} характеристик`}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Переключатели групп колонок */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {axes.length > 0 && (
                            <button
                                onClick={() => setShowParams(o => !o)}
                                className={`px-3 py-1 rounded text-xs transition-colors ${
                                    showParams
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                Параметры
                            </button>
                        )}
                        {definitions.length > 0 && (
                            <button
                                onClick={() => setShowSpecs(o => !o)}
                                className={`px-3 py-1 rounded text-xs transition-colors ${
                                    showSpecs
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                Характеристики
                            </button>
                        )}
                        {(docTypes.length > 0 || hasImages) && (
                            <button
                                onClick={() => setShowDocs(o => !o)}
                                className={`px-3 py-1 rounded text-xs transition-colors ${
                                    showDocs
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                Документы
                            </button>
                        )}
                    </div>

                    {onOpenEditor && (
                        <button
                            onClick={() => onOpenEditor(productIds)}
                            className="px-4 py-2 text-sm font-medium rounded-lg
                                       bg-violet-600 hover:bg-violet-700 text-white
                                       transition-colors">
                            ✎ Редактировать
                        </button>
                    )}
                </div>
            </div>

            {/* Таблица */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            {/* Название */}
                            <th className="text-left px-4 py-3 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide
                                           sticky left-0 bg-white dark:bg-gray-900 z-10 min-w-48
                                           border-r border-gray-100 dark:border-gray-800">
                                Изделие
                            </th>

                            {/* Параметры осей */}
                            {showParams && axes.map(axis => (
                                <th key={axis.id}
                                    className="px-3 py-3 text-xs font-medium text-left
                                               text-blue-500 dark:text-blue-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28
                                               border-r border-gray-100 dark:border-gray-800">
                                    {axis.name}
                                </th>
                            ))}

                            {/* Разделитель */}
                            {showParams && showSpecs && definitions.length > 0 && axes.length > 0 && (
                                <th className="w-px bg-gray-200 dark:bg-gray-700 p-0" />
                            )}

                            {/* Характеристики */}
                            {showSpecs && definitions.map(def => (
                                <th key={def.id}
                                    className="px-3 py-3 text-xs font-medium text-left
                                               text-gray-500 dark:text-gray-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28">
                                    {def.display_name}
                                </th>
                            ))}

                            {/* Документы */}
                            {showDocs && docTypes.map(dt => (
                                <th key={dt.code}
                                    className="px-3 py-3 text-xs font-medium text-left
                                               text-emerald-600 dark:text-emerald-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28">
                                    {dt.name}
                                </th>
                            ))}
                            {showDocs && hasImages && (
                                <th className="px-3 py-3 text-xs font-medium text-left
                                               text-emerald-600 dark:text-emerald-400
                                               uppercase tracking-wide whitespace-nowrap min-w-20">
                                    Фото
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {products.map((product, idx) => (
                            <tr key={product.id}
                                className={`border-b border-gray-100 dark:border-gray-800
                                    ${idx % 2 === 0
                                        ? ''
                                        : 'bg-gray-50/50 dark:bg-gray-800/30'}`}>

                                {/* Название */}
                                <td className="px-4 py-2 sticky left-0 z-10
                                               bg-white dark:bg-gray-900
                                               text-gray-900 dark:text-white font-medium
                                               border-r border-gray-100 dark:border-gray-800">
                                    <div>{product.name}</div>
                                    {product.sku && (
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {product.sku}
                                        </div>
                                    )}
                                </td>

                                {/* Параметры */}
                                {showParams && axes.map(axis => (
                                    <td key={axis.id}
                                        className="px-3 py-2 text-gray-700 dark:text-gray-300
                                                   border-r border-gray-100 dark:border-gray-800">
                                        {product.params[axis.id] ?? (
                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                        )}
                                    </td>
                                ))}

                                {/* Разделитель */}
                                {showParams && showSpecs && definitions.length > 0 && axes.length > 0 && (
                                    <td className="w-px bg-gray-200 dark:bg-gray-700 p-0" />
                                )}

                                {/* Характеристики */}
                                {showSpecs && definitions.map(def => {
                                    const spec = product.specs[def.id];
                                    return (
                                        <td key={def.id}
                                            className="px-3 py-2">
                                            {spec?.value ? (
                                                <span className={
                                                    spec.is_manual
                                                        ? 'text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                }>
                                                    {spec.value}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* Документы */}
                                {showDocs && docTypes.map(dt => {
                                    const doc = product.documents.find(
                                        d => d.doc_type_code === dt.code
                                    );
                                    return (
                                        <td key={dt.code} className="px-3 py-2">
                                            {doc?.files.length ? (
                                                <div className="space-y-0.5">
                                                    {doc.files.map(fname => (
                                                        <DocFileLink
                                                            key={fname}
                                                            folder={doc.folder_path}
                                                            fname={fname}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* Фото */}
                                {showDocs && hasImages && (
                                    <td className="px-3 py-2">
                                        {product.images.length > 0 ? (
                                            <span className="text-xs text-emerald-600
                                                             dark:text-emerald-400">
                                                {product.images.length} фото
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Легенда */}
            <div className="flex items-center gap-4 px-1 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 inline-block" />
                    Введено вручную
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 inline-block" />
                    Из 1С
                </span>
            </div>
        </div>
    );
}

// Кнопка скачивания одного файла
function DocFileLink({ folder, fname }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { mediaApi } = await import('../api/media');
            const res = await mediaApi.downloadFile(`${folder}/${fname}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400
                       hover:text-blue-800 dark:hover:text-blue-300
                       disabled:opacity-50 transition-colors">
            <span>{loading ? '···' : '↓'}</span>
            <span className="truncate max-w-32" title={fname}>{fname}</span>
        </button>
    );
}