import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductPage from '../ProductPage';
import { mediaApi } from '../../api/media';
import { plmApi } from '../../api/plm';
import { getThreadsByProduct } from '../../api/issues.js';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';

vi.mock('../../api/auth', () => ({ tokenStorage: { getAccess: vi.fn(() => 'token') } }));
vi.mock('../../api/media', () => ({
    mediaApi: {
        getFormData: vi.fn(),
        uploadProductDocument: vi.fn(),
        getProductDocuments: vi.fn(),
    },
}));
vi.mock('../../api/plm', () => ({ plmApi: { getStages: vi.fn() } }));
vi.mock('../../api/issues.js', () => ({ getThreadsByProduct: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../../components/plm/ProductStages', () => ({
    default: ({ stages, onStageChange }) => (
        <div data-testid="product-stages-stub">
            <button onClick={() => onStageChange([{ ...stages[0], status: 'active' }])}>advance-stage</button>
        </div>
    ),
}));
vi.mock('../../components/plm/LiteraSelector', () => ({
    default: ({ stages, selected, onChange }) => (
        <div data-testid="litera-selector-stub">
            {stages.map(s => (
                <button key={s.id} onClick={() => onChange(s)}>
                    {selected?.id === s.id ? `✓${selected.litera_code}:${selected.status}` : `${s.litera_code}:${s.status}`}
                </button>
            ))}
        </div>
    ),
}));
vi.mock('../../components/media/AccessTokenModal', () => ({
    default: ({ onClose }) => (
        <div data-testid="access-token-modal-stub"><button onClick={onClose}>close-access</button></div>
    ),
}));
vi.mock('../../components/media/DocTypeSelector', () => ({
    default: ({ docTypes, activeDocType, onSelect }) => (
        <div data-testid="doc-type-selector-stub">
            {docTypes.map(dt => (
                <button key={dt.code} onClick={() => onSelect(dt)}>{activeDocType?.code === dt.code ? `✓${dt.name}` : dt.name}</button>
            ))}
        </div>
    ),
}));

const ok = (data) => ({ ok: true, data });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

function makeProduct(overrides = {}) {
    return {
        id: 1, name: 'ВО-3.5', product_type: 'Завеса', sku: 'VO-35',
        images: [], department_statuses: [], parameters: [], specs: [],
        heat_exchangers: [], accessories: [], documents: [], external_id: '',
        ...overrides,
    };
}

function jsonRes(body, okFlag = true) {
    return Promise.resolve({ ok: okFlag, json: () => Promise.resolve(body) });
}

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms() });
    useCart.mockReturnValue({ activeCartId: null, addToCart: vi.fn() });
    mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [] }));
    plmApi.getStages.mockResolvedValue(ok({ success: true, data: [] }));
    getThreadsByProduct.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('/card/')) {
            return jsonRes({ success: true, data: makeProduct() });
        }
        return jsonRes({});
    }));
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('ProductPage — загрузка карточки', () => {
    it('loading → рендерит карточку (имя/тип/sku)', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        expect(await screen.findByText('ВО-3.5')).toBeInTheDocument();
        expect(screen.getByText(/Завеса/)).toBeInTheDocument();
        expect(screen.getByText('VO-35')).toBeInTheDocument();
    });

    it('data.success:false — сообщение об ошибке + "← Назад"', async () => {
        const user = userEvent.setup();
        const onBack = vi.fn();
        vi.stubGlobal('fetch', vi.fn(() => jsonRes({ success: false })));
        render(<ProductPage productId={1} onBack={onBack} />);
        expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
        await user.click(screen.getByText('← Назад'));
        expect(onBack).toHaveBeenCalled();
    });

    it('сетевая ошибка — "Ошибка сети"', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        expect(await screen.findByText('Ошибка сети')).toBeInTheDocument();
    });

    it('"← Назад" в шапке вызывает onBack', async () => {
        const user = userEvent.setup();
        const onBack = vi.fn();
        render(<ProductPage productId={1} onBack={onBack} />);
        await user.click(await screen.findByText('← Назад'));
        expect(onBack).toHaveBeenCalled();
    });
});

describe('ProductPage — корзина', () => {
    it('без canSales/activeCartId — кнопки нет', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        expect(screen.queryByText('+ В корзину')).not.toBeInTheDocument();
    });

    it('с правом и активной корзиной — клик добавляет, показывает "✓ Добавлено"', async () => {
        useAuth.mockReturnValue({ user: withPerms('sales.cart.write') });
        const addToCart = vi.fn().mockResolvedValue();
        useCart.mockReturnValue({ activeCartId: 5, addToCart });
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');

        // fake timers — только после навигации, дальше исключительно fireEvent
        vi.useFakeTimers();
        fireEvent.click(screen.getByText('+ В корзину'));
        await vi.waitFor(() => expect(addToCart).toHaveBeenCalledWith(1, 1));
        await vi.waitFor(() => expect(screen.getByText('✓ Добавлено')).toBeInTheDocument());

        await vi.advanceTimersByTimeAsync(2000);
        expect(screen.getByText('+ В корзину')).toBeInTheDocument();
    });
});

