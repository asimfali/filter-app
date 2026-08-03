import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalsPanel from '../ProposalsPanel';
import { selectionApi } from '../../../api/selection';

vi.mock('../../../api/selection', () => ({
    selectionApi: {
        proposalsList: vi.fn(),
        proposalsDetail: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data });

const p1 = {
    id: 1, proposal_number: 'П-1', customer: 'ООО Ромашка',
    status: 'DRAFT', selection_type: 'CURTAIN_SHUTTER', created_at: '2026-01-10T00:00:00Z',
};
const p2 = {
    id: 2, proposal_number: 'П-2', customer: 'АО Вектор',
    status: 'SENT', selection_type: 'CURTAIN_MIX', created_at: '2026-01-11T00:00:00Z',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ProposalsPanel — загрузка списка', () => {
    it('не запрашивает список, пока панель закрыта', () => {
        render(<ProposalsPanel open={false} onClose={vi.fn()} onRestore={vi.fn()} />);
        expect(selectionApi.proposalsList).not.toHaveBeenCalled();
    });

    it('запрашивает список при открытии: loading → рендер карточек', async () => {
        let resolveList;
        selectionApi.proposalsList.mockReturnValue(new Promise(r => { resolveList = r; }));
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();

        resolveList(ok([p1, p2]));
        expect(await screen.findByText('П-1')).toBeInTheDocument();
        expect(screen.getByText('П-2')).toBeInTheDocument();
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
    });

    it('пустой список — "Подборов нет"', async () => {
        selectionApi.proposalsList.mockResolvedValue(ok([]));
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        expect(await screen.findByText('Подборов нет')).toBeInTheDocument();
    });

    it('поддерживает формат {results: [...]}', async () => {
        selectionApi.proposalsList.mockResolvedValue(ok({ results: [p1] }));
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        expect(await screen.findByText('П-1')).toBeInTheDocument();
    });

    it('поддерживает формат {data: [...]}', async () => {
        selectionApi.proposalsList.mockResolvedValue(ok({ data: [p1] }));
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        expect(await screen.findByText('П-1')).toBeInTheDocument();
    });
});

describe('ProposalsPanel — статусы/типы/поиск/восстановление', () => {
    beforeEach(() => {
        selectionApi.proposalsList.mockResolvedValue(ok([p1, p2]));
    });

    it('рендерит метки статуса и типа', async () => {
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        await screen.findByText('П-1');
        expect(screen.getByText('Черновик')).toBeInTheDocument();
        expect(screen.getByText('Отправлено')).toBeInTheDocument();
        expect(screen.getByText('Завеса шиберующая')).toBeInTheDocument();
        expect(screen.getByText('Завеса смесительная')).toBeInTheDocument();
    });

    it('фильтр по заказчику/номеру (регистронезависимо)', async () => {
        const user = userEvent.setup();
        render(<ProposalsPanel open={true} onClose={vi.fn()} onRestore={vi.fn()} />);
        await screen.findByText('П-1');

        const search = screen.getByPlaceholderText('Заказчик или номер...');
        await user.type(search, 'ромашк');
        expect(screen.getByText('П-1')).toBeInTheDocument();
        expect(screen.queryByText('П-2')).not.toBeInTheDocument();

        await user.clear(search);
        await user.type(search, 'п-2');
        expect(screen.getByText('П-2')).toBeInTheDocument();
        expect(screen.queryByText('П-1')).not.toBeInTheDocument();
    });

    it('клик по карточке грузит детали и вызывает onRestore + onClose', async () => {
        const user = userEvent.setup();
        const onRestore = vi.fn();
        const onClose = vi.fn();
        const detail = { ...p1, params: { h: 2 } };
        selectionApi.proposalsDetail.mockResolvedValue(ok(detail));
        render(<ProposalsPanel open={true} onClose={onClose} onRestore={onRestore} />);
        await user.click(await screen.findByText('П-1'));

        await waitFor(() => expect(selectionApi.proposalsDetail).toHaveBeenCalledWith(1));
        expect(onRestore).toHaveBeenCalledWith(detail);
        expect(onClose).toHaveBeenCalled();
    });

    it('неуспешная загрузка деталей не вызывает onRestore/onClose', async () => {
        const user = userEvent.setup();
        const onRestore = vi.fn();
        const onClose = vi.fn();
        selectionApi.proposalsDetail.mockResolvedValue({ ok: false, data: {} });
        render(<ProposalsPanel open={true} onClose={onClose} onRestore={onRestore} />);
        await user.click(await screen.findByText('П-1'));

        await waitFor(() => expect(selectionApi.proposalsDetail).toHaveBeenCalled());
        expect(onRestore).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('кнопка × вызывает onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<ProposalsPanel open={true} onClose={onClose} onRestore={vi.fn()} />);
        await screen.findByText('П-1');
        await user.click(screen.getByText('×'));
        expect(onClose).toHaveBeenCalled();
    });
});
