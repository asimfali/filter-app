import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecPreviewPage from '../SpecPreviewPage';
import { catalogApi } from '../../api/catalog';
import { mediaApi } from '../../api/media';
import { authApi } from '../../api/auth';
import { plmApi } from '../../api/plm';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../../api/catalog', () => ({ catalogApi: { previewBulk: vi.fn() } }));
vi.mock('../../api/media', () => ({
  mediaApi: {
    getFormData: vi.fn(),
    downloadFile: vi.fn(),
    uploadProductDocument: vi.fn(),
    getProductDocuments: vi.fn(),
  },
}));
vi.mock('../../api/auth', () => ({
  authApi: { getPreferences: vi.fn(), saveColumnPrefs: vi.fn() },
}));
vi.mock('../../api/plm', () => ({ plmApi: { getStages: vi.fn() } }));

vi.mock('../../components/plm/PLMSidePanel', () => ({
  default: ({ onClose }) => (
    <div data-testid="plm-side-panel"><button onClick={onClose}>close-plm</button></div>
  ),
}));
vi.mock('../../components/plm/LiteraSelector', () => ({
  default: ({ stages, onChange }) => (
    <div data-testid="litera-selector" data-stages={stages.length}>
      <button onClick={() => onChange({ id: 5, litera_code: 'B' })}>select-litera</button>
    </div>
  ),
}));
vi.mock('../../components/media/DocTypeSelector', () => ({
  default: ({ docTypes, activeDocType, onSelect }) => (
    <div data-testid="doc-type-selector">
      {docTypes.map(dt => (
        <button key={dt.code} onClick={() => onSelect(dt)} data-active={activeDocType?.code === dt.code}>
          {dt.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../components/catalog/ColumnSettingsModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="column-settings-modal"><button onClick={onClose}>close-columns</button></div>
  ),
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const ok = (data) => ({ ok: true, data });

// useColumnPrefs.buildDefault ожидает axis.name/def.display_name (не label) — из них строит
// колонки с полем label, которое и рендерит SpecPreviewPage.
const axis1 = { id: 1, name: 'Мощность' };
const def1 = { id: 10, display_name: 'Длина' };
const docType1 = { id: 1, code: 'passport', name: 'Паспорт', upload_permission_code: 'media.doc.upload', view_permission_code: '' };

const product1 = {
  id: 300, name: 'Т1', sku: 'SKU1',
  params: { 1: '5 кВт' },
  specs: { 10: { value: '500', is_manual: true } },
  documents: [{ doc_type_code: 'passport', files: [{ name: 'p1.pdf', folder_path: 'docs', litera_code: null }] }],
  images: [],
};
const product2 = {
  id: 301, name: 'Т2', sku: 'SKU2',
  params: { 1: '3 кВт' },
  specs: { 10: { value: '400', is_manual: false } },
  documents: [],
  images: [{ id: 1 }, { id: 2 }],
};

const makeData = (overrides = {}) => ({
  axes: [axis1], definitions: [def1], products: [product1, product2],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: withPerms() });
  useCart.mockReturnValue({ activeCartId: null, addToCart: vi.fn(), carts: [] });
  catalogApi.previewBulk.mockResolvedValue(ok({ success: true, data: makeData() }));
  mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [docType1] }));
  authApi.getPreferences.mockResolvedValue(ok({ success: true, data: { table_column_prefs: {} } }));
  plmApi.getStages.mockResolvedValue(ok({ success: true, data: [] }));
});

describe('SpecPreviewPage — загрузка и шапка', () => {
  it('показывает загрузку, затем таблицу и счётчики в шапке', async () => {
    let resolvePreview;
    catalogApi.previewBulk.mockReturnValue(new Promise(r => { resolvePreview = r; }));
    render(<SpecPreviewPage productIds={[300, 301]} onBack={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    resolvePreview(ok({ success: true, data: makeData() }));
    expect(await screen.findByText('Т1')).toBeInTheDocument();
    expect(screen.getByText('Т2')).toBeInTheDocument();
    expect(screen.getByText('2 изделий · 1 параметров · 1 характеристик')).toBeInTheDocument();
  });

  it('ошибка загрузки показывает сообщение', async () => {
    catalogApi.previewBulk.mockResolvedValue({ ok: false, data: { error: 'Нет доступа' } });
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
  });

  it('сетевая ошибка показывает "Ошибка сети"', async () => {
    catalogApi.previewBulk.mockRejectedValue(new Error('down'));
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    expect(await screen.findByText('Ошибка сети')).toBeInTheDocument();
  });

  it('"←" вызывает onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={onBack} />);
    await user.click(await screen.findByText('← Назад'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('SpecPreviewPage — переключатели групп колонок', () => {
  it('без осей/характеристик/документов кнопки-группы не рендерятся', async () => {
    catalogApi.previewBulk.mockResolvedValue(ok({
      success: true,
      data: makeData({ axes: [], definitions: [], products: [{ ...product1, images: [] }] }),
    }));
    mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [] }));
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.queryByText('Параметры')).not.toBeInTheDocument();
    expect(screen.queryByText('Характеристики')).not.toBeInTheDocument();
    expect(screen.queryByText('Документы')).not.toBeInTheDocument();
  });

  it('выключение "Параметры" скрывает колонку осей из таблицы', async () => {
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.getByText('5 кВт')).toBeInTheDocument();

    await user.click(screen.getByText('Параметры'));
    expect(screen.queryByText('5 кВт')).not.toBeInTheDocument();
  });

  it('выключение "Характеристики" скрывает специфичные значения', async () => {
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.getByText('500')).toBeInTheDocument();

    await user.click(screen.getByText('Характеристики'));
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });
});

describe('SpecPreviewPage — настройка колонок', () => {
  it('⚙ открывает ColumnSettingsModal, крестик закрывает', async () => {
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    await user.click(screen.getByTitle('Настройка колонок'));
    expect(screen.getByTestId('column-settings-modal')).toBeInTheDocument();
    await user.click(screen.getByText('close-columns'));
    expect(screen.queryByTestId('column-settings-modal')).not.toBeInTheDocument();
  });
});

describe('SpecPreviewPage — литера/PLM', () => {
  it('LiteraSelector не рендерится без стадий', async () => {
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.queryByTestId('litera-selector')).not.toBeInTheDocument();
  });

  it('LiteraSelector рендерится при наличии стадий, выбор литеры перезапрашивает previewBulk с stageId', async () => {
    plmApi.getStages.mockResolvedValue(ok({ success: true, data: [{ id: 5, litera_code: 'B', status: 'active' }] }));
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(await screen.findByTestId('litera-selector')).toBeInTheDocument();

    catalogApi.previewBulk.mockClear();
    await user.click(screen.getByText('select-litera'));
    await waitFor(() => expect(catalogApi.previewBulk).toHaveBeenCalledWith([300], 5));
  });

  it('кнопка PLM видна только при plm.stage.view, тумблит боковую панель', async () => {
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.queryByText('PLM')).not.toBeInTheDocument();
  });

  it('с правом plm.stage.view: тумблер показывает/скрывает PLMSidePanel', async () => {
    useAuth.mockReturnValue({ user: withPerms('plm.stage.view') });
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.queryByTestId('plm-side-panel')).not.toBeInTheDocument();

    await user.click(screen.getByText('PLM'));
    expect(screen.getByTestId('plm-side-panel')).toBeInTheDocument();

    await user.click(screen.getByText('close-plm'));
    expect(screen.queryByTestId('plm-side-panel')).not.toBeInTheDocument();
  });
});