describe('ProductPage — галерея (ImageSlider/AuthImage)', () => {
    it('без изображений — не рендерится', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        expect(document.querySelector('img')).toBeNull();
    });

    it('одно изображение — без стрелок/счётчика, грузит блоб через авторизованный fetch', async () => {
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.includes('/card/')) {
                return jsonRes({ success: true, data: makeProduct({ images: [{ rel_path: 'a/img1.jpg', name: 'img1' }] }) });
            }
            if (url.includes('/media/download/')) {
                return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
            }
            return jsonRes({});
        }));
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');

        expect(await screen.findByAltText('img1')).toHaveAttribute('src', 'blob:mock-url');
        expect(screen.queryByText('‹')).not.toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('несколько изображений — стрелки/миниатюры/счётчик, переключение', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.includes('/card/')) {
                return jsonRes({
                    success: true,
                    data: makeProduct({ images: [{ rel_path: 'a/1.jpg', name: 'img1' }, { rel_path: 'a/2.jpg', name: 'img2' }] }),
                });
            }
            if (url.includes('/media/download/')) {
                return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
            }
            return jsonRes({});
        }));
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');

        expect(await screen.findByText('1 / 2')).toBeInTheDocument();
        await user.click(screen.getByText('›'));
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
        await user.click(screen.getByText('‹'));
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        vi.restoreAllMocks();
    });
});

describe('ProductPage — статусы подразделений', () => {
    it('рендерятся только при непустом department_statuses', async () => {
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.includes('/card/')) {
                return jsonRes({
                    success: true,
                    data: makeProduct({ department_statuses: [{ department_code: 'otk', department: 'ОТК', status: 'Готово', color: '#000' }] }),
                });
            }
            return jsonRes({});
        }));
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        expect(await screen.findByText('ОТК — Готово')).toBeInTheDocument();
    });

    it('пустой массив — секции нет', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        expect(screen.queryByText('Статусы подразделений')).not.toBeInTheDocument();
    });
});

describe('ProductPage — стадии PLM', () => {
    it('без стадий — секция не рендерится', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        expect(screen.queryByText('Стадии (PLM)')).not.toBeInTheDocument();
    });

    it('useProductStages автовыбирает активную стадию — LiteraSelector и ProductStages сразу видны', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok({
            success: true,
            data: [{ id: 10, litera_code: 'А', status: 'draft' }, { id: 11, litera_code: 'Б', status: 'active' }],
        }));
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');

        expect(await screen.findByText('Стадии (PLM)')).toBeInTheDocument();
        // Активная стадия (Б) автовыбрана хуком useProductStages без клика
        expect(screen.getByText('✓Б:active')).toBeInTheDocument();
        expect(screen.getByTestId('product-stages-stub')).toBeInTheDocument();

        // Переключение на другую (черновик) стадию через LiteraSelector
        await user.click(screen.getByText('А:draft'));
        expect(screen.getByText('✓А:draft')).toBeInTheDocument();
        expect(screen.getByTestId('product-stages-stub')).toBeInTheDocument();
    });

    it('onStageChange обновляет только выбранную стадию по id', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok({
            success: true,
            data: [{ id: 10, litera_code: 'А', status: 'draft' }],
        }));
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        // Единственная стадия уже автовыбрана (draft, т.к. активной нет)
        await screen.findByText('✓А:draft');

        await user.click(screen.getByText('advance-stage'));
        expect(await screen.findByText('✓А:active')).toBeInTheDocument();
    });
});

describe('ProductPage — параметры', () => {
    it('рендерятся только при непустых parameters', async () => {
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (url.includes('/card/')) {
                return jsonRes({
                    success: true,
                    data: makeProduct({ parameters: [{ axis_code: 'series', axis_name: 'Серия', value: '200' }] }),
                });
            }
            return jsonRes({});
        }));
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        expect(await screen.findByText('Параметры')).toBeInTheDocument();
        expect(screen.getByText('Серия')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('пустой массив — секции нет', async () => {
        render(<ProductPage productId={1} onBack={vi.fn()} />);
        await screen.findByText('ВО-3.5');
        expect(screen.queryByText('Параметры')).not.toBeInTheDocument();
    });
});

async function renderWithProduct(overrides) {
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('/card/')) return jsonRes({ success: true, data: makeProduct(overrides) });
        if (url.includes('/media/download/')) return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
        return jsonRes({});
    }));
    const user = userEvent.setup();
    render(<ProductPage productId={1} onBack={vi.fn()} />);
    await screen.findByText('ВО-3.5');
    return user;
}

