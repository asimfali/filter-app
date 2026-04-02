import React, { useState, useEffect } from 'react';
import { tokenStorage } from '../api/auth';
import { getThreadsByProduct } from '../api/issues.js';
import { useAuth } from '../contexts/AuthContext';
import { mediaApi } from '../api/media';
import AccessTokenModal from '../components/media/AccessTokenModal';
import { canPreview3D } from '../utils/fileUtils';
import { can } from '../utils/permissions';
import { useDocTypes } from '../hooks/useDocUpload';
import DocTypeSelector from '../components/media/DocTypeSelector';
import { plmApi } from '../api/plm';
import ProductStages from '../components/plm/ProductStages';
import LiteraSelector from '../components/plm/LiteraSelector';
import { useProductStages } from '../hooks/useBatchStages';

const API_BASE = '/api/v1/catalog';

// ── Авторизованные изображения ────────────────────────────────────────────

function useAuthImage(relPath) {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        if (!relPath) return;
        let objectUrl = null;

        fetch(
            `/api/v1/media/download/?path=${encodeURIComponent(relPath)}`,
            { headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` } }
        )
            .then(r => r.ok ? r.blob() : null)
            .then(blob => {
                if (!blob) return;
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            })
            .catch(() => { });

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [relPath]);

    return src;
}

function AuthImage({ relPath, alt, className }) {
    const src = useAuthImage(relPath);
    if (!src) return (
        <div className={`${className} bg-neutral-100 dark:bg-neutral-800 animate-pulse`} />
    );
    return <img src={src} alt={alt} className={className} />;
}

// ── Слайдер изображений ───────────────────────────────────────────────────

function ImageSlider({ images }) {
    const [current, setCurrent] = useState(0);

    const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
    const next = () => setCurrent(i => (i + 1) % images.length);

    if (!images || images.length === 0) return null;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
            {/* Основное изображение */}
            <div className="relative bg-neutral-100 dark:bg-neutral-800" style={{ height: 320 }}>
                <AuthImage
                    relPath={images[current].rel_path}
                    alt={images[current].name}
                    className="w-full h-full object-contain"
                />

                {images.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="absolute left-3 top-1/2 -translate-y-1/2
                                       bg-black/30 hover:bg-black/50 text-white
                                       rounded-full w-8 h-8 flex items-center justify-center
                                       transition-colors text-lg"
                        >
                            ‹
                        </button>
                        <button
                            onClick={next}
                            className="absolute right-3 top-1/2 -translate-y-1/2
                                       bg-black/30 hover:bg-black/50 text-white
                                       rounded-full w-8 h-8 flex items-center justify-center
                                       transition-colors text-lg"
                        >
                            ›
                        </button>
                        <div className="absolute bottom-3 right-3 bg-black/40 text-white
                                        text-xs px-2 py-1 rounded-full">
                            {current + 1} / {images.length}
                        </div>
                    </>
                )}
            </div>

            {/* Миниатюры */}
            {images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto">
                    {images.map((img, i) => (
                        <button
                            key={img.rel_path}
                            onClick={() => setCurrent(i)}
                            className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden
                                        border-2 transition-colors ${i === current
                                    ? 'border-blue-500'
                                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <AuthImage
                                relPath={img.rel_path}
                                alt={img.name}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const STATUS_LABEL = {
    open: 'Открыто',
    in_progress: 'В работе',
    resolved: 'Решено',
    verified: 'Подтверждено ✓',
    rejected: 'Отклонено',
};

const STATUS_COLOR = {
    open: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    resolved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// ── Замечания ─────────────────────────────────────────────────────────────

function ProductThreads({ externalId, onOpenThread }) {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({}); // { [thread_id]: bool }

    useEffect(() => {
        if (!externalId) return;
        getThreadsByProduct(externalId)
            .then(data => setThreads(data?.results ?? data ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [externalId]);

    if (loading || threads.length === 0) return null;

    const toggleThread = (id) =>
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Замечания
            </div>
            <div className="flex flex-col gap-2">
                {threads.map(thread => {
                    const isExpanded = expanded[thread.id];
                    const issues = thread.issues_summary ?? [];
                    return (
                        <div key={thread.id}
                            className="border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
                            {/* Шапка треда */}
                            <div
                                className="flex items-center justify-between px-3 py-2.5
                                           hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                                onClick={() => toggleThread(thread.id)}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium text-gray-900
                                                     dark:text-gray-100 truncate">
                                        {thread.title}
                                    </span>
                                    {thread.open_issues_count > 0 && (
                                        <span className="text-xs bg-orange-100 text-orange-600
                                                         dark:bg-orange-900/40 dark:text-orange-300
                                                         px-1.5 py-0.5 rounded-full shrink-0">
                                            {thread.open_issues_count} открытых
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${thread.is_closed
                                        ? 'bg-neutral-100 text-gray-400 dark:bg-neutral-800'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                        }`}>
                                        {thread.is_closed ? 'Закрыт' : 'Активен'}
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); onOpenThread(thread.id); }}
                                        className="text-xs text-blue-500 hover:text-blue-600
                                                   dark:hover:text-blue-400 transition-colors">
                                        Открыть →
                                    </button>
                                    <span className="text-gray-300 dark:text-gray-600 text-xs">
                                        {isExpanded ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Список замечаний */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-800
                                                divide-y divide-gray-50 dark:divide-gray-800/50">
                                    {issues.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-3 py-2">
                                            Замечаний нет
                                        </p>
                                    ) : (
                                        issues.map(issue => (
                                            <div key={issue.id}
                                                className="flex items-center justify-between
                                                            px-3 py-2 gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-mono text-gray-400
                                                                     shrink-0">
                                                        #{issue.number}
                                                    </span>
                                                    <span className="text-sm text-gray-700
                                                                     dark:text-gray-300 truncate">
                                                        {issue.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {issue.created_by_name && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                                                            {issue.created_by_name} →
                                                        </span>
                                                    )}
                                                    {issue.assigned_to_department_name && (
                                                        <span className="text-xs text-gray-400
                                                                         dark:text-gray-500 hidden sm:block">
                                                            → {issue.assigned_to_department_name}
                                                        </span>
                                                    )}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full
                                                                      font-medium ${STATUS_COLOR[issue.status]}`}>
                                                        {STATUS_LABEL[issue.status]}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Группа документов ─────────────────────────────────────────────────────

function ProductDocumentGroup({ group, onOpenViewer, product, docTypes }) {
    const { user } = useAuth();
    const [showTokenModal, setShowTokenModal] = useState(false);

    const docType = docTypes?.find(dt => dt.code === group.doc_type_code);
    const canManageAccess = docType ? can(user, docType.upload_permission_code) : false;

    const handleDownload = async (relPath, fileName) => {
        const name = fileName.toLowerCase();
        if (canPreview3D(name)) {
            onOpenViewer?.({ relPath, fname: fileName, mtlPath: null });
            return;
        }
        const res = await fetch(
            `/api/v1/media/download/?path=${encodeURIComponent(relPath)}`,
            { headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` } }
        );
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs text-gray-400 dark:text-gray-500">
                    {group.doc_type}
                </div>
                {canManageAccess && (
                    <button
                        onClick={() => setShowTokenModal(true)}
                        className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                        title="Управление доступом"
                    >
                        🔑 Доступ
                    </button>
                )}
            </div>

            <div className="space-y-1">
                {group.files.map(file => (
                    <button
                        key={file.rel_path}
                        onClick={() => handleDownload(file.rel_path, file.name)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2
                                   rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800
                                   transition-colors group"
                    >
                        <svg className="w-4 h-4 text-red-400 shrink-0"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                                   a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                            {file.name}
                        </span>
                        <span className="text-xs text-blue-500 opacity-0
                                         group-hover:opacity-100 transition-opacity shrink-0">
                            {canPreview3D(file.name) ? 'Открыть ◈' : 'Скачать ↓'}
                        </span>
                    </button>
                ))}
            </div>

            {showTokenModal && docType && (
                <AccessTokenModal
                    product={product}
                    docType={docType}
                    onClose={() => setShowTokenModal(false)}
                />
            )}
        </div>
    );
}

