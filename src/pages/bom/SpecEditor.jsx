import React, { useState, useEffect } from 'react';
import { bomApi } from '../../api/bom';
import { useModals } from '../../hooks/useModals';
import ValidationReport from '../../components/bom/ValidationReport';
import MergeExcelModal from '../../components/bom/MergeExcelModal';
import ImportJsonModal from '../../components/bom/ImportJsonModal';
import CreateDetailsModal from '../../components/bom/CreateDetailsModal';
import SpecHeaderForm from './SpecHeaderForm';
import MaterialsPanel from './MaterialsPanel';
import { inputCls } from '../../utils/styles';

const STATUS_LABEL = {
    draft: 'Черновик',
    ready: 'Готова к загрузке',
    pushing: 'Загружается...',
    pushed: 'Загружена в 1С',
    push_error: 'Ошибка загрузки',
};

const STATUS_COLOR = {
    draft: 'text-gray-500 dark:text-gray-400',
    ready: 'text-emerald-600 dark:text-emerald-400',
    pushing: 'text-blue-500 dark:text-blue-400',
    pushed: 'text-emerald-700 dark:text-emerald-300',
    push_error: 'text-red-600 dark:text-red-400',
};

export default function SpecEditor({ spec: initialSpec, onClose, onSaved, canWrite, canPush, canView }) {
    const [spec, setSpec] = useState(initialSpec);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [validation, setValidation] = useState(null);
    const [presets, setPresets] = useState([]);
    const [sheetMappings, setSheetMappings] = useState([]);
    const [cloneOpen, setCloneOpen] = useState(false);
    const [cloneName, setCloneName] = useState('');
    const [cloning, setCloning] = useState(false);
    const [headerDirty, setHeaderDirty] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [importJsonOpen, setImportJsonOpen] = useState(false);
    const { showConfirm, showAlert, modals } = useModals();

    useEffect(() => {
        bomApi.getStagePresets().then(({ ok, data }) => {
            if (ok && data.success) setPresets(data.data);
        });
        bomApi.getSheetMappings().then(({ ok, data }) => {
            if (ok && data.success) setSheetMappings(data.data);
        });
    }, []);

    const reload = async () => {
        const { ok: ok2, data: data2 } = await bomApi.getSpec(spec.id);
        if (ok2 && data2.success) {
            setSpec(data2.data);
            onSaved(data2.data);
        }
    };

    const handleHeaderSave = async (fields) => {
        setSaving(true);
        await bomApi.updateSpec(spec.id, fields);
        await reload();
        setSaving(false);
    };

    const handleMaterialsSave = async (materials) => {
        setSaving(true);
        const payload = materials.map(m => ({
            ...m,
            source_material: m.source_material_id ?? null,
            stage_preset: m.stage_preset_id ?? null,
            // Для покупных: если part_name пустой — берём из source_material_name
            part_name: m.part_name || m.source_material_name || '',
            // Если part не выбран но source_material выбран — используем его как part
            part: m.part ?? (m.in_process ? null : (m.source_material_id ?? null)),
        }));
        await bomApi.updateMaterials(spec.id, payload);
        await reload();
        setSaving(false);
    };

    const handleValidate = async () => {
        setValidating(true);
        setValidation(null);
        const { ok, data } = await bomApi.validateSpec(spec.id);
        if (ok && data.success) setValidation(data.data);
        await reload();
        setValidating(false);
    };

    const handlePush = async () => {
        setPushing(true);
        setValidation(null);
        const { ok, data } = await bomApi.pushSpec(spec.id);
        if (data.data && !data.data.success) setValidation(data.data);
        await reload();
        setPushing(false);
    };

    const handleCreateDetails = async () => {
        setPushing(true);
        setValidation(null);
        const folderId = spec.default_nomenclature_folder || null;
        const { ok, data } = await bomApi.createDetails(spec.id, folderId);
        if (!data.success && data.data?.errors?.length) {
            setValidation({ is_valid: false, errors: data.data.errors, warnings: [] });
        }
        await reload();
        setPushing(false);
    };

    const handlePushAssembly = async () => {
        setPushing(true);
        setValidation(null);
        const { ok, data } = await bomApi.pushSpec(spec.id);
        if (data.data && !data.data.success) setValidation(data.data);
        await reload();
        setPushing(false);
    };

    const handleUpdateDetails = async () => {
        setPushing(true);
        setValidation(null);
        const { ok, data } = await bomApi.updateDetails(spec.id);
        if (!data.success && data.data?.errors?.length) {
            setValidation({ is_valid: false, errors: data.data.errors, warnings: [] });
        }
        await reload();
        setPushing(false);
    };

    const handleClone = async () => {
        if (!cloneName.trim()) return;
        setCloning(true);
        const { ok, data } = await bomApi.cloneSpec(spec.id, cloneName.trim());
        if (ok && data.success) {
            setCloneOpen(false);
            // Открываем новую спецификацию
            onClose();
        } else {
            showAlert(data.error || 'Ошибка копирования');
        }
        setCloning(false);
    };

    return (
        <div className="w-full space-y-4">
            {modals}
            {/* Шапка */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="text-sm text-gray-500 dark:text-gray-400
                                   hover:text-gray-700 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {spec.onec_name}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-medium ${STATUS_COLOR[spec.status]}`}>
                                {STATUS_LABEL[spec.status]}
                            </span>
                            {spec.onec_status && (
                                <span className="text-xs text-gray-400">
                                    · 1С: {spec.onec_status}
                                </span>
                            )}
                        </div>
                    </div>
                    {canWrite && (
                        <button
                            onClick={() => { setCloneName(spec.onec_name + ' (копия)'); setCloneOpen(true); }}
                            className="px-3 py-1.5 text-sm rounded-lg border
                                    border-gray-200 dark:border-gray-700
                                    text-gray-500 dark:text-gray-400
                                    hover:bg-neutral-50 dark:hover:bg-neutral-800
                                    transition-colors">
                            ⎘ Копировать
                        </button>
                    )}

                    {cloneOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                                            border border-gray-200 dark:border-gray-700
                                            w-full max-w-md p-6 space-y-4">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                    Копировать спецификацию
                                </h2>
                                <input
                                    value={cloneName}
                                    onChange={e => setCloneName(e.target.value)}
                                    placeholder="Название новой спецификации"
                                    className="w-full px-3 py-1.5 text-sm rounded-lg
                                            bg-neutral-50 dark:bg-neutral-800
                                            border border-gray-200 dark:border-gray-700
                                            text-gray-900 dark:text-white
                                            focus:outline-none focus:border-blue-500"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setCloneOpen(false)}
                                        className="px-4 py-2 text-sm text-gray-500">
                                        Отмена
                                    </button>
                                    <button onClick={handleClone} disabled={cloning || !cloneName.trim()}
                                        className="px-4 py-2 text-sm rounded-lg bg-blue-600
                                                hover:bg-blue-700 text-white disabled:opacity-50">
                                        {cloning ? 'Копирование...' : 'Создать копию'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {canWrite && (
                        <button
                            onClick={() => setMergeOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border
                   border-gray-200 dark:border-gray-700
                   text-gray-600 dark:text-gray-400
                   hover:bg-neutral-50 dark:hover:bg-neutral-800
                   transition-colors">
                            ↑ Excel
                        </button>
                    )}

                    {mergeOpen && (
                        <MergeExcelModal
                            specId={spec.id}
                            onClose={() => setMergeOpen(false)}
                            onMerged={(updated) => {
                                setMergeOpen(false);
                                onSaved(updated);
                                reload();
                            }}
                        />
                    )}

                    {canWrite && (
                        <button onClick={() => setImportJsonOpen(true)}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                   text-gray-600 dark:text-gray-400 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                            { } JSON
                        </button>
                    )}

                    {importJsonOpen && (
                        <ImportJsonModal
                            specId={spec.id}
                            onClose={() => setImportJsonOpen(false)}
                            onMerged={(updated) => {
                                setImportJsonOpen(false);
                                onSaved(updated);
                                reload();
                            }}
                        />
                    )}
                </div>
                <div className="flex gap-2">
                    {canWrite && (
                        <button onClick={handleValidate} disabled={validating || headerDirty}
                            className="px-3 py-1.5 text-sm rounded-lg border
                       border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400
                       hover:bg-neutral-50 dark:hover:bg-neutral-800
                       disabled:opacity-50 transition-colors">
                            {validating ? 'Проверка...' : '✓ Проверить'}
                        </button>
                    )}
                    {canPush && !spec.materials?.every(m => !m.in_process || m.detail_spec) && (
                        <button
                            onClick={handleCreateDetails}
                            disabled={pushing || !spec.default_nomenclature_folder || headerDirty}
                            title={!spec.default_nomenclature_folder ? 'Выберите папку номенклатуры деталей' : ''}
                            className="px-3 py-1.5 text-sm rounded-lg
                   border border-blue-600
                   text-blue-600 dark:text-blue-400
                   hover:bg-blue-50 dark:hover:bg-blue-900/20
                   disabled:opacity-50 transition-colors">
                            {pushing ? '...' : '⚙ Создать детали'}
                        </button>
                    )}
                    {canPush && spec.materials?.some(m => m.detail_spec) && (
                        <button
                            onClick={handleUpdateDetails}
                            disabled={pushing || headerDirty}
                            className="px-3 py-1.5 text-sm rounded-lg
                   border border-amber-500
                   text-amber-600 dark:text-amber-400
                   hover:bg-amber-50 dark:hover:bg-amber-900/20
                   disabled:opacity-50 transition-colors">
                            {pushing ? '...' : '↺ Обновить детали'}
                        </button>
                    )}
                    {canPush && (
                        <button
                            onClick={handlePushAssembly}
                            disabled={pushing || spec.status === 'pushing' || !spec.folder || !spec.assembly_nomenclature_folder || headerDirty}
                            title={!spec.folder ? 'Выберите папку спецификации сборки' : ''}
                            className="px-3 py-1.5 text-sm rounded-lg
                                        bg-emerald-600 hover:bg-emerald-700
                                        text-white disabled:opacity-50 transition-colors">
                            {pushing ? '...' : spec.status === 'pushed' ? '↑ Обновить сборку' : '↑ Загрузить сборку'}
                        </button>
                    )}
                </div>
            </div>

            {validation && <ValidationReport result={validation} />}

            <SpecHeaderForm
                spec={spec}
                onSave={handleHeaderSave}
                saving={saving}
                canWrite={canWrite}
                onDirtyChange={setHeaderDirty}
            />

            {/* Только материалы — без табов */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800
                                flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Материалы ({spec.materials?.length ?? 0})
                    </span>
                    {/* Пресет этапов */}
                    {spec.spec_stages?.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Этапы:</span>
                            {spec.spec_stages.map(s => (
                                <span key={s.id}
                                    className="px-2 py-0.5 rounded bg-neutral-100
                                               dark:bg-neutral-800 text-gray-600
                                               dark:text-gray-400">
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4">
                    <MaterialsPanel
                        materials={spec.materials || []}
                        presets={presets}
                        sheetMappings={sheetMappings}
                        onSave={handleMaterialsSave}
                        saving={saving}
                        canWrite={canWrite}
                        canView={canView}
                        validation={validation}
                    />
                </div>
            </div>
        </div>
    );
}