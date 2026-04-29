import React, { useState, useEffect } from 'react';
import { externalApi } from '../../api/external';
import { can } from '../../utils/permissions';

// ─── Конфигурация режимов ─────────────────────────────────────────────────

const MODE_CONFIG = {
    prices: {
        title: '💰 Обновить цены',
        btnColor: 'bg-blue-600 hover:bg-blue-700',
        permission: 'external.sync_prices',
        loadItems: () => externalApi.getSyncConfigs(),
        runItem: (id) => externalApi.syncPrices(id),
        isAsync: true, // возвращает task_id
        formatResult: (result) => result.success
            ? `✓ Создано: ${result.created}, обновлено: ${result.updated}${result.errors ? `, ошибок: ${result.errors}` : ''}`
            : `✗ ${result.error}`,
    },
    catalog: {
        title: '🔄 Синхронизировать каталог',
        btnColor: 'bg-violet-600 hover:bg-violet-700',
        permission: 'external.sync_catalog',
        loadItems: () => externalApi.getSyncConfigs(),
        runItem: (id) => externalApi.syncCatalog(id),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Создано: ${result.created}, обновлено: ${result.updated}${result.errors ? `, ошибок: ${result.errors}` : ''}`
            : `✗ ${result.error}`,
    },
    variants: {
        title: '🔗 Группировка исполнений',
        btnColor: 'bg-amber-600 hover:bg-amber-700',
        permission: 'external.manage_variants',
        loadItems: () => externalApi.getVariantRules(),
        runItem: (id, opts) => externalApi.applyVariantRules(id, opts?.resetFirst ?? true),
        isAsync: false, // синхронный — результат сразу
        formatResult: (result) => result.success
            ? `✓ Привязано: ${result.data.linked}, пропущено: ${result.data.skipped}${result.data.reset ? `, сброшено: ${result.data.reset}` : ''}`
            : `✗ ${result.error}`,
        extraControls: (opts, setOpts) => (
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                    type="checkbox"
                    checked={opts?.resetFirst ?? true}
                    onChange={e => setOpts(prev => ({ ...prev, resetFirst: e.target.checked }))}
                    className="rounded"
                />
                Сбросить перед применением
            </label>
        ),
    },
    rsync: {
        title: '📂 Rsync медиафайлов',
        btnColor: 'bg-teal-600 hover:bg-teal-700',
        permission: 'external.rsync_media',
        // Статические пункты — типы медиа
        loadItems: async () => ({
            ok: true,
            data: {
                success: true,
                data: [
                    { id: 'all',         name: 'Все файлы' },
                    { id: 'passport',    name: 'Паспорта' },
                    { id: 'certificate', name: 'Сертификаты' },
                    { id: 'gallery',     name: 'Галерея' },
                    { id: 'declaration', name: 'Декларации' },
                ],
            },
        }),
        runItem: (id) => externalApi.rsyncMedia(id),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Готово`
            : `✗ ${result.error}`,
    },
};

// ─── Компонент ────────────────────────────────────────────────────────────

export default function SyncModal({ user, onClose, mode }) {
    const config = MODE_CONFIG[mode];

    const [items, setItems] = useState([]);
    const [results, setResults] = useState({});
    const [runningAll, setRunningAll] = useState(false);
    const [taskIds, setTaskIds] = useState({});
    const [opts, setOpts] = useState({});

    useEffect(() => {
        config.loadItems().then(({ ok, data }) => {
            if (ok && data.success) setItems(data.data);
        });
    }, [mode]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Поллинг async задач
    useEffect(() => {
        const ids = Object.entries(taskIds);
        if (!ids.length) return;

        const interval = setInterval(async () => {
            for (const [itemId, taskId] of ids) {
                const { ok, data } = await externalApi.taskStatus(taskId);
                if (!ok || !data.success) continue;
                if (data.data.ready) {
                    const result = data.data.result;
                    setResults(prev => ({
                        ...prev,
                        [itemId]: {
                            loading: false,
                            ok: result.success,
                            message: config.formatResult(result),
                        },
                    }));
                    setTaskIds(prev => {
                        const next = { ...prev };
                        delete next[itemId];
                        return next;
                    });
                }
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [taskIds]);

    const runItem = async (itemId) => {
        setResults(prev => ({
            ...prev,
            [itemId]: { loading: true, ok: null, message: '⏳ Запуск...' },
        }));

        const { ok, data } = await config.runItem(itemId, opts);

        if (!ok || !data.success) {
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: false, ok: false, message: data?.error || 'Ошибка' },
            }));
            return;
        }

        if (config.isAsync) {
            // Ждём через поллинг
            setTaskIds(prev => ({ ...prev, [itemId]: data.data.task_id }));
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: true, ok: null, message: '⏳ Выполняется...' },
            }));
        } else {
            // Результат сразу
            setResults(prev => ({
                ...prev,
                [itemId]: {
                    loading: false,
                    ok: data.success,
                    message: config.formatResult(data),
                },
            }));
        }
    };

    const runAll = async () => {
        setRunningAll(true);
        for (const item of items) {
            await runItem(item.id);
        }
        setRunningAll(false);
    };

    if (!can(user, config.permission)) return null;

    const anyLoading = Object.values(results).some(r => r.loading);

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
                        {config.title}
                    </h2>
                    <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600
                                       dark:hover:text-gray-300 text-lg">
                        ×
                    </button>
                </div>

                {/* Доп. контролы (если есть) */}
                {config.extraControls && (
                    <div className="px-5 pt-3">
                        {config.extraControls(opts, setOpts)}
                    </div>
                )}

                {/* Список */}
                <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
                    {items.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Загрузка...
                        </p>
                    )}
                    {items.map(item => {
                        const state = results[item.id];
                        return (
                            <div key={item.id}
                                 className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-800 dark:text-gray-200">
                                        {item.name}
                                    </span>
                                    {state?.message && (
                                        <p className={`text-xs mt-0.5 ${
                                            state.ok === true  ? 'text-emerald-500' :
                                            state.ok === false ? 'text-red-500' :
                                            'text-gray-400'
                                        }`}>
                                            {state.message}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => runItem(item.id)}
                                    disabled={state?.loading || runningAll}
                                    className={`shrink-0 px-3 py-1.5 text-xs font-medium
                                                rounded-lg text-white transition-colors
                                                disabled:opacity-40 ${config.btnColor}`}>
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
                        disabled={runningAll || anyLoading || items.length === 0}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                    text-white transition-colors disabled:opacity-40
                                    ${config.btnColor}`}>
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