import React from 'react';
import { bomApi } from '../../api/bom';
import { useExcelImport } from '../../hooks/useExcelImport';
import FileDropZone from '../common/FileDropZone';
import ModalFooter from '../common/ModalFooter';
import WarningsList from '../common/WarningsList';

export default function ImportExcelModal({ onClose, onImported }) {
    const { file, handleFile, loading, error, warnings, run } = useExcelImport(
        async (f) => {
            const { ok, data } = await bomApi.importFromExcel(f);
            if (ok && data.success) {
                if (data.meta?.warnings?.length) {
                    setTimeout(() => onImported(data.data), 2000);
                } else {
                    onImported(data.data);
                }
                return { ok: true, warnings: data.meta?.warnings || [] };
            }
            return { ok: false, error: data.error, warnings: data.data?.errors || [] };
        }
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Импорт маршрутной карты
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Поддерживаются файлы формата .xlsx. Спецификация будет создана в статусе «Черновик».
                </p>
                <FileDropZone file={file} onFile={handleFile} error={error} accept=".xlsx" hint=".xlsx" />
                {warnings.length > 0 && <WarningsList warnings={warnings} />}
                <ModalFooter onClose={onClose} onConfirm={run} loading={loading} disabled={!file}
                    confirmLabel="Импортировать" />
            </div>
        </div>
    );
}