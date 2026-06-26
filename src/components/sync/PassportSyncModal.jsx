// src/components/sync/PassportSyncModal.jsx
import React, { useState, useRef } from 'react';
import SmartSelect from '../common/SmartSelect';
import { mediaApi } from '../../api/media';
import { can } from '../../utils/permissions';
import { IconClock, IconFile } from '../common/Icons';

export default function PassportSyncModal({ user, onClose }) {
    const canImport = can(user, 'passport.documents.upload');
    const canExport = can(user, 'passport.documents.update');

    const [document_, setDocument] = useState(null);
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    const [stage, setStage] = useState('idle');
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);

    const handlePreview = async () => {
        if (!document_ || !file) return;
        setStage('preview');
        setError(null);
        const { ok, data } = await mediaApi.passportImportPreview(document_.id, file);
        if (!ok || !data.success) {
            setError(data?.error || 'Ошибка предпросмотра');
            setStage('idle');
            return;
        }
        setReport(data.data);
    };

    const handleApply = async () => {
        if (!document_ || !file) return;
        setStage('applying');
        setError(null);
        const { ok, data } = await mediaApi.passportImportApply(document_.id, file);
        if (!ok || !data.success) {
            setError(data?.error || 'Ошибка применения');
            setStage('preview');
            return;
        }
        setReport(data.data);
        setStage('done');
    };

    const handleExport = async () => {
        if (!document_ || !file) return;
        setExporting(true);
        setError(null);
        const result = await mediaApi.passportExportUpdate(document_.id, file);
        setExporting(false);
        if (!result.ok) {
            setError(result.error || 'Ошибка обновления паспорта');
            return;
        }
        const url = window.URL.createObjectURL(result.blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const reset = () => {
        setFile(null);
        setReport(null);
        setError(null);
        setStage('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!canImport && !canExport) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={onClose}>
            <div className="w-[640px] max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900
                            rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700
                            overflow-hidden"
                 onClick={e => e.stopPropagation()}>

                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800
                                flex items-center justify-between shrink-0">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Синхронизация паспортов
                    </h2>
                    <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg">
                        ×
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Паспорт
                        </label>
                        {document_ ? (
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg
                                            bg-neutral-50 dark:bg-neutral-800 text-sm">
                                <span className="text-gray-900 dark:text-white">
                                    {document_.name || document_.external_id}
                                </span>
                                <button onClick={() => { setDocument(null); reset(); }}
                                        className="text-xs text-gray-400 hover:text-red-500">
                                    Сменить
                                </button>
                            </div>
                        ) : (
                            <SmartSelect
                                endpoint="/api/v1/media/documents/search/?doc_type_id=1"
                                placeholder="Найти паспорт..."
                                onSelect={(d) => setDocument(d)}
                            />
                        )}
                    </div>

                    {document_ && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                JSON-файл паспорта
                            </label>
                            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2
                                rounded-lg border transition-colors text-sm
                                ${file
                                    ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                                }`}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) { reset(); setFile(f); }
                                    }}
                                />
                                <IconFile className="w-4 h-4" />
                                {file ? file.name : 'Выбрать файл'}
                            </label>
                        </div>
                    )}

                    {error && (
                        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20
                                        px-3 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {report && (
                        <div className="space-y-3">
                            {report.unmatched_models?.length > 0 && (
                                <div className="text-xs text-amber-600 dark:text-amber-400">
                                    Не найдены товары для: {report.unmatched_models.join(', ')}
                                </div>
                            )}
                            {report.items?.map(item => (
                                <div key={item.model_code}
                                     className="border border-gray-100 dark:border-gray-800
                                                rounded-lg px-3 py-2">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {item.model_code}
                                        <span className="text-xs text-gray-400 ml-2">
                                            → {item.matched_products?.join(', ')}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Записано: {item.written?.length ?? 0}
                                        {item.skipped_manual?.length > 0 &&
                                            `, защищено: ${item.skipped_manual.length}`}
                                        {item.unmatched_keys?.length > 0 &&
                                            `, не размечено: ${item.unmatched_keys.length}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800
                                flex gap-2 shrink-0">
                    {canImport && stage === 'idle' && (
                        <button
                            onClick={handlePreview}
                            disabled={!document_ || !file}
                            className="flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                       bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                                       text-white transition-colors">
                            Проверить
                        </button>
                    )}
                    {canImport && stage === 'preview' && report && (
                        <button
                            onClick={handleApply}
                            className="flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                       bg-emerald-600 hover:bg-emerald-700
                                       text-white transition-colors">
                            Применить
                        </button>
                    )}
                    {canImport && stage === 'applying' && (
                        <button disabled
                                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                           bg-emerald-600 opacity-60 text-white flex items-center
                                           justify-center gap-2">
                            <IconClock className="w-4 h-4" /> Применение...
                        </button>
                    )}
                    {canImport && stage === 'done' && (
                        <span className="flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                         bg-emerald-50 dark:bg-emerald-900/20
                                         text-emerald-600 dark:text-emerald-400 text-center">
                            ✓ Применено
                        </span>
                    )}

                    {canExport && (
                        <button
                            onClick={handleExport}
                            disabled={!document_ || !file || exporting}
                            className="px-3 py-2 text-sm font-medium rounded-lg
                                       bg-violet-600 hover:bg-violet-700 disabled:opacity-40
                                       text-white transition-colors">
                            {exporting ? 'Подготовка...' : 'Обновить паспорт'}
                        </button>
                    )}

                    <button onClick={onClose}
                            className="px-3 py-2 text-sm rounded-lg
                                       bg-neutral-100 dark:bg-neutral-800
                                       text-gray-600 dark:text-gray-400
                                       hover:bg-neutral-200 dark:hover:bg-neutral-700
                                       transition-colors">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}