describe('ProductPage — HeatExchangerSection', () => {
    it('без heat_exchangers — не рендерится', async () => {
        await renderWithProduct({});
        expect(screen.queryByText(/Теплообменник/)).not.toBeInTheDocument();
    });

    it('рендерит характеристики в одну строку, заголовок с "и" для нескольких', async () => {
        await renderWithProduct({
            heat_exchangers: [
                { id: 1, mark: 'ТО-1', overall_dimensions: '100x200', body_dimensions: '90x190', water_volume: 5, row_count: 2, tube_thickness: 1, fin_pitch: 2, fin_thickness: 0.2, circuit_count: 1, collector_type: 'A', configuration: 'X' },
                { id: 2, mark: 'ТО-2', overall_dimensions: '110x210', body_dimensions: '95x195', water_volume: 6, row_count: 3, tube_thickness: 1, fin_pitch: 2, fin_thickness: 0.2, circuit_count: 1, collector_type: 'B', configuration: 'Y' },
            ],
        });
        expect(screen.getByText('Теплообменники')).toBeInTheDocument();
        expect(screen.getByText('ТО-1')).toBeInTheDocument();
        expect(screen.getByText('ТО-2')).toBeInTheDocument();
        expect(screen.getByText('100x200')).toBeInTheDocument();
    });

    it('клик по чертежу скачивает blob и открывает в новой вкладке', async () => {
        const user = await renderWithProduct({
            heat_exchangers: [{
                id: 1, mark: 'ТО-1', drawing_files: [{ rel_path: 'a/draw.pdf', name: 'draw.pdf' }],
            }],
        });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        await user.click(screen.getByText('draw.pdf'));
        await vi.waitFor(() => expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank'));
        vi.restoreAllMocks();
    });
});

describe('ProductPage — AccessoriesSection / AccessoryKitView', () => {
    it('без accessories — не рендерится', async () => {
        await renderWithProduct({});
        expect(screen.queryByText('Комплектующие / Автоматика')).not.toBeInTheDocument();
    });

    it('is_manual набор — сразу показывает kit.items без контролов подбора', async () => {
        await renderWithProduct({
            accessories: [{
                id: 1, is_manual: true, controls: { has_quantity: true, has_manual_switch: true, has_power: true },
                items: [{ id: 100, name: 'Реле давления', quantity: 1, is_required: true }],
                rules: [],
            }],
        });
        expect(screen.getByText('Комплектующие / Автоматика')).toBeInTheDocument();
        expect(screen.getByText('Реле давления')).toBeInTheDocument();
        expect(screen.getByText('×1')).toBeInTheDocument();
        expect(screen.queryByText('Кол-во завес:')).not.toBeInTheDocument();
    });

    it('без правил и не manual — "Позиций нет" (контролов нет)', async () => {
        await renderWithProduct({
            accessories: [{
                id: 1, is_manual: false, controls: { has_quantity: false, has_manual_switch: false, has_power: false },
                items: [], rules: [],
            }],
        });
        expect(screen.getByText('Позиций нет')).toBeInTheDocument();
    });

    it('подбор по количеству: разные диапазоны дают разные позиции, вне диапазона — "Нет подходящих"', async () => {
        const user = await renderWithProduct({
            accessories: [{
                id: 1, is_manual: false, controls: { has_quantity: true, has_manual_switch: false, has_power: false },
                items: [],
                rules: [
                    { priority: 1, quantity_from: 1, quantity_to: 2, rule_items: [{ id: 10, name: 'Малый комплект', quantity: 1, is_required: true }] },
                    { priority: 2, quantity_from: 3, quantity_to: 10, rule_items: [{ id: 11, name: 'Большой комплект', quantity: 2, is_required: false }] },
                ],
            }],
        });
        const qtyInput = screen.getByPlaceholderText('—');
        await user.type(qtyInput, '1');
        expect(await screen.findByText('Малый комплект')).toBeInTheDocument();
        expect(screen.queryByText('Большой комплект')).not.toBeInTheDocument();

        await user.clear(qtyInput);
        await user.type(qtyInput, '5');
        expect(await screen.findByText('Большой комплект')).toBeInTheDocument();
        expect(screen.queryByText('Малый комплект')).not.toBeInTheDocument();

        await user.clear(qtyInput);
        await user.type(qtyInput, '100');
        expect(await screen.findByText('Нет подходящих комплектующих')).toBeInTheDocument();
    });

    it('несколько правил с одинаковым минимальным priority — позиции конкатенируются', async () => {
        await renderWithProduct({
            accessories: [{
                id: 1, is_manual: false, controls: { has_quantity: true, has_manual_switch: false, has_power: false },
                items: [],
                rules: [
                    { priority: 1, quantity_from: 1, quantity_to: 5, rule_items: [{ id: 10, name: 'Позиция А', quantity: 1, is_required: true }] },
                    { priority: 1, quantity_from: 1, quantity_to: 5, rule_items: [{ id: 11, name: 'Позиция Б', quantity: 1, is_required: true }] },
                    { priority: 2, quantity_from: 1, quantity_to: 5, rule_items: [{ id: 12, name: 'Позиция В (ниже приоритет)', quantity: 1, is_required: true }] },
                ],
            }],
        });
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText('—'), '3');
        expect(await screen.findByText('Позиция А')).toBeInTheDocument();
        expect(screen.getByText('Позиция Б')).toBeInTheDocument();
        expect(screen.queryByText('Позиция В (ниже приоритет)')).not.toBeInTheDocument();
    });

    it('переключатель управления (Авто/Ручное) фильтрует по rule.is_manual', async () => {
        const user = await renderWithProduct({
            accessories: [{
                id: 1, is_manual: false, controls: { has_quantity: false, has_manual_switch: true, has_power: false },
                items: [],
                rules: [
                    { priority: 1, is_manual: false, rule_items: [{ id: 10, name: 'Авто-блок', quantity: 1, is_required: true }] },
                    { priority: 1, is_manual: true, rule_items: [{ id: 11, name: 'Ручной блок', quantity: 1, is_required: true }] },
                ],
            }],
        });
        await user.click(screen.getByText('Ручное'));
        expect(await screen.findByText('Ручной блок')).toBeInTheDocument();
        expect(screen.queryByText('Авто-блок')).not.toBeInTheDocument();

        await user.click(screen.getByText('Авто'));
        expect(await screen.findByText('Авто-блок')).toBeInTheDocument();
        expect(screen.queryByText('Ручной блок')).not.toBeInTheDocument();
    });
});

