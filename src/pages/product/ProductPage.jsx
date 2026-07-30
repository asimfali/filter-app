import { useState, useEffect } from 'react';
import { tokenStorage } from '../../api/auth';
import { mediaApi } from '../../api/media';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { can } from '../../utils/permissions';
import { useDocTypes } from '../../hooks/useDocUpload';
import DocTypeSelector from '../../components/media/DocTypeSelector';
import ImageSlider from '../../components/media/ImageSlider';
import ProductStages from '../../components/plm/ProductStages';
import LiteraSelector from '../../components/plm/LiteraSelector';
import { useProductStages } from '../../hooks/useBatchStages';
import ProductThreads from './ProductThreads';
import { ProductDocumentGroup, ProductDocDropZone } from './ProductDocuments';
import HeatExchangerSection from './HeatExchangerSection';
import AccessoriesSection from './AccessoriesSection';
import SpecsSection from './SpecsSection';

const API_BASE = '/api/v1/catalog';

// ── Карточка товара ───────────────────────────────────────────────────────

export default function ProductPage({ productId, onBack, onOpenThread, onOpenViewer }) {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { stages, selectedStage, setSelectedStage } = useProductStages(productId);

    const { user } = useAuth();
    const { docTypes, activeDocType: activeUploadDocType, setActiveDocType: setActiveUploadDocType } = useDocTypes(user);

    const { activeCartId, addToCart } = useCart();
    const canSales = can(user, 'sales.cart.write');
    const [addingToCart, setAddingToCart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);

    useEffect(() => {
        if (!productId) return;
        setLoading(true);
        setError(null);

        fetch(`${API_BASE}/products/${productId}/card/`, {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) setProduct(data.data);
                else setError('Ошибка загрузки');
            })
            .catch(() => setError('Ошибка сети'))
            .finally(() => setLoading(false));
    }, [productId]);

    const handleAddToCart = async () => {
        if (!activeCartId || !product) return;
        setAddingToCart(true);
        await addToCart(product.id, 1);
        setAddingToCart(false);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handleProductDocUploaded = async (docTypeCode, docTypeId) => {
        const { ok, data } = await mediaApi.getProductDocuments(productId, docTypeId);
        if (ok && data.success) {
            const files = data.data?.[0]?.current || [];
            // Обновляем product.documents в state
            setProduct(prev => {
                const existing = prev.documents.find(d => d.doc_type_code === docTypeCode);
                if (existing) {
                    return {
                        ...prev,
                        documents: prev.documents.map(d =>
                            d.doc_type_code === docTypeCode
                                ? {
                                    ...d, files: [...d.files, ...files.filter(f =>
                                        !d.files.find(ef => ef.rel_path === f.rel_path)
                                    )]
                                }
                                : d
                        ),
                    };
                }
                // Новый тип — добавляем группу
                return {
                    ...prev,
                    documents: [...prev.documents, {
                        doc_type: activeUploadDocType?.name,
                        doc_type_code: docTypeCode,
                        files,
                    }],
                };
            });
        }
    };

    const handleSpecSaved = (specId, value) => {
        setProduct(prev => ({
            ...prev,
            specs: prev.specs.map(s =>
                s.id === specId ? { ...s, value, is_manual: true } : s
            ),
        }));
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24
                        text-gray-400 dark:text-gray-500 text-sm">
            Загрузка...
        </div>
    );

    if (error) return (
        <div className="max-w-3xl mx-auto">
            <button onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-700
                           dark:hover:text-gray-300 mb-4">
                ← Назад
            </button>
            <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">{error}</div>
        </div>
    );

    if (!product) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-4">

            {/* Шапка */}
            <div className="flex items-start gap-4">
                <button
                    onClick={onBack}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700
                               dark:hover:text-gray-300 mt-1 shrink-0"
                >
                    ← Назад
                </button>
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {product.name}
                    </h1>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {product.product_type}
                        {product.sku && <> · <span className="font-mono">{product.sku}</span></>}
                    </div>
                </div>
            </div>

            {canSales && activeCartId && (
                <button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="ml-auto shrink-0 px-4 py-2 text-sm font-medium rounded-lg
                       bg-emerald-600 hover:bg-emerald-700
                       disabled:opacity-50 text-white transition-colors">
                    {addedToCart ? '✓ Добавлено' : addingToCart ? '...' : '+ В корзину'}
                </button>
            )}

            {/* Галерея — вверху, до всего остального */}
            <ImageSlider images={product.images || []} />

            {/* Статусы подразделений */}
            {product.department_statuses.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide mb-3">
                        Статусы подразделений
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {product.department_statuses.map(ds => (
                            <span
                                key={ds.department_code}
                                className="inline-flex items-center gap-1.5 px-3 py-1
                                           rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: ds.color }}
                            >
                                {ds.department} — {ds.status}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {stages.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide">
                            Стадии (PLM)
                        </div>
                        <LiteraSelector
                            stages={stages}
                            selected={selectedStage}
                            onChange={setSelectedStage}
                            showAll={false}
                        />
                    </div>
                    {selectedStage && (
                        <ProductStages
                            stages={[selectedStage]}
                            productId={productId}
                            onStageChange={(updated) => {
                                // Обновляем только выбранную стадию
                                const updatedStage = updated.find(s => s.id === selectedStage.id);
                                if (updatedStage) setSelectedStage(updatedStage);
                            }}
                        />
                    )}
                </div>
            )}

            {/* Параметры */}
            {product.parameters.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide mb-3">
                        Параметры
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        {product.parameters.map(p => (
                            <div key={p.axis_code} className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">{p.axis_name}</span>
                                <span className="text-gray-900 dark:text-white font-medium">{p.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Теплообменник */}
            <HeatExchangerSection heatExchangers={product.heat_exchangers} />

            <AccessoriesSection accessories={product.accessories} />

            <SpecsSection specs={product.specs} onSpecSaved={handleSpecSaved} />

            {/* Замечания */}
            {product.external_id && (
                <ProductThreads
                    externalId={product.external_id}
                    onOpenThread={onOpenThread}
                />
            )}

            {/* Документы */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                        uppercase tracking-wide">
                        Документы
                    </div>
                    {/* Переключатель типа для загрузки */}
                    {docTypes.length > 0 && (
                        <DocTypeSelector
                            docTypes={docTypes}
                            activeDocType={activeUploadDocType}
                            onSelect={setActiveUploadDocType}
                            hint="Загрузить:"
                        />
                    )}
                </div>

                {/* Drop-зона */}
                {activeUploadDocType && (
                    <ProductDocDropZone
                        product={product}
                        docType={activeUploadDocType}
                        onUploaded={handleProductDocUploaded}
                    />
                )}

                {/* Список документов */}
                {product.documents && product.documents.length > 0 ? (
                    <div className="space-y-3 mt-3">
                        {product.documents.map(group => (
                            <ProductDocumentGroup
                                key={group.doc_type_code}
                                group={group}
                                onOpenViewer={onOpenViewer}
                                product={product}
                                docTypes={docTypes}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Документов пока нет
                    </p>
                )}
            </div>

        </div>
    );
}
