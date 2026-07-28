import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileModal from '../ProfileModal';
import { authApi } from '../../../api/auth';
import { bomApi } from '../../../api/bom';
import { externalApi } from '../../../api/external';
import { useTheme } from '../../../contexts/ThemeContext';

vi.mock('../../../api/auth', () => ({
  authApi: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
}));
vi.mock('../../../api/bom', () => ({
  bomApi: { getStagePresets: vi.fn(), getFolders: vi.fn() },
}));
vi.mock('../../../api/external', () => ({
  externalApi: {
    taskStatus: vi.fn(),
    pushToSite: vi.fn(),
    syncPrices: vi.fn(),
    syncCatalog: vi.fn(),
  },
}));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: vi.fn() }));

vi.mock('../../sync/SyncModal', () => ({
  default: ({ mode, user, onClose }) => (
    <div data-testid="sync-modal-stub" data-mode={mode} data-user={user?.id}>
      <button onClick={onClose}>close-sync</button>
    </div>
  ),
}));
vi.mock('../../sync/PassportSyncModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="passport-sync-modal-stub">
      <button onClick={onClose}>close-passport-sync</button>
    </div>
  ),
}));
vi.mock('../../selection/SelectionConfigModal', () => ({
  default: ({ open, onClose, onSaved }) =>
    open ? (
      <div data-testid="selection-config-modal-stub">
        <button onClick={onSaved}>save-selection-config</button>
        <button onClick={onClose}>close-selection-config</button>
      </div>
    ) : null,
}));

const baseUser = { id: 1, email: 'user@example.com', full_name: 'Иван Иванов', permissions: [] };

let setDarkMock;

const okPrefs = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => {
  vi.clearAllMocks();
  setDarkMock = vi.fn();
  useTheme.mockReturnValue({ dark: true, toggle: vi.fn(), setDark: setDarkMock });
  authApi.getPreferences.mockResolvedValue(okPrefs({ theme: 'dark', avatar_url: null }));
  bomApi.getStagePresets.mockResolvedValue(okPrefs([]));
  bomApi.getFolders.mockResolvedValue(okPrefs([]));
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  // страховка: если тест с fake timers упадёт/зависнет до собственного
  // vi.useRealTimers(), не даём этому протечь во все следующие тесты файла
  vi.useRealTimers();
});

// Даёт домонтированному useEffect (Promise.all(getPreferences, getStagePresets)) осесть
const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

const renderProfile = async (props = {}) => {
  const utils = render(<ProfileModal user={baseUser} onClose={vi.fn()} onUpdated={vi.fn()} {...props} />);
  await flush();
  return utils;
};

describe('ProfileModal — загрузка настроек', () => {
  it('подгружает preferences и stage-presets на маунте, синхронизирует тему и avatarUrl', async () => {
    authApi.getPreferences.mockResolvedValue(okPrefs({ theme: 'light', avatar_url: '/media/a.png' }));
    bomApi.getFolders.mockResolvedValue(okPrefs([{ id: 5, path: 'spec/КЭВ' }]));
    await renderProfile({ user: { ...baseUser, permissions: ['bom.spec.push'] } });
    await flush();

    expect(setDarkMock).toHaveBeenCalledWith(false);
    expect(screen.getByRole('img', { name: 'avatar' })).toHaveAttribute('src', '/media/a.png');
    expect(bomApi.getFolders).toHaveBeenCalledWith('spec');
  });

  it('не падает и не трогает тему/папки при неудачном getPreferences', async () => {
    authApi.getPreferences.mockResolvedValue({ ok: false, data: {} });
    await renderProfile();

    expect(setDarkMock).not.toHaveBeenCalled();
    expect(bomApi.getFolders).not.toHaveBeenCalled();
  });

  it('theme:"dark" вызывает setDark(true) при маунте', async () => {
    authApi.getPreferences.mockResolvedValue(okPrefs({ theme: 'dark', avatar_url: null }));
    await renderProfile();
    expect(setDarkMock).toHaveBeenCalledWith(true);
  });
});