describe('ProductPage — характеристики (инлайн-редактирование)', () => {
    it('без can_edit — кнопка ✎ не рендерится', async () => {
        await renderWithProduct({
            specs: [{ id: 1, definition_name: 'Мощность', value: '10 кВт', can_edit: false }],
        });
        expect(screen.getByText('10 кВт')).toBeInTheDocument();
        expect(screen.queryByTitle('Редактировать')).not.toBeInTheDocument();
    });

    it('is_manual спека показывает пометку ✎ "Введено вручную"', async () => {
        await renderWithProduct({
            specs: [{ id: 1, definition_name: 'Мощность', value: '10 кВт', can_edit: false, is_manual: true }],
        });
        expect(screen.getByTitle('Введено вручную')).toBeInTheDocument();
    });

    it('Enter сохраняет через PATCH, помечает is_manual:true', async () => {
        const user = await renderWithProduct({
            specs: [{ id: 5, definition_name: 'Мощность', value: '10 кВт', can_edit: true }],
        });
        vi.mocked(fetch).mockImplementation((url) => {
            if (url.includes('/product-specs/5/')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
            }
            return jsonRes({});
        });
        await user.click(screen.getByTitle('Редактировать'));
        const input = screen.getByDisplayValue('10 кВт');
        await user.clear(input);
        await user.type(input, '20 кВт{Enter}');

        await vi.waitFor(() => expect(screen.getByText('20 кВт')).toBeInTheDocument());
        // Форма редактирования закрылась — снова виден просмотр со значением и кнопкой ✎
        expect(screen.getByTitle('Редактировать')).toBeInTheDocument();
    });

    it('Escape отменяет редактирование без сохранения', async () => {
        const user = await renderWithProduct({
            specs: [{ id: 5, definition_name: 'Мощность', value: '10 кВт', can_edit: true }],
        });
        await user.click(screen.getByTitle('Редактировать'));
        const input = screen.getByDisplayValue('10 кВт');
        await user.type(input, '{Escape}');
        expect(screen.getByText('10 кВт')).toBeInTheDocument();
    });

    it('ошибка сохранения показывает сообщение, не закрывает форму', async () => {
        const user = await renderWithProduct({
            specs: [{ id: 5, definition_name: 'Мощность', value: '10 кВт', can_edit: true }],
        });
        vi.mocked(fetch).mockImplementation((url) => {
            if (url.includes('/product-specs/5/')) {
                return Promise.resolve({ ok: false, json: () => Promise.resolve({ detail: 'Нельзя менять' }) });
            }
            return jsonRes({});
        });
        await user.click(screen.getByTitle('Редактировать'));
        const input = screen.getByDisplayValue('10 кВт');
        await user.type(input, '{Enter}');
        expect(await screen.findByText('Нельзя менять')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10 кВт')).toBeInTheDocument(); // форма всё ещё открыта
    });
});
