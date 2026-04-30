import React, { useState, useEffect } from 'react';
import { bomApi } from '../../api/bom';
import { useModals } from '../../hooks/useModals';
import { inputCls } from '../../utils/styles';
import { IconFolder, IconFactory, IconText, IconBox} from '../common/Icons';

// Вспомогательный компонент кнопки
function SyncButton({ label, description, icon, onClick, loading, variant = 'secondary', status, message }) {
    return (
        <div className="space-y-1">
            <button
                onClick={onClick}
                disabled={loading}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 group
                    ${variant === 'primary'
                        ? 'bg-blue-600 border-blue-700 hover:bg-blue-700 text-white'
                        : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                    {typeof icon === 'string' ? <span className="text-2xl">{icon}</span> : icon}
                </span>
                <div className="flex-1">
                    <div className={`text-sm font-semibold ${variant === 'primary' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {label}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${variant === 'primary' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {description}
                    </div>
                </div>
                {loading
                    ? <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping mt-1" />
                    : <span className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">→</span>
                }
            </button>
            {message && (
                <div className={`text-xs px-3 py-1 rounded ${status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                    status === 'error' ? 'text-red-600 dark:text-red-400' :
                        'text-blue-600 dark:text-blue-400'
                    }`}>
                    {message}
                </div>
            )}
        </div>
    );
}

export default function SyncModal({ onClose, onRefresh }) {
    const [configs, setConfigs] = useState([]);
    const [statuses, setStatuses] = useState({}); // { configId: 'pending'|'success'|'error' }
    const [messages, setMessages] = useState({});  // { configId: '...' }
    const [globalStatus, setGlobalStatus] = useState('');
    const [globalMessage, setGlobalMessage] = useState('');
    const { showAlert, modals } = useModals();

    useEffect(() => {
        bomApi.getSyncConfigs().then(({ ok, data }) => {
            if (ok && data.success) setConfigs(data.data);
        });
    }, []);

    const pollTaskStatus = (taskId, configId, label) => {
        const interval = setInterval(async () => {
            const { ok, data } = await bomApi.getTaskStatus(taskId);
            if (ok && data.success) {
                if (data.data.ready) {
                    clearInterval(interval);
                    setStatuses(s => ({ ...s, [configId]: 'success' }));
                    setMessages(m => ({ ...m, [configId]: `✓ Завершено` }));
                    onRefresh();
                } else if (data.data.status === 'FAILURE') {
                    clearInterval(interval);
                    setStatuses(s => ({ ...s, [configId]: 'error' }));
                    setMessages(m => ({ ...m, [configId]: 'Ошибка выполнения' }));
                }
            }
        }, 2000);
    };

    const handleSyncConfig = async (configId, label) => {
        setStatuses(s => ({ ...s, [configId]: 'pending' }));
        setMessages(m => ({ ...m, [configId]: 'Запуск...' }));

        const { ok, data } = await bomApi.syncBomConfig(configId);
        if (ok && data.success) {
            if (data.data?.task_id) {
                setMessages(m => ({ ...m, [configId]: 'Выполняется...' }));
                pollTaskStatus(data.data.task_id, configId, label);
            } else {
                setStatuses(s => ({ ...s, [configId]: 'success' }));
                setMessages(m => ({ ...m, [configId]: '✓ Завершено' }));
                onRefresh();
            }
        } else {
            setStatuses(s => ({ ...s, [configId]: 'error' }));
            setMessages(m => ({ ...m, [configId]: data.error || 'Ошибка' }));
        }
    };

    const handleSyncAction = async (actionType, label) => {
        setGlobalStatus('pending');
        setGlobalMessage(`Запуск: ${label}...`);

        let result;
        if (actionType === 'nomenclature') {
            result = await bomApi.syncParts('', 100);
        } else if (actionType === 'production_folders') {
            result = await bomApi.syncNomenclatureFolders('ПРОИЗВОДСТВО');
        } else if (actionType === 'spec_folders') {
            result = await bomApi.syncFolders();
        } else if (actionType === 'all_bom') {
            result = await bomApi.syncFolder({});
        }

        const { ok, data } = result;
        if (ok && data.success) {
            if (data.data?.task_id) {
                pollTaskStatus(data.data.task_id, 'global', label);
            } else {
                setGlobalStatus('success');
                setGlobalMessage(`${label} завершена`);
                onRefresh();
                setTimeout(() => { setGlobalStatus(''); setGlobalMessage(''); }, 2000);
            }
        } else {
            setGlobalStatus('error');
            setGlobalMessage(data.error || 'Ошибка при запуске');
        }
    };

    const anyPending = Object.values(statuses).includes('pending') || globalStatus === 'pending';

    const SYNC_TYPE_ICON = {
        bom_materials: <IconBox className="w-6 h-6" />,
        bom_production: <IconFactory className="w-6 h-6" />,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Синхронизация данных 1С</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
                    {/* Базовые синхронизации */}
                    <SyncButton
                        label="Номенклатура (Детали/Материалы)"
                        description="Обновляет названия, артикулы и единицы измерения"
                        icon={<IconText className="w-6 h-6" />}
                        loading={anyPending}
                        status={globalStatus}
                        message={globalStatus ? globalMessage : ''}
                        onClick={() => handleSyncAction('nomenclature', 'Синхронизация номенклатуры')}
                    />
                    <SyncButton
                        label="Пути производства"
                        description="Обновляет дерево папок в разделе ПРОИЗВОДСТВО"
                        icon={<IconFactory className="w-6 h-6" />}
                        loading={anyPending}
                        onClick={() => handleSyncAction('production_folders', 'Синхронизация путей производства')}
                    />
                    <SyncButton
                        label="Папки спецификаций"
                        description="Обновляет дерево папок для хранения спецификаций"
                        icon={<IconFolder />}
                        loading={anyPending}
                        onClick={() => handleSyncAction('spec_folders', 'Синхронизация папок спецификаций')}
                    />

                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* Динамические конфиги */}
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Номенклатура по папкам
                    </p>
                    {configs.map(c => (
                        <SyncButton
                            key={c.id}
                            label={c.name}
                            description={c.sync_type === 'bom_production' ? 'Папка производства' : 'Папка комплектации'}
                            icon={SYNC_TYPE_ICON[c.sync_type] || <IconBox className="w-6 h-6" />}
                            loading={statuses[c.id] === 'pending'}
                            status={statuses[c.id]}
                            message={messages[c.id] || ''}
                            onClick={() => handleSyncConfig(c.id, c.name)}
                        />
                    ))}

                    <hr className="border-gray-100 dark:border-gray-800" />

                    <SyncButton
                        label="Полная синхронизация"
                        description="Запуск всех фоновых процессов обновления BOM"
                        icon="⚡"
                        variant="primary"
                        loading={anyPending}
                        onClick={() => handleSyncAction('all_bom', 'Полная синхронизация')}
                    />
                </div>

                {globalMessage && (
                    <div className={`px-6 py-3 text-xs font-medium border-t flex items-center gap-2
                        ${globalStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            globalStatus === 'error' ? 'bg-red-50 text-red-700 border-red-100' :
                                'bg-blue-50 text-blue-700 border-blue-100 animate-pulse'}`}>
                        {globalStatus === 'pending' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                        {globalMessage}
                    </div>
                )}
            </div>
        </div>
    );
}