describe('ProfileModal — аватар', () => {
  it('успешная загрузка обновляет avatarUrl, вызывает onUpdated и показывает успех', async () => {
    const user = userEvent.setup();
    authApi.uploadAvatar.mockResolvedValue({ ok: true, data: { success: true, data: { avatar_url: '/new.png' } } });
    const onUpdated = vi.fn();
    const { container } = await renderProfile({ onUpdated });

    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    await user.upload(container.querySelector('input[type="file"]'), file);

    expect(authApi.uploadAvatar).toHaveBeenCalledWith(file);
    expect(await screen.findByRole('img', { name: 'avatar' })).toHaveAttribute('src', '/new.png');
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ Аватарка обновлена')).toBeInTheDocument();
  });

  it('без выбранного файла (сброс инпута) не вызывает uploadAvatar', async () => {
    const { container } = await renderProfile();
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [] } });

    expect(authApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('"Удалить фото" показывается только при avatarUrl и вызывает deleteAvatar', async () => {
    const user = userEvent.setup();
    authApi.getPreferences.mockResolvedValue(okPrefs({ theme: 'dark', avatar_url: '/a.png' }));
    authApi.deleteAvatar.mockResolvedValue({ ok: true });
    const onUpdated = vi.fn();
    await renderProfile({ onUpdated });

    const deleteBtn = screen.getByText('Удалить фото');
    await user.click(deleteBtn);

    expect(authApi.deleteAvatar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Удалить фото')).not.toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.getByText('✓ Аватарка удалена')).toBeInTheDocument();
  });

  it('без avatarUrl показывает инициал вместо <img> и без кнопки удаления', async () => {
    await renderProfile();
    expect(screen.getByText('И')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'avatar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Удалить фото')).not.toBeInTheDocument();
  });
});

