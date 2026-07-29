import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/IssuesContext.jsx', () => ({
  IssuesProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/NotificationsContext.jsx', () => ({
  NotificationsProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/CartContext', () => ({
  CartProvider: ({ children }) => <>{children}</>,
}));

// AuthPage сюда не рендерится (user всегда задан), но App.jsx импортирует
// его форм-компоненты статически — мокаем по той же причине, что в шаге 1.
vi.mock('../components/auth/LoginForm', () => ({ default: () => null }));
vi.mock('../components/auth/RegisterForm', () => ({ default: () => null }));
vi.mock('../components/auth/ActivateForm', () => ({ default: () => null }));
vi.mock('../components/auth/TwoFAForm', () => ({ default: () => null }));
vi.mock('../components/auth/PasswordResetForm', () => ({ default: () => null }));

vi.mock('../components/layout/Header', () => ({
  default: ({ currentPage, onNavigate }) => (
    <div data-testid="header-stub" data-current-page={currentPage}>
      <input
        data-testid="nav-input"
        onChange={(e) => {
          const [page, payload] = JSON.parse(e.target.value);
          onNavigate(page, payload);
        }}
      />
    </div>
  ),
}));

vi.mock('../components/configurator/FilterTree', () => ({
  default: ({ onOpenSpecEditor, onOpenSpecPreview, onOpenThread, savedState, onSaveState }) => (
    <div data-testid="page-configurator" data-saved-state={JSON.stringify(savedState ?? null)}>
      <button onClick={() => onOpenSpecEditor([1, 2])}>configurator-open-spec-editor</button>
      <button onClick={() => onOpenSpecPreview([3, 4])}>configurator-open-spec-preview</button>
      <button onClick={() => onOpenThread(99)}>configurator-open-thread</button>
      <button onClick={() => onSaveState({ selectedTypeId: 't1' })}>configurator-save-state</button>
    </div>
  ),
}));

vi.mock('../pages/ProductPage', () => ({
  default: ({ productId, onBack, onOpenThread, onOpenViewer }) => (
    <div data-testid="page-product" data-product-id={productId}>
      <button onClick={onBack}>product-back</button>
      <button onClick={() => onOpenThread(55)}>product-open-thread</button>
      <button onClick={() => onOpenViewer({ relPath: 'r', fname: 'f.obj' })}>product-open-viewer</button>
    </div>
  ),
}));

vi.mock('../pages/SpecEditorPage', () => ({
  default: ({ productIds, sessionId, initialChanges, onBack, onReset, onSessionSaved }) => (
    <div
      data-testid="page-spec-editor"
      data-product-ids={JSON.stringify(productIds)}
      data-session-id={sessionId ?? ''}
      data-initial-changes={JSON.stringify(initialChanges)}
    >
      <button onClick={onBack}>spec-editor-back</button>
      <button onClick={onReset}>spec-editor-reset</button>
      <button onClick={() => onSessionSaved(777)}>spec-editor-session-saved</button>
    </div>
  ),
}));

vi.mock('../pages/SpecPreviewPage', () => ({
  default: ({ productIds, onBack, onOpenEditor, onOpenViewer }) => (
    <div data-testid="page-spec-preview" data-product-ids={JSON.stringify(productIds)}>
      <button onClick={onBack}>spec-preview-back</button>
      <button onClick={() => onOpenEditor([9])}>spec-preview-open-editor</button>
      <button onClick={() => onOpenViewer({ relPath: 'x', fname: 'y.obj' })}>spec-preview-open-viewer</button>
    </div>
  ),
}));

vi.mock('../pages/DocumentsPage', () => ({
  default: ({ onOpenViewer, onFolderUpload }) => (
    <div data-testid="page-documents">
      <button onClick={() => onOpenViewer({ relPath: 'd', fname: 'e.obj' })}>documents-open-viewer</button>
      <button onClick={onFolderUpload}>documents-folder-upload</button>
    </div>
  ),
}));

