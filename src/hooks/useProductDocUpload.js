import { useState, useRef } from 'react';
import { mediaApi } from '../api/media';

const POLL_INTERVAL = 5000;
const POLL_MAX = 12; // 60 сек

export function useProductDocUpload({ onUploaded }) {
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const pollRef = useRef(null);

    const clearResult = (delay = 3000) => {
        setTimeout(() => setUploadResult(null), delay);
    };

    const startPolling = (productId, docType) => {
        let attempts = 0;
        pollRef.current = setInterval(async () => {
            attempts++;
            const { ok, data } = await mediaApi.getProductDocuments(productId, docType.id);
            if (!ok || !data.success) return;

            const files = data.data?.[0]?.current || [];
            const hasGlb = files.some(f => f.name.toLowerCase().endsWith('.glb'));

            if (hasGlb || attempts >= POLL_MAX) {
                clearInterval(pollRef.current);
                if (hasGlb) {
                    onUploaded(productId, docType.code, files);
                    setUploadResult({ ok: true, message: '✓ 3D модель готова' });
                } else {
                    setUploadResult({ ok: false, message: 'Конвертация не завершилась — обновите страницу' });
                }
                clearResult();
            }
        }, POLL_INTERVAL);
    };

    const upload = async (file, productId, docType) => {
        if (!file || !docType) return;

        setUploading(true);
        setUploadResult(null);

        try {
            const { ok, data } = await mediaApi.uploadProductDocument(
                docType.id,
                productId,
                file,
            );

            if (ok && data.success) {
                if (data.converting) {
                    setUploadResult({ ok: true, message: 'Конвертация STEP → GLB...' });
                    startPolling(productId, docType);
                } else {
                    setUploadResult({ ok: true, message: `✓ ${file.name}` });
                    // Перезагружаем файлы
                    const { ok: ok2, data: data2 } = await mediaApi.getProductDocuments(
                        productId, docType.id,
                    );
                    if (ok2 && data2.success) {
                        const files = data2.data?.[0]?.current || [];
                        onUploaded(productId, docType.code, files);
                    }
                    clearResult();
                }
            } else {
                setUploadResult({ ok: false, message: data.error || 'Ошибка' });
                clearResult();
            }
        } catch {
            setUploadResult({ ok: false, message: 'Ошибка сети' });
            clearResult();
        } finally {
            setUploading(false);
        }
    };

    return { upload, uploading, uploadResult };
}