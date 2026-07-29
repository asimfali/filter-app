import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DirectProductsPanel from '../DirectProductsPanel';
import { mediaApi } from '../../../api/media';

vi.mock('../../../api/media', () => ({
    mediaApi: {
        getHeatExchangerProducts: vi.fn(),
        getAccessoryKitProducts: vi.fn(),
        getDocumentProducts: vi.fn(),
        addProductsToHeatExchanger: vi.fn(),
        addProductsToAccessoryKit: vi.fn(),
        addProductsToDocument: vi.fn(),
        removeProductsFromHeatExchanger: vi.fn(),
        removeProductsFromAccessoryKit: vi.fn(),
        removeProductsFromDocument: vi.fn(),
    },
}));

const p1 = { id: 1, name: 'ВО-3.5', external_id: 'VO-35' };
const p2 = { id: 2, name: 'ВО-4' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [] }),
    }));
});

describe('DirectProductsPanel — открытие/загрузка по entityType', () => {
    it('document (дефолт): открытие грузит через getDocumentProducts', async () => {
        const user = userEvent.setup();
        mediaApi.getDocumentProducts.mockResolvedValue({ ok: true, data: { products: [p1] } });
        render(<DirectProductsPanel entityId={10} entityType="document" canWrite={false} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        expect(await screen.findByText('ВО-3.5')).toBeInTheDocument();
        expect(mediaApi.getDocumentProducts).toHaveBeenCalledWith(10);
    });

    it('heat-exchanger: грузит через getHeatExchangerProducts', async () => {
        const user = userEvent.setup();
        mediaApi.getHeatExchangerProducts.mockResolvedValue({ ok: true, data: { products: [] } });
        render(<DirectProductsPanel entityId={5} entityType="heat-exchanger" canWrite={false} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        await waitFor(() => expect(mediaApi.getHeatExchangerProducts).toHaveBeenCalledWith(5));
        expect(await screen.findByText('Прямых привязок нет')).toBeInTheDocument();
    });

    it('accessory-kit: грузит через getAccessoryKitProducts', async () => {
        const user = userEvent.setup();
        mediaApi.getAccessoryKitProducts.mockResolvedValue({ ok: true, data: { products: [] } });
        render(<DirectProductsPanel entityId={7} entityType="accessory-kit" canWrite={false} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        await waitFor(() => expect(mediaApi.getAccessoryKitProducts).toHaveBeenCalledWith(7));
    });

    it('счётчик показывается только при закрытой панели', async () => {
        const user = userEvent.setup();
        mediaApi.getDocumentProducts.mockResolvedValue({ ok: true, data: { products: [p1, p2] } });
        render(<DirectProductsPanel entityId={10} entityType="document" canWrite={false} />);
        const toggle = screen.getByText('Прямые привязки к изделиям');
        await user.click(toggle);
        await screen.findByText('ВО-3.5');
        expect(screen.queryByText('(2)')).not.toBeInTheDocument();
        await user.click(toggle);
        expect(await screen.findByText('(2)')).toBeInTheDocument();
    });
});

describe('DirectProductsPanel — canWrite=false', () => {
    it('скрывает форму поиска и кнопки удаления', async () => {
        const user = userEvent.setup();
        mediaApi.getDocumentProducts.mockResolvedValue({ ok: true, data: { products: [p1] } });
        render(<DirectProductsPanel entityId={10} entityType="document" canWrite={false} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        await screen.findByText('ВО-3.5');
        expect(screen.queryByPlaceholderText('Найти изделие...')).not.toBeInTheDocument();
        expect(screen.queryByText('×')).not.toBeInTheDocument();
    });
});

describe('DirectProductsPanel — поиск и добавление (canWrite=true)', () => {
    async function openPanel(user, products = []) {
        mediaApi.getDocumentProducts.mockResolvedValue({ ok: true, data: { products } });
        render(<DirectProductsPanel entityId={10} entityType="document" canWrite={true} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        await waitFor(() => expect(mediaApi.getDocumentProducts).toHaveBeenCalled());
        return screen.getByPlaceholderText('Найти изделие...');
    }

    it('поиск короче 2 символов не запрашивает fetch', async () => {
        const user = userEvent.setup();
        const input = await openPanel(user);
        await user.type(input, 'В');
        await new Promise(r => setTimeout(r, 350));
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('поиск с дебаунсом исключает уже привязанные id из подсказок', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ success: true, data: [p1, p2] }),
        }));
        const input = await openPanel(user, [p1]);
        await user.type(input, 'ВО');
        expect(await screen.findByText('ВО-4')).toBeInTheDocument();
        expect(screen.queryByText('ВО-3.5', { selector: 'button *' })).not.toBeInTheDocument();
    });

    it('выбор подсказки (mousedown) вызывает addProductsTo... и добавляет в список', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ success: true, data: [p2] }),
        }));
        mediaApi.addProductsToDocument.mockResolvedValue({ ok: true });
        const input = await openPanel(user, []);
        await user.type(input, 'ВО');
        const suggestion = await screen.findByText('ВО-4');
        fireEvent.mouseDown(suggestion);

        await waitFor(() => expect(mediaApi.addProductsToDocument).toHaveBeenCalledWith(10, [2]));
        expect(await screen.findByText('ВО-4', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Найти изделие...')).toHaveValue('');
    });

    it('регрессия: handleRemove вызывает removeProductsFromDocument, а не повторный GET', async () => {
        const user = userEvent.setup();
        mediaApi.removeProductsFromDocument.mockResolvedValue({ ok: true });
        await openPanel(user, [p1]);
        const removeBtn = screen.getByText('×');
        mediaApi.getDocumentProducts.mockClear();
        await user.click(removeBtn);

        await waitFor(() => expect(mediaApi.removeProductsFromDocument).toHaveBeenCalledWith(10, [1]));
        expect(mediaApi.getDocumentProducts).not.toHaveBeenCalled();
        expect(screen.queryByText('ВО-3.5')).not.toBeInTheDocument();
    });

    it('handleRemove для heat-exchanger/accessory-kit вызывает соответствующий removeProductsFrom...', async () => {
        const user = userEvent.setup();
        mediaApi.getHeatExchangerProducts.mockResolvedValue({ ok: true, data: { products: [p1] } });
        mediaApi.removeProductsFromHeatExchanger.mockResolvedValue({ ok: true });
        render(<DirectProductsPanel entityId={5} entityType="heat-exchanger" canWrite={true} />);
        await user.click(screen.getByText('Прямые привязки к изделиям'));
        await user.click(await screen.findByText('×'));
        await waitFor(() => expect(mediaApi.removeProductsFromHeatExchanger).toHaveBeenCalledWith(5, [1]));
    });
});
