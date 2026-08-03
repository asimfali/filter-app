import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartEditorPage from '../PartEditorPage';
import { sessionsApi } from '../../api/sessions';
import { bomApi } from '../../api/bom';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/sessions', () => ({
  sessionsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), activate: vi.fn() },
}));
vi.mock('../../api/bom', () => ({
  bomApi: { getSpec: vi.fn(), lockSpec: vi.fn(), unlockSpec: vi.fn(), getSpecs: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('../bom/SpecList', () => ({
  default: ({ specs, loading, canWrite, canView, onOpen, onRefresh, onSearch }) => (
    <div
      data-testid="spec-list-stub"
      data-loading={String(loading)}
      data-can-write={String(canWrite)}
      data-can-view={String(canView)}
      data-specs={JSON.stringify(specs)}
    >
      <button onClick={() => onOpen(1)}>open-spec-1</button>
      <button onClick={onRefresh}>refresh</button>
      <input data-testid="search-input" onChange={(e) => onSearch(e.target.value)} />
    </div>
  ),
}));
vi.mock('../bom/SpecEditor', () => ({
  default: ({ spec, canWrite, canView, canPush, onClose, onSaved }) => (
    <div
      data-testid="spec-editor-stub"
      data-spec-id={spec.id}
      data-can-write={String(canWrite)}
      data-can-view={String(canView)}
      data-can-push={String(canPush)}
    >
      <button onClick={onClose}>close</button>
      <button onClick={() => onSaved({ ...spec, onec_name: 'Обновлено' })}>save</button>
    </div>
  ),
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const okSpecs = (data) => ({ ok: true, data: { success: true, data } });

const setup = (overrides = {}) => {
  useAuth.mockReturnValue({ user: withPerms('bom.spec.view', 'bom.spec.write', 'bom.spec.push') });
  sessionsApi.list.mockResolvedValue(null);
  bomApi.getSpecs.mockResolvedValue(okSpecs([]));
  Object.assign(sessionsApi, overrides.sessionsApi);
  Object.assign(bomApi, overrides.bomApi);
};

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe('PartEditorPage — список по умолчанию', () => {
  it('без сохранённой сессии показывает список и грузит спецификации', async () => {
    bomApi.getSpecs.mockResolvedValue(okSpecs([{ id: 1, onec_name: 'A' }]));
    render(<PartEditorPage />);

    await screen.findByTestId('spec-list-stub');
    expect(bomApi.getSpecs).toHaveBeenCalledWith({ q: '' });
    expect(screen.getByTestId('spec-list-stub')).toHaveAttribute('data-specs', '[{"id":1,"onec_name":"A"}]');
  });

  it('прокидывает canWrite/canView, посчитанные из user.permissions', async () => {
    useAuth.mockReturnValue({ user: withPerms('bom.spec.view') });
    render(<PartEditorPage />);
    const stub = await screen.findByTestId('spec-list-stub');
    expect(stub).toHaveAttribute('data-can-write', 'false');
    expect(stub).toHaveAttribute('data-can-view', 'true');
  });

  it('поиск дебаунсится на 400ms — быстрые вводы дают один вызов с последним значением', async () => {
    vi.useFakeTimers();
    render(<PartEditorPage />);
    await act(async () => { await Promise.resolve(); });
    bomApi.getSpecs.mockClear();

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'к' } });
    fireEvent.change(input, { target: { value: 'кэ' } });
    fireEvent.change(input, { target: { value: 'кэв' } });

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(bomApi.getSpecs).toHaveBeenCalledTimes(1);
    expect(bomApi.getSpecs).toHaveBeenCalledWith({ q: 'кэв' });
    vi.useRealTimers();
  });
});

describe('PartEditorPage — восстановление сессии при маунте', () => {
  it('без spec_id в сохранённых данных остаётся на списке', async () => {
    sessionsApi.list.mockResolvedValue({ id: 5, data: {} });
    render(<PartEditorPage />);
    await screen.findByTestId('spec-list-stub');
    expect(bomApi.getSpec).not.toHaveBeenCalled();
  });

  it('с spec_id открывает редактор и лочит спецификацию (canWrite=true)', async () => {
    sessionsApi.list.mockResolvedValue({ id: 5, data: { spec_id: 42 } });
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 42, onec_name: 'B' } } });
    render(<PartEditorPage />);

    const stub = await screen.findByTestId('spec-editor-stub');
    expect(stub).toHaveAttribute('data-spec-id', '42');
    expect(bomApi.lockSpec).toHaveBeenCalledWith(42);
  });

  it('без права write не лочит спецификацию при восстановлении', async () => {
    useAuth.mockReturnValue({ user: withPerms('bom.spec.view') });
    sessionsApi.list.mockResolvedValue({ id: 5, data: { spec_id: 42 } });
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 42, onec_name: 'B' } } });
    render(<PartEditorPage />);

    await screen.findByTestId('spec-editor-stub');
    expect(bomApi.lockSpec).not.toHaveBeenCalled();
  });

  it('принимает список сессий в виде массива и в виде {results: [...]}', async () => {
    sessionsApi.list.mockResolvedValue([{ id: 6, data: { spec_id: 43 } }]);
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 43, onec_name: 'C' } } });
    const { unmount } = render(<PartEditorPage />);
    expect(await screen.findByTestId('spec-editor-stub')).toHaveAttribute('data-spec-id', '43');
    unmount();

    vi.clearAllMocks();
    setup();
    sessionsApi.list.mockResolvedValue({ results: [{ id: 7, data: { spec_id: 44 } }] });
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 44, onec_name: 'D' } } });
    render(<PartEditorPage />);
    expect(await screen.findByTestId('spec-editor-stub')).toHaveAttribute('data-spec-id', '44');
  });

  it('неудачный getSpec для восстановленного spec_id оставляет на списке', async () => {
    sessionsApi.list.mockResolvedValue({ id: 5, data: { spec_id: 42 } });
    bomApi.getSpec.mockResolvedValue({ ok: false, data: {} });
    render(<PartEditorPage />);
    await screen.findByTestId('spec-list-stub');
  });
});

