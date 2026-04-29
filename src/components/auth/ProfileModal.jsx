import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../../api/auth';
import { bomApi } from '../../api/bom';
import { useTheme } from '../../contexts/ThemeContext';
import { externalApi } from '../../api/external';
import { can } from '../../utils/permissions';
import SyncModal from '../sync/SyncModal';

export default function ProfileModal({ user, onClose, onUpdated }) {
    const { dark, toggle, setDark } = useTheme();
    const [prefs, setPrefs] = useState(null);
    const [presets, setPresets] = useState([]);
    const [saving, setSaving] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef(null);
    const [specFolders, setSpecFolders] = useState([]);
    const [pushing, setPushing] = useState(false);
    const [pushResult, setPushResult] = useState(null);
    const [pushTaskId, setPushTaskId] = useState(null);
    const [syncingPrices, setSyncingPrices] = useState(false);
    const [syncPricesResult, setSyncPricesResult] = useState(null);
    const [syncingCatalog, setSyncingCatalog] = useState(false);
    const [syncCatalogResult, setSyncCatalogResult] = useState(null);
    const [syncModal, setSyncModal] = useState(null);

    useEffect(() => {
        if (!pushTaskId) return;
        const interval = setInterval(async () => {
            const { ok, data } = await externalApi.taskStatus(pushTaskId);
            if (!ok || !data.success) return;
            if (data.data.ready) {
                clearInterval(interval);
                setPushTaskId(null);
                setPushing(false);
                const result = data.data.result;
                setPushResult({
                    ok: result.success,
                    message: result.success
                        ? `✓ Отправлено ${result.pushed} товаров`
                        : `✗ Ошибка: ${result.error}`,
                });
                setTimeout(() => setPushResult(null), 5000);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [pushTaskId]);

    useEffect(() => {
        // Загружаем настройки и пресеты параллельно
        Promise.all([
            authApi.getPreferences(),
            bomApi.getStagePresets(),
        ]).then(([prefsRes, presetsRes]) => {
            if (prefsRes.ok && prefsRes.data.success) {
                setPrefs(prefsRes.data.data);
                bomApi.getFolders('spec').then(({ ok, data }) => {
                    if (ok && data.success) setSpecFolders(data.data);
                });
                setAvatarUrl(prefsRes.data.data.avatar_url);
                // Синхронизируем тему
                const theme = prefsRes.data.data.theme;
                if (theme === 'dark') setDark(true);
                else if (theme === 'light') setDark(false);
            }
            if (presetsRes.ok && presetsRes.data.success) {
                setPresets(presetsRes.data.data);
            }
        });
    }, []);

    const handlePushToSite = async () => {
        if (!confirm('Отправить все товары на внешний сайт?')) return;
        setPushing(true);
        setPushResult(null);
        const { ok, data } = await externalApi.pushToSite();
        if (ok && data.success) {
            setPushTaskId(data.data.task_id);
            setPushResult({ ok: true, message: `⏳ Запущено (${data.data.total} товаров)...` });
        } else {
            setPushing(false);
            setPushResult({ ok: false, message: data.error || 'Ошибка' });
        }
    };

    const handleSyncPrices = async () => {
        if (!confirm('Синхронизировать цены из 1С?')) return;
        setSyncingPrices(true);
        setSyncPricesResult(null);
        const { ok, data } = await externalApi.syncPrices();
        setSyncingPrices(false);
        if (ok && data.success) {
            setSyncPricesResult({
                ok: true,
                message: `⏳ Запущено (${data.data.configs_count} конфигов)`,
            });
        } else {
            setSyncPricesResult({
                ok: false,
                message: data.error || 'Ошибка',
            });
        }
        setTimeout(() => setSyncPricesResult(null), 5000);
    };

    const handleSyncCatalog = async () => {
        if (!confirm('Запустить полную синхронизацию каталога из 1С? Это займёт около минуты.')) return;
        setSyncingCatalog(true);
        setSyncCatalogResult(null);
        const { ok, data } = await externalApi.syncCatalog();
        setSyncingCatalog(false);
        if (ok && data.success) {
            setSyncCatalogResult({
                ok: true,
                message: `⏳ Запущено (${data.data.configs_count} конфигов)`,
            });
        } else {
            setSyncCatalogResult({
                ok: false,
                message: data.error || 'Ошибка',
            });
        }
        setTimeout(() => setSyncCatalogResult(null), 5000);
    };

    const handleThemeChange = async (theme) => {
        if (theme === 'dark') setDark(true);
        else if (theme === 'light') setDark(false);
        else {
            // system — берём из медиазапроса
            setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        const { ok, data } = await authApi.updatePreferences({ theme });
        if (ok && data.success) setPrefs(data.data);
    };

    const handlePresetChange = async (presetId) => {
        setSaving(true);
        const { ok, data } = await authApi.updatePreferences({
            default_stage_preset_id: presetId ? parseInt(presetId) : null,
        });
        if (ok && data.success) {
            setPrefs(data.data);
            showSuccess('Настройки сохранены');
        }
        setSaving(false);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarLoading(true);
        const { ok, data } = await authApi.uploadAvatar(file);
        if (ok && data.success) {
            setAvatarUrl(data.data.avatar_url);
            onUpdated?.();
            showSuccess('Аватарка обновлена');
        }
        setAvatarLoading(false);
    };

    const handleAvatarDelete = async () => {
        setAvatarLoading(true);
        const { ok } = await authApi.deleteAvatar();
        if (ok) {
            setAvatarUrl(null);
            onUpdated?.();
            showSuccess('Аватарка удалена');
        }
        setAvatarLoading(false);
    };

    const showSuccess = (msg) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 2000);
    };

    // Закрытие по Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const THEMES = [
        { id: 'light', label: '☀️ Светлая' },
        { id: 'dark', label: '🌙 Тёмная' },
        { id: 'system', label: '💻 Системная' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end"
            onClick={onClose}>
            <div className="mt-14 mr-4 w-80 bg-white dark:bg-neutral-900
                            rounded-xl shadow-2xl
                            border border-gray-200 dark:border-gray-700
                            overflow-hidden"
                onClick={e => e.stopPropagation()}>

                {/* Шапка */}
                <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800
                                flex items-center gap-3">
                    {/* Аватарка */}
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden
                                        bg-neutral-200 dark:bg-neutral-700 flex items-center
                                        justify-center cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="avatar"
                                    className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl text-gray-400">
                                    {user?.full_name?.[0] || user?.email?.[0] || '?'}
                                </span>
                            )}
                            {avatarLoading && (
                                <div className="absolute inset-0 bg-black/40 rounded-full
                                                flex items-center justify-center">
                                    <span className="text-white text-xs">···</span>
                                </div>
                            )}
                        </div>
                        {/* Кнопка смены аватарки */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-0.5 -right-0.5 w-5 h-5
                                       bg-blue-600 rounded-full text-white
                                       flex items-center justify-center text-xs
                                       hover:bg-blue-700 transition-colors"
                            title="Сменить аватарку">
                            ✎
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleAvatarUpload}
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                            {user?.full_name || user?.username || '—'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user?.email}
                        </div>
                        {avatarUrl && (
                            <button
                                onClick={handleAvatarDelete}
                                className="text-xs text-red-400 hover:text-red-600
                                           transition-colors mt-0.5">
                                Удалить фото
                            </button>
                        )}
                    </div>
                </div>

                {/* Настройки */}
                <div className="px-4 py-3 space-y-4">

                    {/* Сообщение об успехе */}
                    {successMsg && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400
                                        bg-emerald-50 dark:bg-emerald-900/20
                                        px-3 py-2 rounded-lg">
                            ✓ {successMsg}
                        </div>
                    )}

                    {/* Синхронизация с внешним сайтом */}
                    {can(user, 'external.push_to_site') && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                      uppercase tracking-wide mb-2">
                                Внешний сайт
                            </p>
                            <button
                                onClick={handlePushToSite}
                                disabled={pushing}
                                className="w-full px-3 py-2 text-sm font-medium rounded-lg
                       bg-emerald-600 hover:bg-emerald-700
                       disabled:opacity-40 text-white transition-colors">
                                {pushing ? '⏳ Отправка...' : '🌐 Синхронизировать сайт'}
                            </button>
                            {can(user, 'external.manage_variants') && (
                                <button
                                    onClick={() => setSyncModal('variants')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-amber-600 hover:bg-amber-700
                   text-white transition-colors">
                                    🔗 Группировка исполнений
                                </button>
                            )}
                            {can(user, 'external.rsync_media') && (
                                <button
                                    onClick={() => setSyncModal('rsync')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-teal-600 hover:bg-teal-700
                   text-white transition-colors">
                                    📂 Rsync медиафайлов
                                </button>
                            )}
                            {pushResult && (
                                <p className={`text-xs mt-1.5 ${pushResult.ok
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-500'}`}>
                                    {pushResult.message}
                                </p>
                            )}
                        </div>
                    )}

                    {(can(user, 'external.sync_prices') || can(user, 'external.sync_catalog')) && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                      uppercase tracking-wide mb-2">
                                Синхронизация с 1С
                            </p>
                            <div className="space-y-2">
                                {can(user, 'external.sync_prices') && (
                                    <button
                                        onClick={() => setSyncModal('prices')}
                                        className="w-full px-3 py-2 text-sm font-medium rounded-lg
                               bg-blue-600 hover:bg-blue-700
                               text-white transition-colors">
                                        💰 Обновить цены
                                    </button>
                                )}
                                {can(user, 'external.sync_catalog') && (
                                    <button
                                        onClick={() => setSyncModal('catalog')}
                                        className="w-full px-3 py-2 text-sm font-medium rounded-lg
                               bg-violet-600 hover:bg-violet-700
                               text-white transition-colors">
                                        🔄 Синхронизировать каталог
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Модалка синхронизации */}
                    {syncModal && (
                        <SyncModal
                            user={user}
                            mode={syncModal}
                            onClose={() => setSyncModal(null)}
                        />
                    )}

                    {/* Тема */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                                      uppercase tracking-wide mb-2">
                            Тема
                        </p>
                        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800
                                        p-1 rounded-lg">
                            {THEMES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleThemeChange(t.id)}
                                    className={`flex-1 px-2 py-1.5 rounded text-xs
                                                font-medium transition-colors
                                        ${prefs?.theme === t.id
                                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                        }`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Пресет этапов */}
                    {presets.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                                      uppercase tracking-wide mb-2">
                                Пресет этапов сборки
                            </p>
                            <select
                                value={prefs?.default_assembly_stage_preset_id || ''}
                                onChange={async (e) => {
                                    setSaving(true);
                                    const { ok, data } = await authApi.updatePreferences({
                                        default_assembly_stage_preset_id: e.target.value
                                            ? parseInt(e.target.value) : null,
                                    });
                                    if (ok && data.success) {
                                        setPrefs(data.data);
                                        showSuccess('Настройки сохранены');
                                    }
                                    setSaving(false);
                                }}
                                disabled={saving}
                                className="w-full px-3 py-1.5 text-sm rounded-lg
                                       bg-neutral-50 dark:bg-neutral-800
                                       border border-gray-200 dark:border-gray-700
                                       text-gray-900 dark:text-white
                                       focus:outline-none focus:border-blue-500
                                       disabled:opacity-60 transition-colors">
                                <option value="">— Не выбран —</option>
                                {presets.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.is_default ? ' ★' : ''}
                                    </option>
                                ))}
                            </select>
                            {prefs?.default_assembly_stage_preset_name && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    Текущий: {prefs.default_assembly_stage_preset_name}
                                </p>
                            )}
                        </div>
                    )}
                    {specFolders.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                      uppercase tracking-wide mb-2">
                                Папка спецификаций деталей
                            </p>
                            <select
                                value={prefs?.default_detail_spec_folder_id || ''}
                                onChange={async (e) => {
                                    setSaving(true);
                                    const { ok, data } = await authApi.updatePreferences({
                                        default_detail_spec_folder_id: e.target.value || null,
                                    });
                                    if (ok && data.success) {
                                        setPrefs(data.data);
                                        showSuccess('Настройки сохранены');
                                    }
                                    setSaving(false);
                                }}
                                disabled={saving}
                                className="w-full px-3 py-1.5 text-sm rounded-lg
                       bg-neutral-50 dark:bg-neutral-800
                       border border-gray-200 dark:border-gray-700
                       text-gray-900 dark:text-white
                       focus:outline-none focus:border-blue-500
                       disabled:opacity-60 transition-colors">
                                <option value="">— Не выбрана —</option>
                                {specFolders.map(f => (
                                    <option key={f.id} value={f.id}>{f.path}</option>
                                ))}
                            </select>
                            {prefs?.default_detail_spec_folder_path && (
                                <p className="text-xs text-gray-400 mt-1">
                                    {prefs.default_detail_spec_folder_path}
                                </p>
                            )}
                        </div>
                    )}
                    {/* Вид номенклатуры деталей */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                  uppercase tracking-wide mb-2">
                            Вид номенклатуры деталей
                        </p>
                        <input
                            value={prefs?.default_part_type || ''}
                            onChange={async (e) => {
                                const { ok, data } = await authApi.updatePreferences({
                                    default_part_type: e.target.value,
                                });
                                if (ok && data.success) setPrefs(data.data);
                            }}
                            placeholder="Полуфабрикат"
                            className="w-full px-3 py-1.5 text-sm rounded-lg
                   bg-neutral-50 dark:bg-neutral-800
                   border border-gray-200 dark:border-gray-700
                   text-gray-900 dark:text-white
                   focus:outline-none focus:border-blue-500
                   transition-colors"
                        />
                    </div>
                </div>

                {/* Футер */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={onClose}
                        className="w-full text-center text-xs text-gray-400
                                   dark:text-gray-500 hover:text-gray-600
                                   dark:hover:text-gray-300 transition-colors">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}