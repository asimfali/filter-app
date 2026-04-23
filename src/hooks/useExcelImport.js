import { useState } from 'react';

export function useExcelImport(onAction) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState([]);

    const handleFile = (f) => { setFile(f); setError(''); setWarnings([]); };

    const run = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setWarnings([]);
        const result = await onAction(file);
        if (!result.ok) setError(result.error || 'Ошибка');
        if (result.warnings) setWarnings(result.warnings);
        setLoading(false);
        return result;
    };

    return { file, handleFile, loading, error, warnings, run };
}