import React, { useState } from 'react';
import { bomApi } from '../../api/bom';
import { useExcelImport } from '../../hooks/useExcelImport';
import FileDropZone from '../common/FileDropZone';
import ModalFooter from '../common/ModalFooter';
import Modal from '../common/Modal';

export default function ImportJsonModal({ specId, onClose, onMerged }) {
    const [meta, setMeta] = useState(null);
    const { file, handleFile, loading, error, warnings, run } = useExcelImport(
        async (f) => {
            const { ok, data } = await bomApi.mergeJson(specId, f);
            if (ok && data.success) {
                setMeta(data.meta);
                if (!data.meta?.errors?.length) {
                    // Нет ошибок — закрываем автоматически
                    setTimeout(() => onMerged(data.data), 1500);
                }
                // Есть ошибки — ждём пока пользователь сам закроет
                return { ok: true, warnings: data.meta?.warnings || [] };
            }
            return { ok: false, error: data.error };
        }
    );

    return (
        <Modal title="Импорт из JSON" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    JSON файл с комплектующими. Новые строки добавятся, существующие обновятся.
                </p>
                <FileDropZone file={file} onFile={handleFile} error={error} accept=".json" hint=".json" />
                {warnings.length > 0 && <WarningsList warnings={warnings} />}
                {meta && (
                    <div className="space-y-2">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3
                        border border-emerald-200 dark:border-emerald-800
                        text-xs text-emerald-700 dark:text-emerald-300 space-y-0.5">
                            <div>✓ Добавлено: {meta.added}</div>
                            <div>↻ Обновлено: {meta.updated}</div>
                            <div>— Без изменений: {meta.skipped}</div>
                        </div>
                        {meta.errors?.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3
                            border border-red-200 dark:border-red-800
                            max-h-32 overflow-y-auto">
                                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                    Не найдено в номенклатуре ({meta.errors.length}):
                                </p>
                                {meta.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-red-600 dark:text-red-400">· {e}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <ModalFooter
                    onClose={() => {
                        if (meta && (meta.updated > 0 || meta.added > 0)) {
                            onMerged(null);
                        }
                        onClose();
                    }}
                    onConfirm={meta ? null : run}  // ← если meta есть — скрываем кнопку импорта
                    loading={loading}
                    disabled={!file}
                    confirmLabel="Импортировать"
                    closeLabel={meta ? "Закрыть" : "Отмена"}  // ← меняем текст
                />
            </div>
        </Modal>
    );
}