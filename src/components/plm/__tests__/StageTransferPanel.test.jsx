import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StageTransferPanel from '../StageTransferPanel';
import { plmApi } from '../../../api/plm';

vi.mock('../../../api/plm', () => ({
    plmApi: {
        getProductSpecs: vi.fn(),
        transferSpecs: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });

const stage = { id: 7, litera_code: 'А', product_id: 55 };

const specs = [
    { id: 1, definition_id: 100, definition_name: 'Мощность', value: '10 кВт' },
    { id: 2, definition_id: 101, definition_name: 'Расход', value: '500 м³/ч' },
];
const serialSpecs = [{ definition_id: 100, value: '8 кВт' }]; // отличается от стадийного → перезапись

beforeEach(() => {
    vi.clearAllMocks();
});

async function goto(specsData = specs, serialData = serialSpecs) {
    plmApi.getProductSpecs.mockImplementation((productId, stageId) =>
        Promise.resolve(stageId === null ? ok(serialData) : ok(specsData))
    );
    const user = userEvent.setup();
    render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Мощность');
    return user;
}

describe('StageTransferPanel — загрузка', () => {
    it('показывает "Загрузка..." пока идёт запрос', () => {
        plmApi.getProductSpecs.mockReturnValue(new Promise(() => {}));
        render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('Загрузка характеристик...')).toBeInTheDocument();
    });

    it('грузит характеристики стадии и серийные параллельно, автовыбирает всё', async () => {
        await goto();
        expect(plmApi.getProductSpecs).toHaveBeenCalledWith(55, 7);
        expect(plmApi.getProductSpecs).toHaveBeenCalledWith(55, null);
        expect(screen.getByText('Выбрано: 2 из 2')).toBeInTheDocument();
    });

    it('подсвечивает willOverwrite, если серийное значение отличается', async () => {
        await goto();
        expect(screen.getByText('8 кВт')).toBeInTheDocument();
        expect(screen.getByText('→ перезапись')).toBeInTheDocument();
        expect(screen.getByText('нет')).toBeInTheDocument(); // для второй характеристики нет серийного
    });

    it('пустой список характеристик стадии — сообщение', async () => {
        plmApi.getProductSpecs.mockResolvedValue(ok([]));
        render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={vi.fn()} />);
        expect(await screen.findByText('Нет характеристик в этой стадии')).toBeInTheDocument();
    });

    it('сетевая ошибка при загрузке — "Ошибка загрузки"', async () => {
        plmApi.getProductSpecs.mockRejectedValue(new Error('network'));
        render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={vi.fn()} />);
        expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
    });
});

describe('StageTransferPanel — выбор и перенос', () => {
    it('toggle одной характеристики снимает и снова выбирает', async () => {
        const user = await goto();
        const row = screen.getByText('Мощность').closest('tr');
        const checkbox = row.querySelector('input[type="checkbox"]');
        await user.click(checkbox);
        expect(screen.getByText('Выбрано: 1 из 2')).toBeInTheDocument();
        await user.click(checkbox);
        expect(screen.getByText('Выбрано: 2 из 2')).toBeInTheDocument();
    });

    it('чекбокс в шапке снимает/выбирает все', async () => {
        const user = await goto();
        const headerCheckbox = document.querySelector('thead input[type="checkbox"]');
        await user.click(headerCheckbox);
        expect(screen.getByText('Выбрано: 0 из 2')).toBeInTheDocument();
        await user.click(headerCheckbox);
        expect(screen.getByText('Выбрано: 2 из 2')).toBeInTheDocument();
    });

    it('кнопка переноса disabled без выбора, счётчик "Перенести N"', async () => {
        const user = await goto();
        expect(screen.getByText('Перенести 2')).toBeInTheDocument();
        const headerCheckbox = document.querySelector('thead input[type="checkbox"]');
        await user.click(headerCheckbox);
        expect(screen.getByText('Перенести 0')).toBeDisabled();
    });

    it('успешный перенос вызывает onDone(transferred)', async () => {
        const onDone = vi.fn();
        plmApi.getProductSpecs.mockImplementation((productId, stageId) =>
            Promise.resolve(stageId === null ? ok(serialSpecs) : ok(specs))
        );
        plmApi.transferSpecs.mockResolvedValue(ok({ transferred: 2 }));
        const user = userEvent.setup();
        render(<StageTransferPanel stage={stage} onDone={onDone} onClose={vi.fn()} />);
        await screen.findByText('Мощность');

        await user.click(screen.getByText('Перенести 2'));
        await waitFor(() => expect(plmApi.transferSpecs).toHaveBeenCalledWith(7, [1, 2]));
        expect(onDone).toHaveBeenCalledWith(2);
    });

    it('ошибка переноса показывает сообщение', async () => {
        plmApi.getProductSpecs.mockImplementation((productId, stageId) =>
            Promise.resolve(stageId === null ? ok(serialSpecs) : ok(specs))
        );
        plmApi.transferSpecs.mockResolvedValue({ ok: false, data: { success: false, error: 'Конфликт' } });
        const user = userEvent.setup();
        render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={vi.fn()} />);
        await screen.findByText('Мощность');
        await user.click(screen.getByText('Перенести 2'));
        expect(await screen.findByText('Конфликт')).toBeInTheDocument();
    });

    it('клик по строке тоже переключает выбор (не только чекбокс)', async () => {
        const user = await goto();
        await user.click(screen.getByText('Мощность'));
        expect(screen.getByText('Выбрано: 1 из 2')).toBeInTheDocument();
    });

    it('"×" вызывает onClose', async () => {
        const onClose = vi.fn();
        plmApi.getProductSpecs.mockImplementation((productId, stageId) =>
            Promise.resolve(stageId === null ? ok(serialSpecs) : ok(specs))
        );
        const user = userEvent.setup();
        render(<StageTransferPanel stage={stage} onDone={vi.fn()} onClose={onClose} />);
        await screen.findByText('Мощность');
        await user.click(screen.getByText('×'));
        expect(onClose).toHaveBeenCalled();
    });
});
