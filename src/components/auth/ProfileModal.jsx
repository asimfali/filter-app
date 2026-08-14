import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../../api/auth';
import { bomApi } from '../../api/bom';
import { useTheme } from '../../contexts/ThemeContext';
import { can, PERM } from '../../utils/permissions';
import SyncModal from '../sync/SyncModal';
import PassportSyncModal from '../sync/PassportSyncModal';
import SelectionConfigModal from '../selection/SelectionConfigModal';
import { IconLink, IconFolder } from '../common/Icons';
import { useModals } from '../../hooks/useModals';

export default function ProfileModal({ user, onClose, onUpdated }) {
    const { dark, toggle, setDark } = useTheme();
    const { modals } = useModals();
    const [prefs, setPrefs] = useState(null);
    const [presets, setPresets] = useState([]);
    const [saving, setSaving] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef(null);
    const [specFolders, setSpecFolders] = useState([]);
    const [syncModal, setSyncModal] = useState(null);
    const [selectionConfigOpen, setSelectionConfigOpen] = useState(false);
    const [passportSyncOpen, setPassportSyncOpen] = useState(false);

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
                    {can(user, PERM.EXTERNAL_PUSH_TO_SITE) && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                      uppercase tracking-wide mb-2">
                                Внешний сайт
                            </p>
                            <button
                                onClick={() => setSyncModal('push_to_site')}
                                className="w-full px-3 py-2 text-sm font-medium rounded-lg
                       bg-emerald-600 hover:bg-emerald-700
                       text-white transition-colors">
                                Синхронизировать сайт
                            </button>
                            {can(user, PERM.EXTERNAL_PUSH_TO_SITE) && (
                                <button
                                    onClick={() => setSyncModal('fan_charts')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-indigo-600 hover:bg-indigo-700
                   text-white transition-colors">
                                    Синхронизировать графики
                                </button>
                            )}
                            {can(user, PERM.EXTERNAL_MANAGE_VARIANTS) && (
                                <button
                                    onClick={() => setSyncModal('variants')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-amber-600 hover:bg-amber-700
                   text-white transition-colors">
                                    <IconLink className="w-4 h-4 inline mr-1 align-middle" /> Группировка исполнений
                                </button>
                            )}
                            {can(user, PERM.EXTERNAL_RSYNC_MEDIA) && (
                                <button
                                    onClick={() => setSyncModal('rsync')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-teal-600 hover:bg-teal-700
                   text-white transition-colors">
                                    Rsync медиафайлов
                                </button>
                            )}
                            {can(user, PERM.PORTAL_S3_UPLOAD) && (
                                <button
                                    onClick={() => setSyncModal('s3_media')}
                                    className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-sky-600 hover:bg-sky-700
                   text-white transition-colors">
                                    Медиа → S3
                                </button>
                            )}
                        </div>
                    )}

                    {(can(user, PERM.EXTERNAL_SYNC_PRICES) || can(user, PERM.EXTERNAL_SYNC_CATALOG)) && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                      uppercase tracking-wide mb-2">
                                Синхронизация с 1С
                            </p>
                            <div className="space-y-2">
                                {can(user, PERM.EXTERNAL_SYNC_PRICES) && (
                                    <button
                                        onClick={() => setSyncModal('prices')}
                                        className="w-full px-3 py-2 text-sm font-medium rounded-lg
                               bg-blue-600 hover:bg-blue-700
                               text-white transition-colors">
                                        Обновить цены
                                    </button>
                                )}
                                {can(user, PERM.EXTERNAL_SYNC_CATALOG) && (
                                    <button
                                        onClick={() => setSyncModal('catalog')}
                                        className="w-full px-3 py-2 text-sm font-medium rounded-lg
                               bg-violet-600 hover:bg-violet-700
                               text-white transition-colors">
                                        Синхронизировать каталог
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

                    {can(user, PERM.PDF_SPEC_WRITE) && (
                        <button
                            onClick={() => setSyncModal('extract')}
                            className="w-full px-3 py-2 text-sm font-medium rounded-lg
                                    bg-blue-600 hover:bg-blue-700
                                    text-white transition-colors">
                            Импорт характеристик PDF
                        </button>
                    )}

                    {(can(user, PERM.PASSPORT_DOCUMENTS_UPLOAD) || can(user, PERM.PASSPORT_DOCUMENTS_UPDATE)) && (
                        <button
                            onClick={() => setPassportSyncOpen(true)}
                            className="w-full px-3 py-2 text-sm font-medium rounded-lg
                bg-cyan-600 hover:bg-cyan-700
                text-white transition-colors">
                            Синхронизация паспортов
                        </button>
                    )}

                    {can(user, PERM.PORTAL_CHART_WRITE) && (
                        <button
                            onClick={() => setSyncModal('dxf_import')}
                            className="w-full px-3 py-2 text-sm font-medium rounded-lg
                   bg-violet-600 hover:bg-violet-700
                   text-white transition-colors">
                            Импорт DXF (аэродинамика)
                        </button>
                    )}

                    {/* Настройки подбора */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-2">
                            Подбор завес
                        </p>
                        <button
                            onClick={() => setSelectionConfigOpen(true)}
                            className="w-full px-3 py-2 text-sm font-medium rounded-lg
                                bg-blue-600 hover:bg-blue-700
                                text-white transition-colors">
                            Настройки исключений
                        </button>
                    </div>

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
                    {can(user, PERM.BOM_SPEC_PUSH) && presets.length > 0 && (
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
                    {can(user, PERM.BOM_SPEC_PUSH) && specFolders.length > 0 && (
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
                    {can(user, PERM.BOM_SPEC_PUSH) && (
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
                    )}
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
                <SelectionConfigModal
                    open={selectionConfigOpen}
                    onClose={() => setSelectionConfigOpen(false)}
                    onSaved={() => showSuccess('Настройки подбора сохранены')}
                />

                {passportSyncOpen && (
                    <PassportSyncModal
                        user={user}
                        onClose={() => setPassportSyncOpen(false)}
                    />
                )}
            </div>
            {modals}
        </div>
    );
}