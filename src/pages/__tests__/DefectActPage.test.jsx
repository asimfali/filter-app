import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DefectActPage from '../DefectActPage';
import { bomApi } from '../../api/bom';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/bom', () => ({
  bomApi: {
    getDefectActs: vi.fn(),
    createDefectAct: vi.fn(),
    updateDefectAct: vi.fn(),
    deleteDefectAct: vi.fn(),
    downloadDefectActsPdf: vi.fn(),
  },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('../../components/common/SmartSelect', () => ({
  default: ({ endpoint, placeholder, value, onSelect, onClear }) => (
    <div data-testid={`smart-select-${endpoint}`}>
      <input placeholder={placeholder} readOnly value={value ? value.name : ''} />
      <button onClick={() => onSelect(
        endpoint.includes('parts') ? { id: 1, onec_name: 'Деталь A' } : { id: 2, name: 'Скол ЛКП' }
      )}>select-{endpoint}</button>
      <button onClick={onClear}>clear-{endpoint}</button>
    </div>
  ),
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const ok = (data) => ({ ok: true, data: { success: true, data } });

const act1 = {
  id: 1, act_number: '525', date: '2026-07-01', drawing_number: 'ДВ-01',
  part: { id: 1, name: 'Деталь A' }, quantity: 2,
  defect_type: { id: 2, name: 'Скол ЛКП' }, verdict: 'dispose', notes: 'заметка',
};

const setup = (overrides = {}) => {
  useAuth.mockReturnValue({ user: withPerms('bom.defect.write') });
  bomApi.getDefectActs.mockResolvedValue(ok([]));
  bomApi.deleteDefectAct.mockResolvedValue({ ok: true, data: {} });
  Object.assign(bomApi, overrides.bomApi);
};

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe('DefectActPage — список', () => {
  it('показывает индикатор загрузки, затем таблицу с данными', async () => {
    let resolveLoad;
    bomApi.getDefectActs.mockReturnValue(new Promise((r) => { resolveLoad = r; }));
    render(<DefectActPage />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    resolveLoad(ok([act1]));
    await screen.findByText('525');
    expect(screen.getByText('2026-07-01')).toBeInTheDocument();
    expect(screen.getByText('ДВ-01')).toBeInTheDocument();
    expect(screen.getByText('Деталь A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Скол ЛКП')).toBeInTheDocument();
    expect(screen.getByText('Утилизировать')).toBeInTheDocument();
    expect(screen.getByText('1 записей')).toBeInTheDocument();
  });

  it('пустой список за период — свой текст, пустой результат поиска — другой', async () => {
    render(<DefectActPage />);
    expect(await screen.findByText('Актов за выбранный период нет')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Деталь, дефект...'), 'x');
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('ошибка загрузки (ok:false и брошенное исключение) показывает сообщение об ошибке', async () => {
    bomApi.getDefectActs.mockResolvedValue({ ok: false, data: {} });
    const { unmount } = render(<DefectActPage />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
    unmount();

    vi.clearAllMocks();
    setup();
    bomApi.getDefectActs.mockRejectedValue(new Error('network'));
    render(<DefectActPage />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });
});

describe('DefectActPage — права (bom.defect.write)', () => {
  it('с правом: кнопка добавления и действия в строке видны', async () => {
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    render(<DefectActPage />);
    await screen.findByText('525');
    expect(screen.getByText('+ Добавить')).toBeInTheDocument();
    expect(screen.getByText('Изм.')).toBeInTheDocument();
    expect(screen.getByText('Удалить')).toBeInTheDocument();
  });

  it('без права: нет кнопки добавления и колонки действий', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    render(<DefectActPage />);
    await screen.findByText('525');
    expect(screen.queryByText('+ Добавить')).not.toBeInTheDocument();
    expect(screen.queryByText('Изм.')).not.toBeInTheDocument();
    expect(screen.queryByText('Удалить')).not.toBeInTheDocument();
  });
});

describe('DefectActPage — фильтры', () => {
  it('изменение дат и поиска перезапрашивает список с новыми фильтрами', async () => {
    const { container } = render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');
    bomApi.getDefectActs.mockClear();

    const [dateFrom, dateTo] = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateFrom, { target: { value: '2026-06-01' } });
    await waitFor(() => expect(bomApi.getDefectActs).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '2026-06-01' })
    ));

    bomApi.getDefectActs.mockClear();
    fireEvent.change(dateTo, { target: { value: '2026-06-30' } });
    await waitFor(() => expect(bomApi.getDefectActs).toHaveBeenCalledWith(
      expect.objectContaining({ date_to: '2026-06-30' })
    ));

    bomApi.getDefectActs.mockClear();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Деталь, дефект...'), 'скол');
    await waitFor(() => expect(bomApi.getDefectActs).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'скол' })
    ));
  });

  it('кнопка "Сбросить ×" очищает поиск и появляется только когда есть текст', async () => {
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');
    expect(screen.queryByText('Сбросить ×')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Деталь, дефект...'), 'x');
    await user.click(await screen.findByText('Сбросить ×'));

    expect(screen.getByPlaceholderText('Деталь, дефект...')).toHaveValue('');
    expect(screen.queryByText('Сбросить ×')).not.toBeInTheDocument();
  });
});

describe('DefectActPage — создание акта', () => {
  it('переключает форму кнопкой "+ Добавить" / "← Назад"', async () => {
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');

    await user.click(screen.getByText('+ Добавить'));
    expect(screen.getByText('Новый акт дефектации')).toBeInTheDocument();

    await user.click(screen.getByText('← Назад'));
    expect(screen.queryByText('Новый акт дефектации')).not.toBeInTheDocument();
  });

  it('валидация: без детали и без описания дефекта не отправляет запрос', async () => {
    const user = userEvent.setup();
    render(<DefectActPage />);
    await user.click(await screen.findByText('+ Добавить'));
    // "№ акта" обязателен на уровне HTML (required) — иначе submit-событие вообще не дойдёт до onSubmit.
    await user.type(screen.getByPlaceholderText('525'), '1');

    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Выберите изделие/деталь')).toBeInTheDocument();
    expect(bomApi.createDefectAct).not.toHaveBeenCalled();

    await user.click(screen.getByText('select-/api/v1/bom/parts/'));
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Укажите описание дефекта')).toBeInTheDocument();
    expect(bomApi.createDefectAct).not.toHaveBeenCalled();
  });

  it('успешное создание отправляет payload, перезагружает список и закрывает форму', async () => {
    bomApi.createDefectAct.mockResolvedValue(ok({ id: 9 }));
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');
    await user.click(screen.getByText('+ Добавить'));

    await user.type(screen.getByPlaceholderText('525'), '777');
    await user.type(screen.getByPlaceholderText('нет данных'), 'ДВ-99');
    const qty = screen.getByDisplayValue('1');
    await user.clear(qty);
    await user.type(qty, '5');
    await user.click(screen.getByText('select-/api/v1/bom/parts/'));
    await user.click(screen.getByText('select-/api/v1/bom/defect-types/'));
    await user.click(screen.getByLabelText('Складировать под покраску'));

    bomApi.getDefectActs.mockClear();
    await user.click(screen.getByText('Создать'));

    await waitFor(() => expect(bomApi.createDefectAct).toHaveBeenCalledWith({
      act_number: '777',
      date: expect.any(String),
      part: 1,
      drawing_number: 'ДВ-99',
      quantity: 5,
      defect_type: 2,
      verdict: 'store_for_paint',
      notes: '',
    }));
    expect(await screen.findByText('Актов за выбранный период нет')).toBeInTheDocument();
    expect(bomApi.getDefectActs).toHaveBeenCalled();
    expect(screen.queryByText('Новый акт дефектации')).not.toBeInTheDocument();
  });

  it('ошибка сохранения: строка выводится как есть, объект — join полей через запятую', async () => {
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');
    await user.click(screen.getByText('+ Добавить'));
    await user.type(screen.getByPlaceholderText('525'), '1');
    await user.click(screen.getByText('select-/api/v1/bom/parts/'));
    await user.click(screen.getByText('select-/api/v1/bom/defect-types/'));

    bomApi.createDefectAct.mockResolvedValue({ ok: false, data: { error: 'Акт с таким номером уже есть' } });
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Акт с таким номером уже есть')).toBeInTheDocument();

    bomApi.createDefectAct.mockResolvedValue({
      ok: false,
      data: { error: { act_number: ['Обязательное поле'], quantity: ['Введите число'] } },
    });
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Обязательное поле, Введите число')).toBeInTheDocument();
  });

  it('во время сохранения кнопка показывает "···" и задизейблена', async () => {
    let resolveCreate;
    bomApi.createDefectAct.mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');
    await user.click(screen.getByText('+ Добавить'));
    await user.type(screen.getByPlaceholderText('525'), '1');
    await user.click(screen.getByText('select-/api/v1/bom/parts/'));
    await user.click(screen.getByText('select-/api/v1/bom/defect-types/'));

    await user.click(screen.getByText('Создать'));
    expect(screen.getByText('···')).toBeDisabled();

    resolveCreate(ok({ id: 1 }));
    await waitFor(() => expect(screen.queryByText('Новый акт дефектации')).not.toBeInTheDocument());
  });
});

describe('DefectActPage — редактирование акта', () => {
  it('"Изм." открывает форму с предзаполненными значениями и сохраняет через updateDefectAct', async () => {
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    bomApi.updateDefectAct.mockResolvedValue(ok({ ...act1, act_number: '526' }));
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('525');

    await user.click(screen.getByText('Изм.'));
    expect(screen.getByText('Редактирование акта № 525')).toBeInTheDocument();
    expect(screen.getByDisplayValue('525')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ДВ-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('заметка')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Деталь A')).toBeInTheDocument();

    const actNumberInput = screen.getByDisplayValue('525');
    await user.clear(actNumberInput);
    await user.type(actNumberInput, '526');

    bomApi.getDefectActs.mockClear();
    await user.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(bomApi.updateDefectAct).toHaveBeenCalledWith(1, expect.objectContaining({
      act_number: '526', part: 1, defect_type: 2, verdict: 'dispose',
    })));
    expect(bomApi.getDefectActs).toHaveBeenCalled();
  });

  it('"Отмена" в редактировании закрывает форму без сохранения', async () => {
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('525');

    await user.click(screen.getByText('Изм.'));
    await user.click(screen.getByText('Отмена'));

    expect(screen.queryByText(/Редактирование акта/)).not.toBeInTheDocument();
    expect(bomApi.updateDefectAct).not.toHaveBeenCalled();
  });
});

describe('DefectActPage — удаление акта', () => {
  it('двухшаговое подтверждение: "Нет" отменяет, "Да" удаляет и перезагружает список', async () => {
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('525');

    await user.click(screen.getByText('Удалить'));
    expect(screen.getByText('Да')).toBeInTheDocument();
    await user.click(screen.getByText('Нет'));
    expect(screen.queryByText('Да')).not.toBeInTheDocument();
    expect(bomApi.deleteDefectAct).not.toHaveBeenCalled();

    await user.click(screen.getByText('Удалить'));
    bomApi.getDefectActs.mockClear();
    await user.click(screen.getByText('Да'));

    expect(bomApi.deleteDefectAct).toHaveBeenCalledWith(1);
    await waitFor(() => expect(bomApi.getDefectActs).toHaveBeenCalled());
  });

  it('неудачное удаление не перезагружает список', async () => {
    bomApi.getDefectActs.mockResolvedValue(ok([act1]));
    bomApi.deleteDefectAct.mockResolvedValue({ ok: false, data: {} });
    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('525');

    await user.click(screen.getByText('Удалить'));
    bomApi.getDefectActs.mockClear();
    await user.click(screen.getByText('Да'));
    await act(async () => { await Promise.resolve(); });

    expect(bomApi.getDefectActs).not.toHaveBeenCalled();
  });
});

describe('DefectActPage — печать', () => {
  it('запрашивает PDF с текущими фильтрами, открывает blob-URL и планирует его отзыв через 60с', async () => {
    const blob = new Blob(['x']);
    bomApi.downloadDefectActsPdf.mockResolvedValue({ blob: () => Promise.resolve(blob) });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const user = userEvent.setup();
    render(<DefectActPage />);
    await screen.findByText('Актов за выбранный период нет');

    await user.click(screen.getByText('🖨 Печать'));

    await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob));
    expect(bomApi.downloadDefectActsPdf).toHaveBeenCalledWith(expect.objectContaining({ q: '' }));
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

    vi.restoreAllMocks();
  });
});