describe('SpecPreviewPage — редактирование/права', () => {
  it('"✎ Редактировать" виден только при onOpenEditor И catalog.spec.write', async () => {
    const onOpenEditor = vi.fn();
    const { rerender } = render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} onOpenEditor={onOpenEditor} />);
    await screen.findByText('Т1');
    expect(screen.queryByText(/Редактировать/)).not.toBeInTheDocument();

    useAuth.mockReturnValue({ user: withPerms('catalog.spec.write') });
    rerender(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} onOpenEditor={onOpenEditor} />);
    const user = userEvent.setup();
    await user.click(await screen.findByText(/Редактировать/));
    expect(onOpenEditor).toHaveBeenCalledWith([300]);
  });
});

describe('SpecPreviewPage — ProductRow: корзина/фото', () => {
  it('счётчик фото рендерится для изделий с images', async () => {
    render(<SpecPreviewPage productIds={[300, 301]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.getByText('2 фото')).toBeInTheDocument();
  });

  it('кнопка добавления в корзину видна только при sales.cart.write + activeCartId', async () => {
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    expect(screen.queryByTitle('Добавить в корзину')).not.toBeInTheDocument();
  });

  it('клик по "+" добавляет изделие в активную корзину', async () => {
    const addToCart = vi.fn().mockResolvedValue({ ok: true });
    useAuth.mockReturnValue({ user: withPerms('sales.cart.write') });
    useCart.mockReturnValue({ activeCartId: 9, addToCart, carts: [] });
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    // на странице оба фикстурных товара (mock previewBulk их оба возвращает) — берём кнопку Т1
    await user.click(screen.getAllByTitle('Добавить в корзину')[0]);
    expect(addToCart).toHaveBeenCalledWith(300, 1);
  });
});

describe('SpecPreviewPage — DocFileLink', () => {
  it('3D-превьюабельный файл вызывает onOpenViewer вместо скачивания', async () => {
    catalogApi.previewBulk.mockResolvedValue(ok({
      success: true,
      data: makeData({ products: [{ ...product1, documents: [{ doc_type_code: 'passport', files: [{ name: 'model.glb', folder_path: 'docs' }] }] }] }),
    }));
    const onOpenViewer = vi.fn();
    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} onOpenViewer={onOpenViewer} />);
    await user.click(await screen.findByText('model'));
    expect(onOpenViewer).toHaveBeenCalledWith({ relPath: 'docs/model.glb', fname: 'model.glb', mtlPath: null });
    expect(mediaApi.downloadFile).not.toHaveBeenCalled();
  });

  it('обычный файл скачивается через blob-URL', async () => {
    const blob = new Blob(['x']);
    mediaApi.downloadFile.mockResolvedValue({ blob: () => Promise.resolve(blob) });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await user.click(await screen.findByText('p1'));

    await waitFor(() => expect(mediaApi.downloadFile).toHaveBeenCalledWith('docs/p1.pdf'));
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');
    vi.restoreAllMocks();
  });
});