vi.mock('../pages/PLMPage', () => ({
  default: ({ onOpenProduct }) => (
    <div data-testid="page-plm">
      <button onClick={() => onOpenProduct(321)}>plm-open-product</button>
    </div>
  ),
}));

vi.mock('../pages/IssuesPage.jsx', () => ({
  default: ({ onOpenThread }) => (
    <div data-testid="page-issues">
      <button onClick={() => onOpenThread(42)}>issues-open-thread</button>
    </div>
  ),
}));

vi.mock('../pages/CartPage', () => ({
  default: ({ onNavigate }) => (
    <div data-testid="page-sales">
      <button onClick={() => onNavigate('cart-kp', 5)}>sales-open-cart-kp</button>
    </div>
  ),
}));

vi.mock('../pages/ModelViewerPage', () => ({
  default: ({ relPath, fname, mtlPath, onBack }) => (
    <div data-testid="page-model-viewer" data-rel-path={relPath} data-fname={fname} data-mtl-path={mtlPath ?? ''}>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));
vi.mock('../pages/ProductMasterPage', () => ({
  default: ({ onBack }) => <div data-testid="page-series-master"><button onClick={onBack}>back</button></div>,
}));
vi.mock('../pages/FolderUploadPage', () => ({
  default: ({ onBack }) => <div data-testid="page-folder-upload"><button onClick={onBack}>back</button></div>,
}));
vi.mock('../pages/IssueThreadPage.jsx', () => ({
  default: ({ threadId, onBack }) => (
    <div data-testid="page-issue-thread" data-thread-id={threadId ?? ''}><button onClick={onBack}>back</button></div>
  ),
}));
vi.mock('../pages/CartKPPage', () => ({
  default: ({ cartId, onBack }) => (
    <div data-testid="page-cart-kp" data-cart-id={cartId ?? ''}><button onClick={onBack}>back</button></div>
  ),
}));
vi.mock('../pages/VariantEditorPage', () => ({
  default: ({ onBack }) => <div data-testid="page-variant-editor"><button onClick={onBack}>back</button></div>,
}));

vi.mock('../pages/ParameterEditorPage', () => ({ default: () => <div data-testid="page-parameters" /> }));
vi.mock('../pages/StaffPage', () => ({ default: () => <div data-testid="page-staff" /> }));
vi.mock('../pages/HeatExchangersPage', () => ({ default: () => <div data-testid="page-heat-exchangers" /> }));
vi.mock('../pages/AccessoryKitsPage', () => ({ default: () => <div data-testid="page-accessory-kits" /> }));
vi.mock('../pages/DefectActPage', () => ({ default: () => <div data-testid="page-defect-acts" /> }));
vi.mock('../pages/SelectionPage', () => ({ default: () => <div data-testid="page-selection" /> }));
vi.mock('../pages/FanChartPage', () => ({ default: () => <div data-testid="page-fan-charts" /> }));
vi.mock('../pages/PartEditorPage', () => ({ default: () => <div data-testid="page-part-editor" /> }));

const baseUser = { id: 1, email: 'user@example.com', is_confirmed: true, permissions: [] };

const setAuth = (overrides = {}) => {
  useAuth.mockReturnValue({
    user: baseUser,
    loading: false,
    activeSession: null,
    setActiveSession: vi.fn(),
    ...overrides,
  });
};

// React отслеживает предыдущее value инпута и глушит onChange, если
// fireEvent.change выставляет ТУ ЖЕ строку повторно (например, goTo('product', 1)
// дважды подряд) — добавляем счётчик, чтобы значение всегда было уникальным.
let navCallSeq = 0;
const goTo = (page, payload) => {
  navCallSeq += 1;
  fireEvent.change(screen.getByTestId('nav-input'), {
    target: { value: JSON.stringify([page, payload ?? null, navCallSeq]) },
  });
};

const setPath = (path) => {
  window.history.pushState({}, '', path);
};

beforeEach(() => {
  setPath('/configurator');
  sessionStorage.clear();
  setAuth();
});

describe('MainApp — начальная страница и history', () => {
  it('берёт стартовую страницу из URL pathname', () => {
    setPath('/documents');
    render(<App />);
    expect(screen.getByTestId('page-documents')).toBeInTheDocument();
  });

  it('пустой pathname трактуется как configurator', () => {
    setPath('/');
    render(<App />);
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();
  });

  it('на маунте синхронизирует history.replaceState с текущей страницей', () => {
    setPath('/documents');
    render(<App />);
    expect(window.history.state).toEqual({ page: 'documents', payload: null });
  });
});

describe('MainApp — FilterTree всегда смонтирован', () => {
  it('остаётся в DOM на других страницах (скрыт через display:none), виден на configurator', () => {
    render(<App />);
    goTo('documents');

    const configuratorEl = screen.getByTestId('page-configurator');
    expect(configuratorEl).toBeInTheDocument();
    expect(configuratorEl.parentElement.style.display).toBe('none');

    goTo('configurator');
    expect(configuratorEl.parentElement.style.display).toBe('block');
  });
});

describe('MainApp — гейт по is_confirmed', () => {
  it('неподтверждённый пользователь видит экран ожидания на закрытых страницах', () => {
    setAuth({ user: { ...baseUser, is_confirmed: false } });
    render(<App />);
    goTo('staff');

    expect(screen.getByText('Ожидание подтверждения')).toBeInTheDocument();
    expect(screen.queryByTestId('page-staff')).not.toBeInTheDocument();
  });

  it('неподтверждённому доступны публичные страницы configurator/product', () => {
    setAuth({ user: { ...baseUser, is_confirmed: false } });
    render(<App />);

    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();
    expect(screen.queryByText('Ожидание подтверждения')).not.toBeInTheDocument();

    goTo('product', 7);
    expect(screen.getByTestId('page-product')).toBeInTheDocument();
  });

  it('подтверждённому пользователю доступны все страницы', () => {
    render(<App />);
    goTo('staff');
    expect(screen.getByTestId('page-staff')).toBeInTheDocument();
  });
});

describe('MainApp — handleNavigate: побочные эффекты по типу страницы', () => {
  it('product сохраняет selectedProductId в sessionStorage', () => {
    render(<App />);
    goTo('product', 42);

    expect(screen.getByTestId('page-product')).toHaveAttribute('data-product-id', '42');
    expect(sessionStorage.getItem('selectedProductId')).toBe('42');
    expect(window.history.state).toEqual({ page: 'product', payload: 42 });
  });

  it('issue-thread сохраняет selectedThreadId в sessionStorage', () => {
    render(<App />);
    goTo('issue-thread', 15);

    expect(screen.getByTestId('page-issue-thread')).toHaveAttribute('data-thread-id', '15');
    expect(sessionStorage.getItem('selectedThreadId')).toBe('15');
  });

  it('spec-preview сохраняет productIds в sessionStorage (JSON)', () => {
    render(<App />);
    goTo('spec-preview', [1, 2, 3]);

    expect(screen.getByTestId('page-spec-preview')).toHaveAttribute('data-product-ids', '[1,2,3]');
    expect(sessionStorage.getItem('specPreviewProductIds')).toBe('[1,2,3]');
  });

  it('spec-editor сбрасывает sessionId/initialChanges при новом наборе productIds', () => {
    render(<App />);
    goTo('spec-editor', [5, 6]);

    const el = screen.getByTestId('page-spec-editor');
    expect(el).toHaveAttribute('data-product-ids', '[5,6]');
    expect(el).toHaveAttribute('data-session-id', '');
    expect(el).toHaveAttribute('data-initial-changes', '{}');
  });

  it('model-viewer выставляет modelViewerFile и переключает на полноэкранный режим (без Header)', async () => {
    render(<App />);
    goTo('model-viewer', { relPath: 'docs/a', fname: 'model.obj', mtlPath: 'docs/a/model.mtl' });

    // ModelViewerPage грузится лениво (React.lazy) — первое обращение в файле
    // требует дождаться разрешения промиса импорта, дальше React кеширует.
    const el = await screen.findByTestId('page-model-viewer');
    expect(el).toHaveAttribute('data-rel-path', 'docs/a');
    expect(el).toHaveAttribute('data-fname', 'model.obj');
    expect(el).toHaveAttribute('data-mtl-path', 'docs/a/model.mtl');
    expect(screen.queryByTestId('header-stub')).not.toBeInTheDocument();
  });

  it('cart-kp выставляет kpCartId', () => {
    render(<App />);
    goTo('cart-kp', 8);
    expect(screen.getByTestId('page-cart-kp')).toHaveAttribute('data-cart-id', '8');
  });
});

describe('MainApp — popstate (навигация браузера назад/вперёд)', () => {
  it('восстанавливает page и payload для product', () => {
    render(<App />);
    goTo('product', 11);
    goTo('documents');
    expect(screen.getByTestId('page-documents')).toBeInTheDocument();

    fireEvent.popState(window, { state: { page: 'product', payload: 11 } });
    expect(screen.getByTestId('page-product')).toHaveAttribute('data-product-id', '11');
  });

  it('без state в событии откатывается на configurator', () => {
    render(<App />);
    goTo('documents');

    fireEvent.popState(window, { state: null });
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();
  });
});

describe('MainApp — восстановление активной сессии (spec-editor)', () => {
  it('activeSession с page=spec-editor открывает редактор с сохранёнными данными', () => {
    setAuth({
      user: baseUser,
      activeSession: { id: 501, data: { page: 'spec-editor', product_ids: [1, 2], changes: { 1: { qty: 5 } } } },
    });
    render(<App />);

    const el = screen.getByTestId('page-spec-editor');
    expect(el).toHaveAttribute('data-product-ids', '[1,2]');
    expect(el).toHaveAttribute('data-session-id', '501');
    expect(el).toHaveAttribute('data-initial-changes', JSON.stringify({ 1: { qty: 5 } }));
  });

  it('activeSession без product_ids не переключает страницу', () => {
    setAuth({
      user: baseUser,
      activeSession: { id: 501, data: { page: 'spec-editor', product_ids: [] } },
    });
    render(<App />);
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();
  });
});

describe('MainApp — колбэки конфигуратора', () => {
  it('onOpenSpecEditor/onOpenSpecPreview/onOpenThread переключают страницу с payload', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('configurator-open-spec-editor'));
    expect(screen.getByTestId('page-spec-editor')).toHaveAttribute('data-product-ids', '[1,2]');

    goTo('configurator');
    await user.click(screen.getByText('configurator-open-spec-preview'));
    expect(screen.getByTestId('page-spec-preview')).toHaveAttribute('data-product-ids', '[3,4]');

    goTo('configurator');
    await user.click(screen.getByText('configurator-open-thread'));
    expect(screen.getByTestId('page-issue-thread')).toHaveAttribute('data-thread-id', '99');
  });

  it('onSaveState сохраняет configuratorState в sessionStorage и прокидывает обратно как savedState', () => {
    render(<App />);
    fireEvent.click(screen.getByText('configurator-save-state'));

    expect(sessionStorage.getItem('configuratorState')).toBe(JSON.stringify({ selectedTypeId: 't1' }));
    expect(screen.getByTestId('page-configurator')).toHaveAttribute(
      'data-saved-state', JSON.stringify({ selectedTypeId: 't1' })
    );
  });
});

