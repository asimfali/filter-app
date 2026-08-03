import React, { useState } from 'react';
import { bomApi } from '../../api/bom';
import { useExcelImport } from '../../hooks/useExcelImport';
import FileDropZone from '../common/FileDropZone';
import ModalFooter from '../common/ModalFooter';
import WarningsList from '../common/WarningsList';
import Modal from '../common/Modal';

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
        <Modal title="Обновить из Excel" onClose={onClose}>
            <div className="space-y-4">
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
        </Modal>
    );
}