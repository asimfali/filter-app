import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectionConfigModal from '../SelectionConfigModal';
import { selectionApi } from '../../../api/selection';

vi.mock('../../../api/selection', () => ({
    selectionApi: {
        getConfig: vi.fn(),
        allOptions: vi.fn(),
        updateConfig: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data });

beforeEach(() => {
    vi.clearAllMocks();
    selectionApi.getConfig.mockResolvedValue(ok({
        success: true,
        data: { excluded_designs: [], excluded_series: [] },
    }));
    selectionApi.allOptions.mockResolvedValue(ok({
        success: true,
        data: { all_series: ['ВО', 'КЭВ'], all_designs: ['Design1', 'Design2'] },
    }));
});

describe('SelectionConfigModal', () => {
    it('не рендерится при open=false и не грузит данные', () => {
        const { container } = render(<SelectionConfigModal open={false} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
        expect(selectionApi.getConfig).not.toHaveBeenCalled();
    });

    it('при открытии грузит конфиг и опции параллельно, рендерит серии/дизайны', async () => {
        render(<SelectionConfigModal open={true} onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        expect(await screen.findByText('ВО')).toBeInTheDocument();
        expect(screen.getByText('КЭВ')).toBeInTheDocument();
        expect(screen.getByText('Design1')).toBeInTheDocument();
        expect(screen.getByText('Design2')).toBeInTheDocument();
        expect(selectionApi.getConfig).toHaveBeenCalled();
        expect(selectionApi.allOptions).toHaveBeenCalled();
    });

    it('toggle серии добавляет/убирает из excluded_series + счётчик', async () => {
        const user = userEvent.setup();
        render(<SelectionConfigModal open={true} onClose={vi.fn()} onSaved={vi.fn()} />);
        await screen.findByText('ВО');
        expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();

        await user.click(screen.getByText('ВО'));
        expect(screen.getByText('(1 выбрано)')).toBeInTheDocument();

        await user.click(screen.getByText('ВО'));
        expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
    });

    it('toggle дизайна независимо от серии + свой счётчик', async () => {
        const user = userEvent.setup();
        render(<SelectionConfigModal open={true} onClose={vi.fn()} onSaved={vi.fn()} />);
        await screen.findByText('Design1');

        await user.click(screen.getByText('Design1'));
        await user.click(screen.getByText('Design2'));
        expect(screen.getByText('(2 выбрано)')).toBeInTheDocument();

        await user.click(screen.getByText('Design1'));
        expect(screen.getByText('(1 выбрано)')).toBeInTheDocument();
    });

    it('сохраняет конфиг и вызывает onSaved + onClose при успехе', async () => {
        const user = userEvent.setup();
        const onSaved = vi.fn();
        const onClose = vi.fn();
        selectionApi.updateConfig.mockResolvedValue(ok({ success: true }));
        render(<SelectionConfigModal open={true} onClose={onClose} onSaved={onSaved} />);
        await screen.findByText('ВО');
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(selectionApi.updateConfig).toHaveBeenCalledWith({
            excluded_designs: [], excluded_series: ['ВО'],
        }));
        expect(onSaved).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('не вызывает onSaved/onClose при неуспешном сохранении', async () => {
        const user = userEvent.setup();
        const onSaved = vi.fn();
        const onClose = vi.fn();
        selectionApi.updateConfig.mockResolvedValue({ ok: false, data: {} });
        render(<SelectionConfigModal open={true} onClose={onClose} onSaved={onSaved} />);
        await screen.findByText('ВО');
        await user.click(screen.getByText('Сохранить'));

        await waitFor(() => expect(selectionApi.updateConfig).toHaveBeenCalled());
        expect(onSaved).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('"Отмена" закрывает без сохранения', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<SelectionConfigModal open={true} onClose={onClose} onSaved={vi.fn()} />);
        await screen.findByText('ВО');
        await user.click(screen.getByText('Отмена'));
        expect(onClose).toHaveBeenCalled();
        expect(selectionApi.updateConfig).not.toHaveBeenCalled();
    });
});
