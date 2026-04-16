import React, { useState, useEffect } from 'react';
import { externalApi } from '../../api/external';
import { can } from '../../utils/permissions';

export default function SyncModal({ user, onClose, mode }) {
    const [configs, setConfigs] = useState([]);
    const [results, setResults] = useState({});
    const [runningAll, setRunningAll] = useState(false);
    const [taskIds, setTaskIds] = useState({});

    const isPrices   = mode === 'prices';
    const title      = isPrices ? '💰 Обновить цены' : '🔄 Синхронизировать каталог';
    const btnColor   = isPrices
        ? 'bg-blue-600 hover:bg-blue-700'
        : 'bg-violet-600 hover:bg-violet-700';
    const permission = isPrices ? 'external.sync_prices' : 'external.sync_catalog';

    useEffect(() => {
        externalApi.getSyncConfigs().then(({ ok, data }) => {
            if (ok && data.success) setConfigs(data.data);
        });
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    useEffect(() => {
        const ids = Object.entries(taskIds);
        if (!ids.length) return;
    
        const interval = setInterval(async () => {
            for (const [configId, taskId] of ids) {
                const { ok, data } = await externalApi.taskStatus(taskId);
                if (!ok || !data.success) continue;
                if (data.data.ready) {
                    const result = data.data.result;
                    setResults(prev => ({
                        ...prev,
                        [configId]: {
                            loading: false,
                            ok: result.success,
                            message: result.success
                                ? `✓ Создано: ${result.created}, обновлено: ${result.updated}${result.errors ? `, ошибок: ${result.errors}` : ''}`
                                : `✗ ${result.error}`,
                        },
                    }));
                    setTaskIds(prev => {
                        const next = { ...prev };
                        delete next[configId];
                        return next;
                    });
                }
            }
        }, 2000);
    
        return () => clearInterval(interval);
    }, [taskIds]);

    const runSync = async (configId) => {
        setResults(prev => ({
            ...prev,
            [configId]: { loading: true, ok: null, message: '⏳ Запуск...' },
        }));
    
        const { ok, data } = isPrices
            ? await externalApi.syncPrices(configId)
            : await externalApi.syncCatalog(configId);
    
        if (ok && data.success) {
            setTaskIds(prev => ({ ...prev, [configId]: data.data.task_id }));
            setResults(prev => ({
                ...prev,
                [configId]: { loading: true, ok: null, message: '⏳ Выполняется...' },
            }));
        } else {
            setResults(prev => ({
                ...prev,
                [configId]: { loading: false, ok: false, message: data.error || 'Ошибка' },
            }));
        }
    };

    const runAll = async () => {
        setRunningAll(true);
        for (const config of configs) {
            await runSync(config.id);
        }
        setRunningAll(false);
    };

    if (!can(user, permission)) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
             onClick={onClose}>
            <div className="w-96 bg-white dark:bg-neutral-900
                            rounded-xl shadow-2xl
                            border border-gray-200 dark:border-gray-700
                            overflow-hidden"
                 onClick={e => e.stopPropagation()}>

                {/* Шапка */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800
                                flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h2>
                    <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600
                                       dark:hover:text-gray-300 text-lg">
                        ×
                    </button>
                </div>

                {/* Список конфигов */}
                <div className="px-5 py-4 space-y-2">
                    {configs.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Загрузка...
                        </p>
                    )}
                    {configs.map(config => {
                        const state = results[config.id];
                        return (
                            <div key={config.id}
                                 className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-800 dark:text-gray-200">
                                        {config.name}
                                    </span>
                                    {state?.message && (
                                        <p className={`text-xs mt-0.5 ${
                                            state.ok
                                                ? 'text-emerald-500'
                                                : 'text-red-500'
                                        }`}>
                                            {state.message}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => runSync(config.id)}
                                    disabled={state?.loading || runningAll}
                                    className={`shrink-0 px-3 py-1.5 text-xs font-medium
                                                rounded-lg text-white transition-colors
                                                disabled:opacity-40 ${btnColor}`}>
                                    {state?.loading ? '⏳' : 'Запустить'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Футер */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800
                                flex gap-2">
                    <button
                        onClick={runAll}
                        disabled={runningAll || configs.length === 0}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                    text-white transition-colors disabled:opacity-40
                                    ${btnColor}`}>
                        {runningAll ? '⏳ Запуск всех...' : 'Запустить все'}
                    </button>
                    <button
                        onClick={onClose}
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