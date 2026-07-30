import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mediaApi } from '../../api/media';
import AccessTokenModal from '../../components/media/AccessTokenModal';
import { canPreview3D } from '../../utils/fileUtils';
import { can } from '../../utils/permissions';

// ── Группа документов ─────────────────────────────────────────────────────

export function ProductDocumentGroup({ group, onOpenViewer, product, docTypes }) {
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
        const res = await mediaApi.downloadFile(relPath);
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // PDF и изображения открываем в новой вкладке
        const isPdf = name.endsWith('.pdf');
        const isImage = /\.(jpg|jpeg|png|webp)$/.test(name);

        if (isPdf || isImage) {
            window.open(url, '_blank');
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
        }

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
                            {file.name.replace(/\.[^.]+$/, '')}
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

export function ProductDocDropZone({ product, docType, onUploaded }) {
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
