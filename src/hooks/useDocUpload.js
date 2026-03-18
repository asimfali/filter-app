import { useState, useEffect } from 'react';
import { mediaApi } from '../api/media';
import { can } from '../utils/permissions';

export function useDocTypes(user) {
    const [docTypes, setDocTypes] = useState([]);
    const [activeDocType, setActiveDocType] = useState(null);

    useEffect(() => {
        if (!user) return;
        mediaApi.getFormData().then(({ ok, data }) => {
            if (!ok) return;
            const allowed = (data.doc_types || []).filter(dt =>
                can(user, dt.upload_permission_code)
            );
            setDocTypes(allowed);
            if (allowed.length > 0) setActiveDocType(allowed[0]);
        });
    }, [user?.permissions]);

    return { docTypes, activeDocType, setActiveDocType };
}

export function useCommonDocUpload({ onUploaded }) {
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);

    const clearResult = (delay = 3000) => {
        setTimeout(() => setUploadResult(null), delay);
    };

    const upload = async (file, docTypeId, externalId) => {
        if (!file) return;
        setUploading(true);
        setUploadResult(null);

        try {
            const { ok, data } = await mediaApi.uploadDocument(docTypeId, externalId, file);
            if (ok && data.success) {
                if (data.converting) {
                    setUploadResult({ ok: true, message: 'STEP загружен — конвертация ~30 сек' });
                } else {
                    setUploadResult({ ok: true, message: `✓ ${file.name}` });
                }
                setTimeout(() => { onUploaded?.(); setUploadResult(null); }, 1500);
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