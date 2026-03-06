import React, { useState, useEffect } from 'react';
import { tokenStorage } from '../api/auth';
import { getThreadsByProduct } from '../api/issues.js';

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
        <div className={`${className} bg-gray-100 dark:bg-gray-800 animate-pulse`} />
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
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {/* Основное изображение */}
            <div className="relative bg-gray-100 dark:bg-gray-800" style={{ height: 320 }}>
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
                                        border-2 transition-colors ${
                                i === current
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

// ── Замечания ─────────────────────────────────────────────────────────────

function ProductThreads({ externalId, onOpenThread }) {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!externalId) return;
        getThreadsByProduct(externalId)
            .then(data => setThreads(data?.results ?? data ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [externalId]);

    if (loading) return null;
    if (threads.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Замечания
            </div>
            <div className="flex flex-col gap-2">
                {threads.map(thread => (
                    <button
                        key={thread.id}
                        onClick={() => onOpenThread(thread.id)}
                        className="flex items-center justify-between text-left px-3 py-2
                                   rounded-lg border border-gray-100 dark:border-gray-800
                                   hover:border-blue-300 dark:hover:border-blue-700
                                   transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {thread.title}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {thread.open_issues_count > 0
                                    ? `${thread.open_issues_count} открытых замечаний`
                                    : 'Замечаний нет'}
                            </p>
                        </div>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ml-3 ${
                            thread.is_closed
                                ? 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        }`}>
                            {thread.is_closed ? 'Закрыт' : 'Активен'}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Группа документов ─────────────────────────────────────────────────────

function ProductDocumentGroup({ group }) {
    const handleDownload = async (relPath, fileName) => {
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
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                {group.doc_type}
            </div>
            <div className="space-y-1">
                {group.files.map(file => (
                    <button
                        key={file.rel_path}
                        onClick={() => handleDownload(file.rel_path, file.name)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2
                                   rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800
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
                            Скачать ↓
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Карточка товара ───────────────────────────────────────────────────────

export default function ProductPage({ productId, onBack, onOpenThread }) {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [editingSpecId, setEditingSpecId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

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
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
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

            {/* Параметры */}
            {product.parameters.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
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
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
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
                                                       text-sm bg-white dark:bg-gray-800
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
            {product.documents && product.documents.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                    uppercase tracking-wide mb-3">
                        Документы
                    </div>
                    <div className="space-y-3">
                        {product.documents.map(group => (
                            <ProductDocumentGroup
                                key={group.doc_type_code}
                                group={group}
                            />
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}