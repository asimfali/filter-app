import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/catalog';
import { mediaApi } from '../api/media';
import { useAuth } from '../contexts/AuthContext';
import PLMSidePanel from '../components/plm/PLMSidePanel';
import { can } from '../utils/permissions';
import { useDocTypes } from '../hooks/useDocUpload';
import DocTypeSelector from '../components/media/DocTypeSelector';
import { canPreview3D } from '../utils/fileUtils';
import { useProductDocUpload } from '../hooks/useProductDocUpload';
import LiteraSelector from '../components/plm/LiteraSelector';
import { useBatchStages } from '../hooks/useBatchStages';
import { useColumnPrefs } from '../hooks/useColumnPrefs';
import ColumnSettingsModal from '../components/catalog/ColumnSettingsModal';

export default function SpecPreviewPage({ productIds, onBack, onOpenEditor, onOpenViewer }) {
    const [data, setData] = useState(null);
    const [showColSettings, setShowColSettings] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const {
        docTypes,
        uploadDocTypes,
        viewDocTypes,      // ← добавить
        activeDocType: activeUploadDocType,
        setActiveDocType: setActiveUploadDocType
    } = useDocTypes(user);

    const { columns, loaded, toggle, reorder } = useColumnPrefs(
        'spec_preview',
        data?.axes || [],
        data?.definitions || [],
        viewDocTypes || [], 
    );

    console.log('viewDocTypes:', viewDocTypes);
console.log('uploadDocTypes:', uploadDocTypes);

    // Какие группы колонок показывать
    const [showParams, setShowParams] = useState(true);
    const [showSpecs, setShowSpecs] = useState(true);
    const [showDocs, setShowDocs] = useState(true);

    // Видимые колонки по типу
    const visibleAxes = columns.filter(c => c.type === 'axis' && c.visible);
    const visibleDefs = columns.filter(c => c.type === 'spec' && c.visible);
    const visibleDocTypes = columns.filter(c => c.type === 'docs' && c.visible);

    // Кэш частных документов: { [productId]: { [docTypeCode]: [files] } }
    const [privateDocsCache, setPrivateDocsCache] = useState({});
    const { stagesByProduct } = useBatchStages(productIds);
    // Собираем уникальные литеры по всем изделиям
    const allStages = Object.values(stagesByProduct).flat();
    const uniqueLiteras = allStages.filter(
        (s, i, arr) => arr.findIndex(x => x.litera_code === s.litera_code) === i
    );
    const [selectedLitera, setSelectedLitera] = useState('none');

    const [showPLM, setShowPLM] = useState(false);
    const canPLM = can(user, 'plm.stage.view');

    const handleLiteraChange = async (litera) => {
        setSelectedLitera(litera);
        setLoading(true);
        setError(null);

        // stage_id: null = серийные (без литеры), число = конкретная стадия
        const stageId = litera && litera !== 'none' ? litera.id : null;

        const { ok, data } = await catalogApi.previewBulk(productIds, stageId);
        if (ok && data.success) setData(data.data);
        else setError(data.error || 'Ошибка загрузки');
        setLoading(false);
    };

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

    const handleProductDocUploaded = (productId, docTypeCode, newFiles) => {
        setPrivateDocsCache(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || {}),
                [docTypeCode]: newFiles,
            },
        }));
    };

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

    const hasImages = products.some(p => p.images.length > 0);

    return (
        <div className="flex gap-4 items-start">

            {/* Основной контент */}
            <div className="flex-1 min-w-0 space-y-4">

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

                    {showDocs && (
                        <DocTypeSelector
                            docTypes={uploadDocTypes}
                            activeDocType={activeUploadDocType}
                            onSelect={setActiveUploadDocType}
                            hint="Загрузка в:"
                        />
                    )}

                    <div className="flex items-center gap-3">
                        {/* Переключатели групп колонок */}
                        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                            {axes.length > 0 && (
                                <button
                                    onClick={() => setShowParams(o => !o)}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${showParams
                                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                    Параметры
                                </button>
                            )}
                            {definitions.length > 0 && (
                                <button
                                    onClick={() => setShowSpecs(o => !o)}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${showSpecs
                                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                    Характеристики
                                </button>
                            )}
                            {(uploadDocTypes.length > 0 || hasImages) && (
                                <button
                                    onClick={() => setShowDocs(o => !o)}
                                    className={`px-3 py-1 rounded text-xs transition-colors ${showDocs
                                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
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
                        <button
                            onClick={() => setShowColSettings(true)}
                            className="px-3 py-2 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800
               text-gray-700 dark:text-gray-300 hover:bg-neutral-200
               dark:hover:bg-neutral-700 transition-colors"
                            title="Настройка колонок">
                            ⚙
                        </button>

                        {showColSettings && (
                            <ColumnSettingsModal
                                columns={columns}
                                onToggle={toggle}
                                onReorder={reorder}
                                onClose={() => setShowColSettings(false)}
                            />
                        )}
                        {uniqueLiteras.length > 0 && (
                            <LiteraSelector
                                stages={uniqueLiteras}
                                selected={selectedLitera}
                                onChange={handleLiteraChange}
                                showAll={true}
                            />
                        )}
                        {canPLM && (
                            <button
                                onClick={() => setShowPLM(v => !v)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                                ${showPLM
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-neutral-200'
                                    }`}>
                                PLM
                            </button>
                        )}
                    </div>
                </div>

                {/* Таблица */}
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                {/* Название */}
                                <th className="text-left px-4 py-3 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase tracking-wide
                                           sticky left-0 bg-white dark:bg-neutral-900 z-10 min-w-48
                                           border-r border-gray-100 dark:border-gray-800">
                                    Изделие
                                </th>

                                {/* Параметры осей */}
                                {showParams && visibleAxes.map(axis => (
                                    <th key={axis.id}
                                        className="px-3 py-3 text-xs font-medium text-left
                                               text-blue-500 dark:text-blue-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28
                                               border-r border-gray-100 dark:border-gray-800">
                                        {axis.label}
                                    </th>
                                ))}

                                {/* Разделитель */}
                                {showParams && showSpecs && visibleDefs.length > 0 && visibleAxes.length > 0 && (
                                    <th className="w-px bg-neutral-200 dark:bg-neutral-700 p-0" />
                                )}

                                {/* Характеристики */}
                                {showSpecs && visibleDefs.map(def => (
                                    <th key={def.id}
                                        className="px-3 py-3 text-xs font-medium text-left
                                               text-gray-500 dark:text-gray-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28">
                                        {def.label.includes(',')
                                            ? <>{def.label.split(',')[0]}<br /><span className="normal-case">{def.label.split(',').slice(1).join(',').trim()}</span></>
                                            : def.label
                                        }
                                    </th>
                                ))}

                                {/* Документы */}
                                {showDocs && visibleDocTypes.map(dt => (
                                    <th key={dt.id}
                                        className="px-3 py-3 text-xs font-medium text-left
                                               text-emerald-600 dark:text-emerald-400
                                               uppercase tracking-wide whitespace-nowrap min-w-28">
                                        {dt.label}
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
                                <ProductRow
                                    key={product.id}
                                    product={product}
                                    idx={idx}
                                    axes={visibleAxes}
                                    definitions={visibleDefs}
                                    uploadDocTypes={visibleDocTypes}
                                    hasImages={hasImages}
                                    showParams={showParams}
                                    showSpecs={showSpecs}
                                    showDocs={showDocs}
                                    activeUploadDocType={activeUploadDocType}
                                    privateDocsCache={privateDocsCache[product.id] || {}}
                                    onUploaded={handleProductDocUploaded}
                                    user={user}
                                    onOpenViewer={onOpenViewer}
                                    selectedLitera={selectedLitera}
                                    stagesByProduct={stagesByProduct}
                                />
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
                        <span className="w-3 h-3 rounded bg-neutral-100 dark:bg-neutral-800 inline-block" />
                        Из 1С
                    </span>
                </div>
            </div>
            {/* Боковая панель PLM */}
            {showPLM && (
                <div className="w-80 shrink-0 bg-white dark:bg-neutral-900 rounded-lg shadow
                            sticky top-4"
                    style={{ maxHeight: 'calc(100vh - 6rem)', display: 'flex', flexDirection: 'column' }}>
                    <PLMSidePanel
                        productIds={productIds}
                        products={products}
                        onClose={() => setShowPLM(false)}
                        selectedLitera={selectedLitera}
                    />
                </div>
            )}
        </div>
    );
}

function ProductRow({
    product, idx, axes, definitions, uploadDocTypes, hasImages,
    showParams, showSpecs, showDocs,
    activeUploadDocType, privateDocsCache, onUploaded, user, onOpenViewer, selectedLitera,
    stagesByProduct,
}) {
    const productStages = stagesByProduct?.[product.id] || [];

    // Фильтруем документы по выбранной литере
    const filterFilesByLitera = (files) => {
        if (!files) return [];
        if (selectedLitera === null) return files; // все литеры
        if (selectedLitera === 'none') {
            return files.filter(f => !f.litera_code); // только без литеры
        }
        // Конкретная литера
        return files.filter(f => f.litera_code === selectedLitera.litera_code);
    };
    const [draggingOver, setDraggingOver] = useState(false);

    const canUpload = activeUploadDocType
        ? can(user, activeUploadDocType.upload_permission_code)
        : false;

    const { upload, uploading, uploadResult } = useProductDocUpload({
        onUploaded: (productId, code, files) => onUploaded(productId, code, files),
    });

    const handleDragOver = (e) => {
        if (!activeUploadDocType || !canUpload) return;
        e.preventDefault();
        setDraggingOver(true);
    };

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setDraggingOver(false);
        if (!activeUploadDocType || !canUpload) return;
        const file = e.dataTransfer.files[0];
        if (!file) return;
        await upload(file, product.id, activeUploadDocType);
    };

    return (
        <tr
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-b border-gray-100 dark:border-gray-800 transition-colors
                ${draggingOver
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-400'
                    : idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-800/30'
                }`}
        >
            {/* Название */}
            <td className="px-4 py-2 sticky left-0 z-10
                           bg-white dark:bg-neutral-900
                           text-gray-900 dark:text-white font-medium
                           border-r border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <div>
                        <div>{product.name}</div>
                        {product.sku && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {product.sku}
                            </div>
                        )}
                    </div>
                    {/* Индикатор загрузки/результата */}
                    {uploading && (
                        <span className="text-xs text-gray-400 animate-pulse shrink-0">
                            Загрузка...
                        </span>
                    )}
                    {uploadResult && (
                        <span className={`text-xs shrink-0 ${uploadResult.ok
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500'
                            }`}>
                            {uploadResult.message}
                        </span>
                    )}
                </div>
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
                <td className="w-px bg-neutral-200 dark:bg-neutral-700 p-0" />
            )}

            {/* Характеристики */}
            {showSpecs && definitions.map(def => {
                const spec = product.specs[def.id];
                return (
                    <td key={def.id} className="px-3 py-2">
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

            {/* Документы — общие + частные */}
            {showDocs && uploadDocTypes.map(dt => {
                // Общие документы (из API previewBulk)
                const commonDoc = product.documents.find(d => d.doc_type_code === dt.id);
                const filteredFiles = filterFilesByLitera(commonDoc?.files || []);
                // Частные документы (загружены в этой сессии)
                const privateFiles = privateDocsCache[dt.id] || [];

                const isActiveType = activeUploadDocType?.code === dt.id;

                return (
                    <td key={dt.id}
                        className={`px-3 py-2 transition-colors
                            ${isActiveType && canUpload
                                ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                                : ''
                            }`}>
                        <div className="space-y-0.5">
                            {/* Общие файлы */}
                            {filteredFiles.map(f => (
                                <DocFileLink key={f.name + f.folder_path} folder={f.folder_path} fname={f.name} onOpenViewer={onOpenViewer} />
                            ))}
                            {/* Частные файлы (только что загруженные) */}
                            {privateFiles.map(f => (
                                <DocFileLink
                                    key={f.rel_path}
                                    folder=""
                                    fname={f.name}
                                    relPath={f.rel_path}
                                    isNew
                                    onOpenViewer={onOpenViewer}
                                />
                            ))}
                            {/* Зона drop для активного типа */}
                            {isActiveType && canUpload && !filteredFiles.length && !privateFiles.length && (
                                <span className="text-xs text-emerald-400 dark:text-emerald-600
                                                 italic">
                                    ← перетащите
                                </span>
                            )}
                            {!filteredFiles.length && !privateFiles.length && !isActiveType && (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                        </div>
                    </td>
                );
            })}

            {/* Фото */}
            {showDocs && hasImages && (
                <td className="px-3 py-2">
                    {product.images.length > 0 ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {product.images.length} фото
                        </span>
                    ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                </td>
            )}
        </tr>
    );
}

// Кнопка скачивания одного файла
function DocFileLink({ folder, fname, relPath = null, isNew = false, onOpenViewer }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async (e) => {
        e.preventDefault();
        const path = relPath || `${folder}/${fname}`;

        if (canPreview3D(fname)) {
            onOpenViewer?.({ relPath: path, fname, mtlPath: null });
            return;
        }
        setLoading(true);
        try {
            const path = relPath || `${folder}/${fname}`;
            const res = await mediaApi.downloadFile(path);
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
            className={`flex items-center gap-1 text-xs
                       hover:text-blue-800 dark:hover:text-blue-300
                       disabled:opacity-50 transition-colors
                       ${isNew
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
            <span>{loading ? '···' : '↓'}</span>
            <span className="truncate max-w-32" title={fname}>{fname}</span>
            {isNew && <span className="text-[10px] text-emerald-400">new</span>}
        </button>
    );
}