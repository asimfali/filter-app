import React, { useState } from 'react';
import { bomApi } from '../../api/bom';
import { useExcelImport } from '../../hooks/useExcelImport';
import FileDropZone from '../common/FileDropZone';
import ModalFooter from '../common/ModalFooter';
import WarningsList from '../common/WarningsList';

export default function MergeExcelModal({ specId, onClose, onMerged }) {
    const [meta, setMeta] = useState(null);
    const { file, handleFile, loading, error, warnings, run } = useExcelImport(
        async (f) => {
            const { ok, data } = await bomApi.mergeExcel(specId, f);
            if (ok && data.success) {
                setMeta(data.meta);
                setTimeout(() => onMerged(data.data), 1500);
                return { ok: true, warnings: data.meta?.warnings || [] };
            }
            return { ok: false, error: data.error };
        }
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Обновить из Excel
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Новые материалы добавятся, существующие обновятся. Удаления не происходит.
                </p>
                <FileDropZone file={file} onFile={handleFile} error={error} accept=".xlsx" hint=".xlsx" />
                {warnings.length > 0 && <WarningsList warnings={warnings} />}
                {meta && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 space-y-0.5">
                        <div>✓ Добавлено: {meta.added}</div>
                        <div>↻ Обновлено: {meta.updated}</div>
                        <div>— Без изменений: {meta.skipped}</div>
                    </div>
                )}
                <ModalFooter onClose={onClose} onConfirm={run} loading={loading} disabled={!file}
                    confirmLabel="Обновить" />
            </div>
        </div>
    );
}