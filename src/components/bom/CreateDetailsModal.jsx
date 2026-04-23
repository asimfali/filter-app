import React, { useState } from 'react';
import FolderPicker from './FolderPicker';

export default function CreateDetailsModal({ onClose, onConfirm, defaultFolderId }) {
    const [selectedFolder, setSelectedFolder] = useState(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl
                            border border-gray-200 dark:border-gray-700
                            w-full max-w-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Создание деталей в 1С
                    </h2>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                        ×
                    </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Выберите папку номенклатуры для деталей в 1С.
                    Спецификации деталей будут созданы в папке из настроек профиля.
                </p>

                <div>
                    <label className="block text-xs font-medium
                                      text-gray-500 dark:text-gray-400 mb-2">
                        Папка номенклатуры деталей
                        {selectedFolder && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 font-normal">
                                {selectedFolder.path}
                            </span>
                        )}
                    </label>
                    <FolderPicker
                        value={selectedFolder}
                        onChange={setSelectedFolder}
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border
                                   border-gray-200 dark:border-gray-700
                                   text-gray-600 dark:text-gray-400
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Отмена
                    </button>
                    <button
                        onClick={() => onConfirm(selectedFolder?.id || null)}
                        disabled={!selectedFolder}
                        className="px-4 py-2 text-sm rounded-lg
                                   bg-blue-600 hover:bg-blue-700
                                   text-white disabled:opacity-50 transition-colors">
                        Создать детали
                    </button>
                </div>
            </div>
        </div>
    );
}