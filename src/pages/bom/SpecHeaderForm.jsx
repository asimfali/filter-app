import React, { useState, useEffect } from 'react';
import FolderPicker from '../../components/bom/FolderPicker';

export default function SpecHeaderForm({ spec, onSave, saving, canWrite, onDirtyChange }) {
    const [form, setForm] = useState({
        onec_name: spec.onec_name,
        stage_name: spec.stage_name,
        process_type: spec.process_type,
        date_from: spec.date_from,
        quantity: spec.quantity,
        default_nomenclature_folder: spec.default_nomenclature_folder || null,
        folder: spec.folder || null,  // ← папка спецификации сборки
    });
    const [dirty, setDirty] = useState(false);

    const [selectedNomFolder, setSelectedNomFolder] = useState(
        spec.default_nomenclature_folder
            ? { id: spec.default_nomenclature_folder, path: spec.default_nomenclature_folder_path || '' }
            : null
    );
    const [selectedSpecFolder, setSelectedSpecFolder] = useState(
        spec.folder
            ? { id: spec.folder, path: spec.folder_path || '' }
            : null
    );
    const [selectedAssemblyFolder, setSelectedAssemblyFolder] = useState(
        spec.assembly_nomenclature_folder
            ? { id: spec.assembly_nomenclature_folder, path: spec.assembly_nomenclature_folder_path || '' }
            : null
    );

    useEffect(() => {
        setForm({
            onec_name: spec.onec_name,
            stage_name: spec.stage_name,
            process_type: spec.process_type,
            date_from: spec.date_from,
            quantity: spec.quantity,
            default_nomenclature_folder: spec.default_nomenclature_folder || null,
            folder: spec.folder || null,
            assembly_nomenclature_folder: spec.assembly_nomenclature_folder || null,
        });
        setSelectedNomFolder(
            spec.default_nomenclature_folder
                ? { id: spec.default_nomenclature_folder, path: spec.default_nomenclature_folder_path || '' }
                : null
        );
        setSelectedSpecFolder(
            spec.folder
                ? { id: spec.folder, path: spec.folder_path || '' }
                : null
        );
        setSelectedAssemblyFolder(
            spec.assembly_nomenclature_folder
                ? { id: spec.assembly_nomenclature_folder, path: spec.assembly_nomenclature_folder_path || '' }
                : null
        );
        setDirty(false);
        onDirtyChange?.(false);
    }, [spec.id, spec.folder, spec.assembly_nomenclature_folder, spec.default_nomenclature_folder]);



    const set = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
        setDirty(true);
        onDirtyChange?.(true);
    };

    const handleSave = () => { onSave(form); setDirty(false); onDirtyChange?.(false); };

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 space-y-4">
            {/* грид полей без изменений */}

            {canWrite && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Папка номенклатуры деталей — без изменений */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка номенклатуры деталей
                            </span>
                            {!selectedNomFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedNomFolder}
                            onChange={f => {
                                setSelectedNomFolder(f);
                                const newForm = { ...form, default_nomenclature_folder: f.id };
                                setForm(newForm);
                                onSave(newForm);
                            }}
                            folderType="manufacture"
                        />
                    </div>

                    {/* Папка спецификации сборки — новое */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка спецификации сборки
                            </span>
                            {!selectedSpecFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана — «Загрузить сборку» недоступно
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedSpecFolder}
                            onChange={f => {
                                setSelectedSpecFolder(f);
                                const newForm = { ...form, folder: f.id };
                                setForm(newForm);
                                onSave(newForm);
                            }}
                            folderType="spec"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Папка номенклатуры изделия
                            </span>
                            {!selectedAssemblyFolder && (
                                <span className="text-xs text-amber-500">
                                    ⚠ Не выбрана — «Загрузить сборку» недоступно
                                </span>
                            )}
                        </div>
                        <FolderPicker
                            value={selectedAssemblyFolder}
                            onChange={f => {
                                setSelectedAssemblyFolder(f);
                                const newForm = { ...form, assembly_nomenclature_folder: f.id };
                                setForm(newForm);
                                onSave(newForm);
                            }}
                            folderType="nomenclature"
                            rootPath="ГОТОВАЯ ПРОДУКЦИЯ"
                        />
                    </div>
                </div>
            )}

            {canWrite && dirty && (
                <div className="flex justify-end">
                    <button onClick={handleSave} disabled={saving}
                        className="px-4 py-1.5 text-sm rounded-lg bg-blue-600
                                   hover:bg-blue-700 text-white disabled:opacity-50 transition-colors">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            )}
        </div>
    );
}