describe('MainApp — колбэки ProductPage/SpecEditorPage/SpecPreviewPage/DocumentsPage/PLMPage/IssuesPage/CartPage', () => {
  it('ProductPage: back/onOpenThread/onOpenViewer', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('product', 1);

    await user.click(screen.getByText('product-open-thread'));
    expect(screen.getByTestId('page-issue-thread')).toHaveAttribute('data-thread-id', '55');

    goTo('product', 1);
    await user.click(screen.getByText('product-back'));
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();

    // onOpenViewer уводит в полноэкранный model-viewer без Header — делаем это
    // последним, иначе goTo (через Header) станет недоступен для следующих шагов
    goTo('product', 1);
    await user.click(screen.getByText('product-open-viewer'));
    expect(screen.getByTestId('page-model-viewer')).toHaveAttribute('data-rel-path', 'r');
  });

  it('SpecEditorPage: onBack → configurator, onReset чистит сессию, onSessionSaved обновляет id', async () => {
    const user = userEvent.setup();
    const setActiveSession = vi.fn();
    setAuth({
      user: baseUser,
      activeSession: { id: 501, data: { page: 'spec-editor', product_ids: [1] } },
      setActiveSession,
    });
    render(<App />);

    await user.click(screen.getByText('spec-editor-session-saved'));
    expect(setActiveSession).toHaveBeenCalled();

    await user.click(screen.getByText('spec-editor-reset'));
    expect(setActiveSession).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();
  });

  it('SpecPreviewPage: onBack/onOpenEditor/onOpenViewer', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('spec-preview', [1]);

    await user.click(screen.getByText('spec-preview-open-editor'));
    expect(screen.getByTestId('page-spec-editor')).toHaveAttribute('data-product-ids', '[9]');

    goTo('spec-preview', [1]);
    await user.click(screen.getByText('spec-preview-back'));
    expect(screen.getByTestId('page-configurator')).toBeInTheDocument();

    // onOpenViewer — полноэкранный model-viewer без Header, делаем последним
    goTo('spec-preview', [1]);
    await user.click(screen.getByText('spec-preview-open-viewer'));
    expect(screen.getByTestId('page-model-viewer')).toBeInTheDocument();
  });

  it('DocumentsPage: onOpenViewer/onFolderUpload', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('documents');

    await user.click(screen.getByText('documents-folder-upload'));
    expect(screen.getByTestId('page-folder-upload')).toBeInTheDocument();

    goTo('documents');
    await user.click(screen.getByText('documents-open-viewer'));
    expect(screen.getByTestId('page-model-viewer')).toHaveAttribute('data-rel-path', 'd');
  });

  it('PLMPage.onOpenProduct открывает страницу товара', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('plm');

    await user.click(screen.getByText('plm-open-product'));
    expect(screen.getByTestId('page-product')).toHaveAttribute('data-product-id', '321');
  });

  it('IssuesPage.onOpenThread открывает тред', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('issues');

    await user.click(screen.getByText('issues-open-thread'));
    expect(screen.getByTestId('page-issue-thread')).toHaveAttribute('data-thread-id', '42');
  });

  it('CartPage.onNavigate прокидывается напрямую в handleNavigate', async () => {
    const user = userEvent.setup();
    render(<App />);
    goTo('sales');

    await user.click(screen.getByText('sales-open-cart-kp'));
    expect(screen.getByTestId('page-cart-kp')).toHaveAttribute('data-cart-id', '5');
  });
});

describe('MainApp — простые onBack-страницы', () => {
  it.each([
    ['model-viewer', 'documents'],
    ['series-master', 'parameters'],
    ['folder-upload', 'documents'],
    ['issue-thread', 'issues'],
    ['cart-kp', 'sales'],
    ['variant-editor', 'configurator'],
  ])('%s: onBack ведёт на %s', async (page, target) => {
    const user = userEvent.setup();
    render(<App />);
    goTo(page, page === 'model-viewer' ? { relPath: 'a', fname: 'b.obj' } : 1);

    await user.click(screen.getByText('back'));

    const targetTestId = `page-${target}`;
    expect(screen.getByTestId(targetTestId)).toBeInTheDocument();
  });
});
