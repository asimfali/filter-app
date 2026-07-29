import React from 'react';
import { bomApi } from '../../api/bom';
import { useExcelImport } from '../../hooks/useExcelImport';
import FileDropZone from '../common/FileDropZone';
import ModalFooter from '../common/ModalFooter';
import WarningsList from '../common/WarningsList';
import Modal from '../common/Modal';

export default function ImportExcelModal({ onClose, onImported }) {
    const { file, handleFile, loading, error, warnings, run } = useExcelImport(
        async (f) => {
            const { ok, data } = await bomApi.importFromExcel(f);
            if (ok && data.success) {
                const warnings = data.meta?.warnings || [];
    
                if (data.split) {
                    // Две спецификации — открываем первую, вторая появится в списке
                    setTimeout(() => onImported(data.data[0], true), warnings.length ? 2000 : 0);
                } else {
                    if (warnings.length) {
                        setTimeout(() => onImported(data.data), 2000);
                    } else {
                        onImported(data.data);
                    }
                }
                return { ok: true, warnings };
            }
            return { ok: false, error: data.error, warnings: data.data?.errors || [] };
        }
    );

    return (
        <Modal title="Импорт маршрутной карты" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Поддерживаются файлы формата .xlsx. Спецификация будет создана в статусе «Черновик».
                </p>
                <FileDropZone file={file} onFile={handleFile} error={error} accept=".xlsx" hint=".xlsx" />
                {warnings.length > 0 && <WarningsList warnings={warnings} />}
                <ModalFooter onClose={onClose} onConfirm={run} loading={loading} disabled={!file}
                    confirmLabel="Импортировать" />
            </div>
        </Modal>
    );
}