function ProductDocDropZone({ product, docType, onUploaded }) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFile = async (file) => {
        if (!file) return;
        setUploading(true);
        setResult(null);

        try {
            const { ok, data } = await mediaApi.uploadProductDocument(
                docType.id,
                product.id,
                file,
            );
            if (ok && data.success) {
                if (data.converting) {
                    setResult({ ok: true, message: 'STEP загружен — конвертация ~30 сек, обновите страницу' });
                } else {
                    setResult({ ok: true, message: `✓ ${file.name}` });
                    await onUploaded(docType.code, docType.id);
                }
            }
        } catch {
            setResult({ ok: false, message: 'Ошибка сети' });
        } finally {
            setUploading(false);
            setTimeout(() => setResult(null), 3000);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => document.getElementById('product-doc-input').click()}
            className={`relative border-2 border-dashed rounded-lg px-4 py-3
                        text-center cursor-pointer transition-colors
                        ${dragging
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                }`}
        >
            <input
                id="product-doc-input"
                type="file"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
            />
            {uploading ? (
                <span className="text-xs text-gray-400 animate-pulse">Загрузка...</span>
            ) : result ? (
                <span className={`text-xs ${result.ok
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500'}`}>
                    {result.message}
                </span>
            ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    Перетащите или кликните для загрузки
                    <span className="ml-1 text-emerald-500">
                        {docType.name}
                    </span>
                </span>
            )}
        </div>
    );
}