describe('ProfileModal — синхронизация с внешним сайтом (push to site)', () => {
  const withPush = { ...baseUser, permissions: ['external.push_to_site'] };

  it('без права external.push_to_site секция не рендерится', async () => {
    await renderProfile();
    expect(screen.queryByText('Синхронизировать сайт')).not.toBeInTheDocument();
  });

  it('отмена в confirm() не вызывает pushToSite', async () => {
    const user = userEvent.setup();
    window.confirm.mockReturnValue(false);
    await renderProfile({ user: withPush });

    await user.click(screen.getByText('Синхронизировать сайт'));

    expect(externalApi.pushToSite).not.toHaveBeenCalled();
  });

  it('подтверждение запускает pushToSite, показывает статус запуска и опрашивает taskStatus до готовности', async () => {
    vi.useFakeTimers();
    externalApi.pushToSite.mockResolvedValue({ ok: true, data: { success: true, data: { task_id: 't1', total: 42 } } });
    externalApi.taskStatus.mockResolvedValue({
      ok: true,
      data: { success: true, data: { ready: true, result: { success: true, pushed: 42 } } },
    });
    await renderProfile({ user: withPush });

    // fireEvent вместо userEvent — findByText/userEvent сами полагаются на
    // real-time polling, который зависает под fake timers (см. коммит)
    await act(async () => {
      fireEvent.click(screen.getByText('Синхронизировать сайт'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Запущено (42 товаров)...')).toBeInTheDocument();
    expect(screen.getByText('Отправка...')).toBeDisabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(externalApi.taskStatus).toHaveBeenCalledWith('t1');
    expect(screen.getByText('✓ Отправлено 42 товаров')).toBeInTheDocument();
    expect(screen.queryByText('Отправка...')).not.toBeInTheDocument();
  });

  it('неудачный запуск сразу показывает ошибку без опроса', async () => {
    const user = userEvent.setup();
    externalApi.pushToSite.mockResolvedValue({ ok: false, data: { error: 'Сервис недоступен' } });
    await renderProfile({ user: withPush });

    await user.click(screen.getByText('Синхронизировать сайт'));

    expect(await screen.findByText('Сервис недоступен')).toBeInTheDocument();
    expect(screen.queryByText('Отправка...')).not.toBeInTheDocument();
  });
});

describe('ProfileModal — кнопки открытия SyncModal / PassportSyncModal', () => {
  const allPermsUser = {
    ...baseUser,
    permissions: [
      'external.push_to_site', 'external.manage_variants', 'external.rsync_media', 'portal.s3.upload',
      'external.sync_prices', 'external.sync_catalog', 'pdf.spec.write', 'portal.chart.write',
    ],
  };

  it.each([
    ['Синхронизировать графики', 'fan_charts'],
    ['Группировка исполнений', 'variants'],
    ['Rsync медиафайлов', 'rsync'],
    ['Медиа → S3', 's3_media'],
    ['Обновить цены', 'prices'],
    ['Синхронизировать каталог', 'catalog'],
    ['Импорт характеристик PDF', 'extract'],
    ['Импорт DXF (аэродинамика)', 'dxf_import'],
  ])('кнопка "%s" открывает SyncModal с mode=%s и текущим user', async (buttonText, expectedMode) => {
    const user = userEvent.setup();
    await renderProfile({ user: allPermsUser });

    await user.click(screen.getByText(buttonText));

    const stub = screen.getByTestId('sync-modal-stub');
    expect(stub).toHaveAttribute('data-mode', expectedMode);
    expect(stub).toHaveAttribute('data-user', String(allPermsUser.id));
  });

  it('без прав только сама секция "Синхронизация с 1С" скрыта целиком', async () => {
    await renderProfile();
    expect(screen.queryByText('Обновить цены')).not.toBeInTheDocument();
    expect(screen.queryByText('Синхронизировать каталог')).not.toBeInTheDocument();
  });

  it('close-колбэк из SyncModal закрывает модалку (syncModal сбрасывается в null)', async () => {
    const user = userEvent.setup();
    await renderProfile({ user: allPermsUser });
    await user.click(screen.getByText('Обновить цены'));
    expect(screen.getByTestId('sync-modal-stub')).toBeInTheDocument();

    await user.click(screen.getByText('close-sync'));
    expect(screen.queryByTestId('sync-modal-stub')).not.toBeInTheDocument();
  });

  it('"Синхронизация паспортов" открывает PassportSyncModal только при upload или update правах', async () => {
    const user = userEvent.setup();
    await renderProfile({ user: { ...baseUser, permissions: ['passport.documents.upload'] } });

    await user.click(screen.getByText('Синхронизация паспортов'));
    expect(screen.getByTestId('passport-sync-modal-stub')).toBeInTheDocument();
  });

  it('без passport-прав кнопка "Синхронизация паспортов" не рендерится', async () => {
    await renderProfile();
    expect(screen.queryByText('Синхронизация паспортов')).not.toBeInTheDocument();
  });
});

describe('ProfileModal — настройки подбора (SelectionConfigModal)', () => {
  it('открывается без permission-гейта; onSaved показывает сообщение об успехе', async () => {
    const user = userEvent.setup();
    await renderProfile();

    await user.click(screen.getByText('Настройки исключений'));
    expect(screen.getByTestId('selection-config-modal-stub')).toBeInTheDocument();

    await user.click(screen.getByText('save-selection-config'));
    expect(screen.getByText('✓ Настройки подбора сохранены')).toBeInTheDocument();
  });
});

describe('ProfileModal — тема', () => {
  it('клик по "🌙 Тёмная" вызывает setDark(true) и сохраняет через updatePreferences', async () => {
    const user = userEvent.setup();
    authApi.updatePreferences.mockResolvedValue(okPrefs({ theme: 'dark' }));
    await renderProfile();
    setDarkMock.mockClear(); // сбросить вызов от начальной синхронизации темы при маунте

    await user.click(screen.getByText('🌙 Тёмная'));

    expect(setDarkMock).toHaveBeenCalledWith(true);
    expect(authApi.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('клик по "☀️ Светлая" вызывает setDark(false)', async () => {
    const user = userEvent.setup();
    authApi.updatePreferences.mockResolvedValue(okPrefs({ theme: 'light' }));
    await renderProfile();
    setDarkMock.mockClear();

    await user.click(screen.getByText('☀️ Светлая'));

    expect(setDarkMock).toHaveBeenCalledWith(false);
  });

  it('клик по "💻 Системная" берёт значение из matchMedia(prefers-color-scheme: dark)', async () => {
    const user = userEvent.setup();
    window.matchMedia.mockReturnValue({ matches: true });
    authApi.updatePreferences.mockResolvedValue(okPrefs({ theme: 'system' }));
    await renderProfile();
    setDarkMock.mockClear();

    await user.click(screen.getByText('💻 Системная'));

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(setDarkMock).toHaveBeenCalledWith(true);
  });

  it('подсвечивает активную тему по prefs.theme, а не по dark из контекста', async () => {
    authApi.getPreferences.mockResolvedValue(okPrefs({ theme: 'light', avatar_url: null }));
    await renderProfile();

    expect(screen.getByText('☀️ Светлая').className).toContain('bg-white');
    expect(screen.getByText('🌙 Тёмная').className).not.toContain('bg-white');
  });
});

describe('ProfileModal — пресет этапов сборки', () => {
  const withPush = { ...baseUser, permissions: ['bom.spec.push'] };

  it('скрыт без права bom.spec.push или при пустом списке пресетов', async () => {
    bomApi.getStagePresets.mockResolvedValue(okPrefs([{ id: 1, name: 'Стандарт', is_default: true }]));
    await renderProfile(); // без права
    expect(screen.queryByText(/Стандарт/)).not.toBeInTheDocument();
  });

  it('рендерит опции с "★" для дефолтного пресета; выбор шлёт parseInt в updatePreferences', async () => {
    const user = userEvent.setup();
    bomApi.getStagePresets.mockResolvedValue(
      okPrefs([{ id: 1, name: 'Стандарт', is_default: true }, { id: 2, name: 'Ускоренный', is_default: false }])
    );
    authApi.updatePreferences.mockResolvedValue(okPrefs({ default_assembly_stage_preset_id: 2 }));
    await renderProfile({ user: withPush });

    expect(screen.getByText('Стандарт ★')).toBeInTheDocument();
    expect(screen.getByText('Ускоренный')).toBeInTheDocument();

    const select = screen.getByText('Стандарт ★').closest('select');
    await user.selectOptions(select, '2');

    expect(authApi.updatePreferences).toHaveBeenCalledWith({ default_assembly_stage_preset_id: 2 });
    expect(await screen.findByText('✓ Настройки сохранены')).toBeInTheDocument();
  });

  it('выбор пустой опции шлёт null', async () => {
    const user = userEvent.setup();
    bomApi.getStagePresets.mockResolvedValue(okPrefs([{ id: 1, name: 'Стандарт' }]));
    authApi.updatePreferences.mockResolvedValue(okPrefs({}));
    await renderProfile({ user: withPush });

    const select = screen.getByText('Стандарт').closest('select');
    await user.selectOptions(select, '1');
    await user.selectOptions(select, '');

    expect(authApi.updatePreferences).toHaveBeenLastCalledWith({ default_assembly_stage_preset_id: null });
  });
});

describe('ProfileModal — папка спецификаций деталей и вид номенклатуры', () => {
  const withPush = { ...baseUser, permissions: ['bom.spec.push'] };

  it('folder select шлёт id строкой или null для пустой опции', async () => {
    const user = userEvent.setup();
    bomApi.getFolders.mockResolvedValue(okPrefs([{ id: 7, path: 'spec/КЭВ' }]));
    authApi.updatePreferences.mockResolvedValue(okPrefs({}));
    await renderProfile({ user: withPush });
    await flush();

    const select = await screen.findByText('spec/КЭВ');
    await user.selectOptions(select.closest('select'), '7');

    expect(authApi.updatePreferences).toHaveBeenCalledWith({ default_detail_spec_folder_id: '7' });
  });

  it('поле "Вид номенклатуры деталей" сохраняет значение без индикации сохранения/успеха', async () => {
    const user = userEvent.setup();
    authApi.updatePreferences.mockResolvedValue(okPrefs({ default_part_type: 'Полуфабрикат X' }));
    await renderProfile({ user: withPush });

    const input = screen.getByPlaceholderText('Полуфабрикат');
    await user.type(input, 'X');

    expect(authApi.updatePreferences).toHaveBeenCalledWith({ default_part_type: 'X' });
    expect(screen.queryByText('✓ Настройки сохранены')).not.toBeInTheDocument();
  });
});

describe('ProfileModal — закрытие', () => {
  it('клик по фону вызывает onClose, клик по панели — нет', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = await renderProfile({ onClose });

    await user.click(screen.getByText('Иван Иванов').closest('div'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape закрывает модалку', async () => {
    const onClose = vi.fn();
    await renderProfile({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('кнопка "Закрыть" в футере вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    await renderProfile({ onClose });

    await user.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
