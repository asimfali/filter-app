import React, { useState } from 'react';
import FolderPicker from './FolderPicker';
import Modal from '../common/Modal';

export default function CreateDetailsModal({ onClose, onConfirm }) {
    const [selectedFolder, setSelectedFolder] = useState(null);

    return (
        <Modal title="Создание деталей в 1С" onClose={onClose} maxWidth="lg">
            <div className="space-y-4">
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
        </Modal>
    );
}