// ── Карточка товара ───────────────────────────────────────────────────────

export default function ProductPage({ productId, onBack, onOpenThread, onOpenViewer }) {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [editingSpecId, setEditingSpecId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const { stages, selectedStage, setSelectedStage } = useProductStages(productId);

    const { user } = useAuth();
    const { docTypes, activeDocType: activeUploadDocType, setActiveDocType: setActiveUploadDocType } = useDocTypes(user);

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

    const handleEditStart = (spec) => {
        setEditingSpecId(spec.id);
        setEditValue(spec.value);
        setSaveError(null);
    };

    const handleEditCancel = () => {
        setEditingSpecId(null);
        setEditValue('');
        setSaveError(null);
    };

    const handleProductDocUploaded = async (docTypeCode, docTypeId) => {
        const { ok, data } = await mediaApi.getProductDocuments(productId, docTypeId);
        if (ok && data.success) {
            const files = data.data?.[0]?.current || [];
            setPrivateDocsCache(prev => ({
                ...prev,
                [docTypeCode]: files,
            }));
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

    const handleEditSave = async (spec) => {
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch(`${API_BASE}/product-specs/${spec.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenStorage.getAccess()}`,
                },
                body: JSON.stringify({ value: editValue }),
            });
            const data = await res.json();
            if (res.ok) {
                setProduct(prev => ({
                    ...prev,
                    specs: prev.specs.map(s =>
                        s.id === spec.id ? { ...s, value: editValue, is_manual: true } : s
                    ),
                }));
                setEditingSpecId(null);
            } else {
                setSaveError(data.detail || 'Ошибка сохранения');
            }
        } catch {
            setSaveError('Ошибка сети');
        } finally {
            setSaving(false);
        }
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

            {/* Характеристики */}
            {product.specs.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide mb-3">
                        Характеристики
                    </div>
                    <div className="space-y-2">
                        {product.specs.map(spec => (
                            <div key={spec.id}
                                className="flex items-center justify-between text-sm gap-4">
                                <span className="text-gray-500 dark:text-gray-400 shrink-0">
                                    {spec.definition_name}
                                    {spec.is_manual && (
                                        <span className="ml-1.5 text-xs text-violet-500"
                                            title="Введено вручную">✎</span>
                                    )}
                                </span>

                                {editingSpecId === spec.id ? (
                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleEditSave(spec);
                                                if (e.key === 'Escape') handleEditCancel();
                                            }}
                                            autoFocus
                                            className="border border-blue-400 rounded px-2 py-0.5
                                                       text-sm bg-white dark:bg-neutral-800
                                                       text-gray-900 dark:text-white
                                                       focus:outline-none focus:ring-1
                                                       focus:ring-blue-500 w-32"
                                        />
                                        <button
                                            onClick={() => handleEditSave(spec)}
                                            disabled={saving}
                                            className="text-xs text-white bg-blue-600 hover:bg-blue-700
                                                       disabled:opacity-50 px-2 py-1 rounded
                                                       transition-colors"
                                        >
                                            {saving ? '...' : 'Сохранить'}
                                        </button>
                                        <button
                                            onClick={handleEditCancel}
                                            className="text-xs text-gray-500 hover:text-gray-700
                                                       dark:hover:text-gray-300"
                                        >
                                            Отмена
                                        </button>
                                        {saveError && (
                                            <span className="text-xs text-red-500">{saveError}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-900 dark:text-white font-medium">
                                            {spec.value}
                                        </span>
                                        {spec.can_edit && (
                                            <button
                                                onClick={() => handleEditStart(spec)}
                                                className="text-xs text-gray-400 hover:text-blue-500
                                                           dark:hover:text-blue-400 transition-colors"
                                                title="Редактировать"
                                            >
                                                ✎
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

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