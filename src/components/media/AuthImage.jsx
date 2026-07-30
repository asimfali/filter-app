import { useState, useEffect } from 'react';
import { mediaApi } from '../../api/media';

// ── Авторизованные изображения ────────────────────────────────────────────

function useAuthImage(relPath) {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        if (!relPath) return;
        let objectUrl = null;

        mediaApi.downloadFile(relPath)
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

export default function AuthImage({ relPath, alt, className }) {
    const src = useAuthImage(relPath);
    if (!src) return (
        <div className={`${className} bg-neutral-100 dark:bg-neutral-800 animate-pulse`} />
    );
    return <img src={src} alt={alt} className={className} />;
}