describe('SpecPreviewPage — загрузка документа по строке (drag&drop)', () => {
  it('успешная загрузка вызывает onUploaded, обновляет кэш и рендерит новый файл', async () => {
    useAuth.mockReturnValue({ user: withPerms('media.doc.upload') });
    mediaApi.uploadProductDocument.mockResolvedValue(ok({ success: true, converting: false }));
    mediaApi.getProductDocuments.mockResolvedValue(ok({
      success: true, data: [{ current: [{ name: 'new.pdf', rel_path: 'x/new.pdf' }] }],
    }));
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');

    const row = screen.getByText('Т1').closest('tr');
    const file = new File(['x'], 'new.pdf', { type: 'application/pdf' });
    fireEvent.dragOver(row);
    fireEvent.drop(row, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(mediaApi.uploadProductDocument).toHaveBeenCalledWith(docType1.id, 300, file));
    expect(await screen.findByTitle('new.pdf')).toBeInTheDocument();
  });

  it('без активного/разрешённого типа документа drop игнорируется', async () => {
    render(<SpecPreviewPage productIds={[300]} onBack={vi.fn()} />);
    await screen.findByText('Т1');
    const row = screen.getByText('Т1').closest('tr');
    fireEvent.drop(row, { dataTransfer: { files: [new File(['x'], 'a.pdf')] } });
    expect(mediaApi.uploadProductDocument).not.toHaveBeenCalled();
  });
});
