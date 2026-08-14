import React, { useState, useEffect } from 'react';
import { externalApi } from '../../api/external';
import { catalogApi } from '../../api/catalog';
import { mediaApi } from '../../api/media';
import { can, PERM } from '../../utils/permissions';
import { selectionApi } from '../../api/selection';
import { IconLink, IconClock } from '../common/Icons';
import Modal from '../common/Modal';

// ─── Конфигурация режимов ─────────────────────────────────────────────────

const MODE_CONFIG = {
    prices: {
        title: 'Обновить цены',
        btnColor: 'bg-blue-600 hover:bg-blue-700',
        permission: PERM.EXTERNAL_SYNC_PRICES,
        loadItems: () => externalApi.getSyncConfigs(),
        runItem: (id) => externalApi.syncPrices(id),
        isAsync: true, // возвращает task_id
        formatResult: (result) => result.success
            ? `✓ Создано: ${result.created}, обновлено: ${result.updated}${result.errors ? `, ошибок: ${result.errors}` : ''}`
            : `✗ ${result.error}`,
    },
    catalog: {
        title: 'Синхронизировать каталог',
        btnColor: 'bg-violet-600 hover:bg-violet-700',
        permission: PERM.EXTERNAL_SYNC_CATALOG,
        loadItems: () => externalApi.getSyncConfigs(),
        runItem: (id) => externalApi.syncCatalog(id),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Создано: ${result.created}, обновлено: ${result.updated}${result.errors ? `, ошибок: ${result.errors}` : ''}`
            : `✗ ${result.error}`,
    },
    variants: {
        title: <><IconLink className="w-4 h-4 inline mr-1" />Группировка исполнений</>,
        btnColor: 'bg-amber-600 hover:bg-amber-700',
        permission: PERM.EXTERNAL_MANAGE_VARIANTS,
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
        title: 'Rsync медиафайлов',
        btnColor: 'bg-teal-600 hover:bg-teal-700',
        permission: PERM.EXTERNAL_RSYNC_MEDIA,
        loadItems: () => externalApi.getRsyncFolders(),
        runItem: (id, opts) => externalApi.rsyncMedia(id, opts?.syncDocuments ?? true),
        isAsync: true,
        formatResult: (result) => {
            if (result.success) {
                const count = result.folders?.length ?? 0;
                const docsMsg = result.documents_synced
                    ? `, документов: ${result.documents_synced}`
                    : '';
                return `✓ Синхронизировано папок: ${count}${docsMsg}`;
            }
            const errs = result.errors?.map(e => `${e.folder}: ${e.error}`).join('; ');
            const docsErr = result.documents_error ? ` | Документы: ${result.documents_error}` : '';
            return `✗ ${errs || 'Ошибка'}${docsErr}`;
        },
    },
    push_to_site: {
        title: 'Синхронизировать сайт',
        btnColor: 'bg-emerald-600 hover:bg-emerald-700',
        permission: PERM.EXTERNAL_PUSH_TO_SITE,
        // "Весь каталог" + по одному пункту на раздел (product_type_slug) —
        // список разделов из /catalog/product-types/.
        loadItems: async () => {
            const { ok, data } = await catalogApi.productTypes();
            if (!ok) return { ok, data };
            const types = data.results ?? data;
            const items = [
                { id: '', name: 'Весь каталог' },
                ...(Array.isArray(types) ? types : []).map(t => ({ id: t.slug, name: t.name })),
            ];
            return { ok: true, data: { success: true, data: items } };
        },
        runItem: (itemId) => externalApi.pushToSite(null, itemId || null),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Отправлено ${result.pushed} товаров`
            : `✗ Ошибка: ${result.error}`,
    },
    fan_charts: {
        title: 'Синхронизировать графики',
        btnColor: 'bg-indigo-600 hover:bg-indigo-700',
        permission: PERM.EXTERNAL_PUSH_TO_SITE,
        loadItems: async () => ({
            ok: true,
            data: {
                success: true,
                data: [{ id: 'fan_charts', name: 'Аэродинамические графики' }],
            },
        }),
        runItem: () => externalApi.pushFanCharts(),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Отправлено графиков: ${result.total}`
            : `✗ ${result.error}`,
    },
    dxf_import: {
        title: 'Импорт DXF (аэродинамика)',
        btnColor: 'bg-violet-600 hover:bg-violet-700',
        permission: PERM.PORTAL_CHART_WRITE,
        // Статический список — один пункт "Загрузить файлы"
        loadItems: async () => ({
            ok: true,
            data: { success: true, data: [{ id: 'dxf', name: 'DXF-файлы вентиляторов' }] },
        }),
        isAsync: true,
        formatResult: (result) =>
            result.success !== false
                ? `✓ Импортировано файлов: ${result.files_done ?? 0}, ошибок: ${result.files_failed ?? 0}`
                : `✗ Ошибка`,
    },
    extract: {
        title: 'Импорт характеристик из PDF',
        btnColor: 'bg-blue-600 hover:bg-blue-700',
        permission: PERM.PDF_SPEC_WRITE,
        loadItems: async () => ({
            ok: true,
            data: {
                success: true,
                data: [{ id: 'zavesy', name: 'Воздушные завесы' }],
            },
        }),
        isAsync: true,
        formatResult: (result) => `✓ Найдено: ${result.items_found} моделей`,
    },
    s3_media: {
        title: 'Медиа → S3',
        btnColor: 'bg-sky-600 hover:bg-sky-700',
        permission: PERM.PORTAL_S3_UPLOAD,  // ← гейт на вход в модалку
        // Список типов — из /media/form-data/: любой accepts_images-тип + hero_video
        // (видео пока не generic на бэкенде, отдельное исключение по code).
        loadItems: async () => {
            const { ok, data } = await mediaApi.getFormData();
            if (!ok) return { ok, data };
            const items = (data.doc_types || [])
                .filter(dt => dt.accepts_images || dt.code === 'hero_video')
                .map(dt => ({ id: dt.code, name: `${dt.name} (полная синхронизация)` }));
            return { ok, data: { success: true, data: items } };
        },
        runItem: (itemId) => mediaApi.syncMediaToS3(itemId),
        isAsync: true,
        formatResult: (result) => result.success
            ? `✓ Папок: ${result.folders}, загружено: ${result.uploaded}, удалено: ${result.deleted ?? 0}, без изменений: ${result.skipped}${result.errors?.length ? `, ошибок: ${result.errors.length}` : ''}`
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
    const [files, setFiles] = useState({});
    const [applyResults, setApplyResults] = useState({});
    const [dxfProduct, setDxfProduct] = useState('');
    const [dxfMerge, setDxfMerge] = useState(false);
    const [dxfExistsWarning, setDxfExistsWarning] = useState(false);
    const [pendingDxfItem, setPendingDxfItem] = useState(null);
    const [dxfConfig, setDxfConfig] = useState({})

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
                let ok, data;
                if (mode === 'extract') {
                    const { selectionApi } = await import('../../api/selection');
                    ({ ok, data } = await selectionApi.extractStatus(taskId));
                } else if (mode === 'dxf_import') {
                    const { selectionApi } = await import('../../api/selection');
                    ({ ok, data } = await selectionApi.dxfImportStatus(taskId));
                } else {
                    ({ ok, data } = await externalApi.taskStatus(taskId));
                }

                if (!ok || !data.success) continue;

                const isReady = mode === 'extract'
                    ? data.data.status === 'COMPLETED' || data.data.status === 'FAILED'
                    : (mode === 'dxf_import')
                        ? data.data.status === 'COMPLETED' || data.data.status === 'FAILED'
                        : data.data.ready;

                if (isReady) {
                    const isFailed = data.data.status === 'FAILED';
                    const msg = (mode === 'extract')
                        ? (isFailed
                            ? `✗ ${data.data.error_log?.error || 'Ошибка'}`
                            : `✓ Найдено: ${data.data.items_found} моделей`)
                        : (mode === 'dxf_import')
                            ? (isFailed
                                ? `✗ Ошибка импорта`
                                : `✓ Файлов: ${data.data.files_done}, ошибок: ${data.data.files_failed}`)
                            : config.formatResult(data.data.result);

                    setResults(prev => ({
                        ...prev,
                        [itemId]: {
                            loading: false,
                            ok: !isFailed,
                            message: msg,
                            ...(mode === 'extract' && !isFailed ? { taskId } : {}),
                        },
                    }));
                    setTaskIds(prev => { const n = { ...prev }; delete n[itemId]; return n; });
                }
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [taskIds]);

    const checkAndRunDxf = async (itemId) => {
        const fileList = files[itemId];
        if (!fileList?.length) {
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: false, ok: false, message: 'Выберите DXF-файлы' },
            }));
            return;
        }

        // Проверяем существование по имени первого файла
        const product = dxfProduct.trim() || fileList[0].name.replace('.dxf', '');
        const { ok, data } = await selectionApi.dxfCheckExists(product);
        const exists = ok && data?.results?.length > 0 || (Array.isArray(data) && data.length > 0);

        if (exists && !dxfExistsWarning) {
            setPendingDxfItem(itemId);
            setDxfExistsWarning(true);
            return;
        }

        setDxfExistsWarning(false);
        setPendingDxfItem(null);
        runItem(itemId);
    };

    const runDxfImport = async (itemId, merge) => {
        const fileList = files[itemId];
        const configFile = dxfConfig[itemId]
        const product = dxfProduct.trim() || fileList[0].name.replace('.dxf', '');
        setResults(prev => ({
            ...prev,
            [itemId]: { loading: true, ok: null, message: 'Запуск...' },
        }));

        const { ok, data } = await selectionApi.dxfImportUpload(
            Array.from(fileList),
            product,
            20.0,
            true,
            merge,
            configFile,
        );

        if (!ok || !data.success) {
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: false, ok: false, message: data?.error?.message || 'Ошибка' },
            }));
            return;
        }

        setTaskIds(prev => ({ ...prev, [itemId]: data.data.task_id }));
        setResults(prev => ({
            ...prev,
            [itemId]: { loading: true, ok: null, message: 'Выполняется...' },
        }));
    };

    const runItem = async (itemId, overrideOpts) => {
        setResults(prev => ({
            ...prev,
            [itemId]: { loading: true, ok: null, message: 'Запуск...' },
        }));

        let ok, data;

        if (mode === 'extract') {
            const file = files[itemId];
            if (!file) {
                setResults(prev => ({
                    ...prev,
                    [itemId]: { loading: false, ok: false, message: 'Выберите файл' },
                }));
                return;
            }
            const { selectionApi } = await import('../../api/selection');
            ({ ok, data } = await selectionApi.extractUpload(itemId, file));

        } else if (mode === 'dxf_import') {
            const fileList = files[itemId];  // FileList или массив
            if (!fileList || !fileList.length) {
                setResults(prev => ({
                    ...prev,
                    [itemId]: { loading: false, ok: false, message: 'Выберите DXF-файлы' },
                }));
                return;
            }
            const { selectionApi } = await import('../../api/selection');
            ({ ok, data } = await selectionApi.dxfImportUpload(
                Array.from(fileList),
                dxfProduct.trim() || fileList[0].name.replace('.dxf', ''),
                20.0,
                true,
                dxfMerge,
                dxfConfig[itemId],
            ));

        } else {
            ({ ok, data } = await config.runItem(itemId, overrideOpts ?? opts));
        }

        if (!ok || !data.success) {
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: false, ok: false, message: data?.error?.message || 'Ошибка' },
            }));
            return;
        }

        if (config.isAsync) {
            setTaskIds(prev => ({ ...prev, [itemId]: data.data.task_id }));
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: true, ok: null, message: 'Выполняется...' },
            }));
        } else {
            setResults(prev => ({
                ...prev,
                [itemId]: { loading: false, ok: true, message: config.formatResult(data) },
            }));
        }
    };

    const runAll = async () => {
        setRunningAll(true);
        for (let i = 0; i < items.length; i++) {
            const isLast = i === items.length - 1;
            // Документы синхронизируем только на последнем шаге батча
            await runItem(items[i].id, mode === 'rsync' ? { syncDocuments: isLast } : undefined);
        }
        setRunningAll(false);
    };

    if (!can(user, config.permission)) return null;

    const anyLoading = Object.values(results).some(r => r.loading);

    return (
        <Modal title={config.title} onClose={onClose} maxWidth="sm" scrollBody closeOnBackdropClick
            footer={
                <div className="flex gap-2">
                    <button
                        onClick={runAll}
                        disabled={runningAll || anyLoading || items.length === 0}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg
                                    text-white transition-colors disabled:opacity-40
                                    ${config.btnColor}`}>
                        {runningAll ? 'Запуск всех...' : 'Запустить все'}
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
            }>
                {/* Доп. контролы (если есть) */}
                {config.extraControls && (
                    <div className="mb-3">
                        {config.extraControls(opts, setOpts)}
                    </div>
                )}

                {/* Список */}
                <div className="space-y-2">
                    {items.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Загрузка...
                        </p>
                    )}
                    {items.map(item => {
                        const state = results[item.id];
                        const fileInputId = `extract-file-${item.id}`;
                        return (
                            <div key={item.id} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <span className="text-sm text-gray-800 dark:text-gray-200">
                                            {item.name}
                                        </span>
                                        {state?.message && (
                                            <p className={`text-xs mt-0.5 ${state.ok === true ? 'text-emerald-500' :
                                                state.ok === false ? 'text-red-500' :
                                                    'text-gray-400'
                                                }`}>
                                                {state.message}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() =>
                                            mode === 'extract'
                                                ? document.getElementById(fileInputId)?.click()
                                                : mode === 'dxf_import'
                                                    ? document.getElementById(`dxf-file-${item.id}`)?.click()
                                                    : runItem(item.id)
                                        }
                                        disabled={state?.loading || runningAll}
                                        className={`shrink-0 px-3 py-1.5 text-xs font-medium
                                                    rounded-lg text-white transition-colors
                                                    disabled:opacity-40 ${config.btnColor}`}>
                                        {state?.loading
                                            ? <IconClock className="w-4 h-4" />
                                            : mode === 'extract' ? 'Выбрать PDF'
                                                : mode === 'dxf_import' ? 'Выбрать DXF'
                                                    : 'Запустить'
                                        }
                                    </button>
                                </div>

                                {/* Extract: файл + кнопки */}
                                {mode === 'extract' && (
                                    <>
                                        <input
                                            id={fileInputId}
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            onChange={e => {
                                                const f = e.target.files[0];
                                                if (f) setFiles(prev => ({ ...prev, [item.id]: f }));
                                            }}
                                        />
                                        {files[item.id] && !state?.loading && (
                                            <div className="flex gap-1.5">
                                                <span className="text-xs text-gray-400 truncate flex-1">
                                                    {files[item.id].name}
                                                </span>
                                                <button
                                                    onClick={() => runItem(item.id)}
                                                    disabled={state?.loading}
                                                    className="shrink-0 px-2 py-1 text-xs rounded
                                                            bg-blue-600 hover:bg-blue-700
                                                            text-white transition-colors">
                                                    Обработать
                                                </button>
                                            </div>
                                        )}
                                        {state?.ok && state?.taskId && !applyResults[item.id] && (
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={async () => {
                                                        const { selectionApi } = await import('../../api/selection');
                                                        const { data } = await selectionApi.extractApply(state.taskId, true);
                                                        if (data.success) setApplyResults(prev => ({ ...prev, [item.id]: { ...data.data, dry_run: true } }));
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs rounded
                                                            bg-neutral-200 dark:bg-neutral-700
                                                            text-gray-700 dark:text-gray-300
                                                            hover:bg-neutral-300 transition-colors">
                                                    Dry run
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const { selectionApi } = await import('../../api/selection');
                                                        const { data } = await selectionApi.extractApply(state.taskId, false);
                                                        if (data.success) setApplyResults(prev => ({ ...prev, [item.id]: data.data }));
                                                    }}
                                                    className="flex-1 px-2 py-1 text-xs rounded
                                                            bg-emerald-600 hover:bg-emerald-700
                                                            text-white transition-colors">
                                                    Применить
                                                </button>
                                            </div>
                                        )}
                                        {applyResults[item.id] && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {applyResults[item.id].dry_run && <span className="text-amber-500">dry run · </span>}
                                                найдено {applyResults[item.id].matched} · создано {applyResults[item.id].created} · обновлено {applyResults[item.id].updated}
                                            </p>
                                        )}
                                    </>
                                )}

                                {mode === 'dxf_import' && (
                                    <>
                                        <input
                                            id={`dxf-file-${item.id}`}
                                            type="file" accept=".dxf,.json" multiple className="hidden"
                                            onChange={e => {
                                                if (e.target.files?.length)
                                                    setFiles(prev => ({ ...prev, [item.id]: e.target.files }));
                                                // Сбросить предупреждение при смене файлов
                                                setDxfExistsWarning(false);
                                            }}
                                        />
                                        <input
                                            value={dxfProduct}
                                            onChange={e => setDxfProduct(e.target.value)}
                                            placeholder="External ID (если пусто — из имени файла)"
                                            className="w-full text-xs px-3 py-1.5 rounded-lg border
                       border-gray-200 dark:border-gray-700
                       bg-white dark:bg-neutral-800
                       text-gray-900 dark:text-white
                       focus:outline-none focus:border-blue-500"
                                        />

                                        {/* config.json — опционально */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                id={`dxf-config-${item.id}`}
                                                type="file"
                                                accept=".json"
                                                className="hidden"
                                                onChange={e => {
                                                    const f = e.target.files[0]
                                                    if (f) setDxfConfig(prev => ({ ...prev, [item.id]: f }))
                                                }}
                                            />
                                            <button
                                                onClick={() => document.getElementById(`dxf-config-${item.id}`)?.click()}
                                                className={`px-2 py-1 text-xs rounded border transition-colors
            ${dxfConfig[item.id]
                                                        ? 'border-emerald-400 text-emerald-500'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-blue-400'
                                                    }`}>
                                                {dxfConfig[item.id] ? '✓ config.json' : '+ config.json'}
                                            </button>
                                            {dxfConfig[item.id] && (
                                                <button
                                                    onClick={() => setDxfConfig(prev => { const n = { ...prev }; delete n[item.id]; return n })}
                                                    className="text-xs text-gray-400 hover:text-red-400">
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        {/* Диалог при существующем графике */}
                                        {dxfExistsWarning && pendingDxfItem === item.id && (
                                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20
                            border border-amber-200 dark:border-amber-700 space-y-2">
                                                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                                                    График уже существует в БД
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setDxfExistsWarning(false);
                                                            setPendingDxfItem(null);
                                                            runDxfImport(item.id, false);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 text-xs rounded-lg
               bg-red-600 hover:bg-red-700 text-white transition-colors">
                                                        Заменить
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDxfExistsWarning(false);
                                                            setPendingDxfItem(null);
                                                            runDxfImport(item.id, true);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 text-xs rounded-lg
               bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                                                        Добавить кривые
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {files[item.id] && !results[item.id]?.loading && !dxfExistsWarning && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 flex-1">
                                                    {files[item.id].length} файл(ов)
                                                </span>
                                                <button
                                                    onClick={() => checkAndRunDxf(item.id)}
                                                    className="px-2 py-1 text-xs rounded
                               bg-violet-600 hover:bg-violet-700
                               text-white transition-colors">
                                                    Импортировать
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
        </Modal>
    );
}