describe('PartEditorPage — открытие/закрытие/сохранение спецификации', () => {
  it('onOpen: getSpec → editor, lockSpec, сохраняет сессию через create+activate (нет sessionId)', async () => {
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 1, onec_name: 'A' } } });
    sessionsApi.create.mockResolvedValue({ id: 9 });
    const user = userEvent.setup();
    render(<PartEditorPage />);
    await screen.findByTestId('spec-list-stub');

    await user.click(screen.getByText('open-spec-1'));

    expect(await screen.findByTestId('spec-editor-stub')).toHaveAttribute('data-spec-id', '1');
    expect(bomApi.lockSpec).toHaveBeenCalledWith(1);
    expect(sessionsApi.create).toHaveBeenCalledWith('bom_editor', 'BOM редактор', { spec_id: 1 });
    expect(sessionsApi.activate).toHaveBeenCalledWith(9);
  });

  it('второй onOpen после первого использует sessionsApi.update (sessionId уже есть)', async () => {
    sessionsApi.list.mockResolvedValue({ id: 5, data: {} }); // задаёт sessionId=5 при восстановлении
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 1, onec_name: 'A' } } });
    const user = userEvent.setup();
    render(<PartEditorPage />);
    await screen.findByTestId('spec-list-stub');

    await user.click(screen.getByText('open-spec-1'));
    await screen.findByTestId('spec-editor-stub');

    expect(sessionsApi.update).toHaveBeenCalledWith(5, { data: { spec_id: 1 } });
    expect(sessionsApi.create).not.toHaveBeenCalled();
  });

  it('onClose: unlockSpec, возврат к списку, сохраняет пустую сессию, перезагружает список', async () => {
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 1, onec_name: 'A' } } });
    sessionsApi.create.mockResolvedValue({ id: 9 });
    const user = userEvent.setup();
    render(<PartEditorPage />);
    await user.click(screen.getByText('open-spec-1'));
    await screen.findByTestId('spec-editor-stub');
    bomApi.getSpecs.mockClear();

    await user.click(screen.getByText('close'));

    expect(bomApi.unlockSpec).toHaveBeenCalledWith(1);
    expect(await screen.findByTestId('spec-list-stub')).toBeInTheDocument();
    expect(sessionsApi.update).toHaveBeenCalledWith(9, { data: {} });
    expect(bomApi.getSpecs).toHaveBeenCalled();
  });

  it('onSaved обновляет отображаемую спецификацию и перезагружает список в фоне', async () => {
    bomApi.getSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 1, onec_name: 'A' } } });
    const user = userEvent.setup();
    render(<PartEditorPage />);
    await user.click(screen.getByText('open-spec-1'));
    await screen.findByTestId('spec-editor-stub');
    bomApi.getSpecs.mockClear();

    await user.click(screen.getByText('save'));

    expect(bomApi.getSpecs).toHaveBeenCalled();
    // редактор остаётся открытым с обновлённым spec (тот же id, имя сменилось в сторе SpecEditor)
    expect(screen.getByTestId('spec-editor-stub')).toBeInTheDocument();
  });
});
