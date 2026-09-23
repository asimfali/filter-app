import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesignLandingsPage from '../DesignLandingsPage';
import { catalogApi } from '../../api/catalog';
import { mediaApi } from '../../api/media';

vi.mock('../../api/catalog', () => ({
  catalogApi: {
    parameterAxes: vi.fn(),
    parameterValues: vi.fn(),
    designLandings: vi.fn(),
    createDesignLanding: vi.fn(),
    updateDesignLanding: vi.fn(),
    deleteDesignLanding: vi.fn(),
  },
}));
vi.mock('../../api/media', () => ({
  mediaApi: {
    getFormData: vi.fn(),
    getDocuments: vi.fn(),
    downloadFile: vi.fn(),
    uploadDocument: vi.fn(),
  },
}));

const ok = (data) => ({ ok: true, data });

const DESIGN_AXIS = { id: 5, code: 'design', name: 'Дизайн', product_type: 1, product_type_name: 'Завесы' };
const makeValues = () => ([
  { id: 101, value: 'Комфорт', sort_order: 0 },
  { id: 102, value: 'Колонна', sort_order: 1 },
]);
const makeLandings = () => ([
  { id: 900, values: [102], image_folder_value: 102, blocks: [{ type: 'notes', text: 'Уже есть текст' }], is_published: true, updated_at: '2026-09-01T00:00:00Z' },
]);

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.parameterAxes.mockResolvedValue(ok([DESIGN_AXIS]));
  catalogApi.parameterValues.mockResolvedValue(ok(makeValues()));
  catalogApi.designLandings.mockResolvedValue(ok(makeLandings()));
  mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [] }));
});

describe('DesignLandingsPage — список значений оси design', () => {
  it('показывает индикатор загрузки, затем список значений со статусом лендинга', async () => {
    render(<DesignLandingsPage />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    expect(await screen.findByText('Комфорт')).toBeInTheDocument();
    expect(screen.getByText('Колонна')).toBeInTheDocument();
    expect(screen.getByText('Нет лендинга')).toBeInTheDocument();
    expect(screen.getByText(/Опубликовано/)).toBeInTheDocument();
    expect(catalogApi.parameterAxes).toHaveBeenCalledWith();
    expect(catalogApi.parameterValues).toHaveBeenCalledWith(DESIGN_AXIS.id);
  });

  it('собирает значения со всех осей design (по одной на тип продукции)', async () => {
    const axis2 = { id: 6, code: 'design', name: 'Дизайн', product_type: 2, product_type_name: 'Фанкойлы' };
    catalogApi.parameterAxes.mockResolvedValue(ok([DESIGN_AXIS, axis2]));
    catalogApi.parameterValues.mockImplementation((axisId) => Promise.resolve(
      ok(axisId === axis2.id ? [{ id: 201, value: 'Стандарт', sort_order: 0 }] : makeValues())
    ));
    render(<DesignLandingsPage />);

    expect(await screen.findByText('Комфорт')).toBeInTheDocument();
    expect(screen.getByText('Стандарт')).toBeInTheDocument();
    expect(screen.getByText('Завесы')).toBeInTheDocument();
    expect(screen.getByText('Фанкойлы')).toBeInTheDocument();
  });

  it('ни у одного типа продукции нет оси design — показывает сообщение вместо списка', async () => {
    catalogApi.parameterAxes.mockResolvedValue(ok([{ id: 1, code: 'power', name: 'Мощность' }]));
    render(<DesignLandingsPage />);
    expect(await screen.findByText(/Ни у одного типа продукции нет оси «design»/)).toBeInTheDocument();
    expect(catalogApi.parameterValues).not.toHaveBeenCalled();
  });
});

describe('DesignLandingsPage — редактор лендинга', () => {
  it('создаёт новый лендинг для значения без существующего', async () => {
    const user = userEvent.setup();
    catalogApi.createDesignLanding.mockResolvedValue(ok({ id: 901, values: [101], blocks: [], is_published: false }));
    render(<DesignLandingsPage />);

    await user.click(await screen.findByText('Комфорт'));
    expect(await screen.findByText('Лендинг дизайна')).toBeInTheDocument();

    await user.click(screen.getByText('+ Заметки'));
    await user.type(screen.getByPlaceholderText('Текст'), 'Новый текст');
    await user.click(screen.getByText('Сохранить'));

    expect(catalogApi.createDesignLanding).toHaveBeenCalledWith({
      values: [101],
      blocks: [{ type: 'notes', text: 'Новый текст' }],
      is_published: false,
      image_folder_value: 101,
    });
    // после сохранения список перезагружается и редактор закрывается
    expect(await screen.findByText('Лендинги дизайна')).toBeInTheDocument();
  });

  it('открывает существующий лендинг с уже сохранёнными блоками/значениями/статусом', async () => {
    const user = userEvent.setup();
    render(<DesignLandingsPage />);

    await user.click(await screen.findByText('Колонна'));
    expect(await screen.findByDisplayValue('Уже есть текст')).toBeInTheDocument();
    // кнопка удаления лендинга целиком — первая в DOM (в шапке, до списка блоков)
    expect(screen.getAllByText('Удалить')[0]).toBeInTheDocument();
  });

  it('удаляет лендинг и возвращается к списку', async () => {
    const user = userEvent.setup();
    catalogApi.deleteDesignLanding.mockResolvedValue({ ok: true });
    render(<DesignLandingsPage />);

    await user.click(await screen.findByText('Колонна'));
    await screen.findByDisplayValue('Уже есть текст');
    await user.click(screen.getAllByText('Удалить')[0]);
    await user.click(await screen.findByText('Подтвердить'));

    expect(catalogApi.deleteDesignLanding).toHaveBeenCalledWith(900);
    expect(await screen.findByText('Лендинги дизайна')).toBeInTheDocument();
  });
});
