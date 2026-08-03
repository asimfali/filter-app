import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductStages from '../ProductStages';
import { plmApi } from '../../../api/plm';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../api/plm', () => ({
    plmApi: {
        getApprovals: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        getStages: vi.fn(),
    },
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const stage1 = { id: 1, litera_code: 'А', litera_name: 'Опытная', status: 'draft' };
const stage2 = { id: 2, litera_code: 'Б', litera_name: 'Серийная', status: 'active' };

const approvalPending = { id: 100, department: 5, department_name: 'ОТК', decision: 'pending' };
const approvalApproved = { id: 101, department: 6, department_name: 'Снаб', decision: 'approved', reviewed_by_name: 'Иванов' };

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms() });
});

describe('ProductStages — рендер и разворачивание', () => {
    it('рендерит стадии с литерой/статусом', () => {
        render(<ProductStages stages={[stage1, stage2]} productId={1} onStageChange={vi.fn()} />);
        expect(screen.getByText('Лит.А')).toBeInTheDocument();
        expect(screen.getByText('Опытная')).toBeInTheDocument();
        expect(screen.getByText('Черновик')).toBeInTheDocument();
        expect(screen.getByText('Активна')).toBeInTheDocument();
    });

    it('первое разворачивание грузит getApprovals, повторное — нет', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);

        await user.click(screen.getByText('Лит.А'));
        await waitFor(() => expect(plmApi.getApprovals).toHaveBeenCalledWith(1));
        expect(await screen.findByText('ОТК')).toBeInTheDocument();

        await user.click(screen.getByText('Лит.А')); // свернуть
        await user.click(screen.getByText('Лит.А')); // развернуть снова
        expect(plmApi.getApprovals).toHaveBeenCalledTimes(1);
    });

    it('пустой список согласований для draft — "ещё не отправлена"', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        expect(await screen.findByText('Стадия ещё не отправлена на согласование')).toBeInTheDocument();
    });

    it('рендерит иконки/цвета согласований по decision', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending, approvalApproved]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        expect(await screen.findByText('ОТК')).toBeInTheDocument();
        expect(screen.getByText('Снаб')).toBeInTheDocument();
        expect(screen.getByText('— Иванов')).toBeInTheDocument();
    });
});

describe('ProductStages — права на согласование', () => {
    it('без plm.stage.manage — кнопок Одобрить/Отклонить нет', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        await screen.findByText('ОТК');
        expect(screen.queryByText('Одобрить')).not.toBeInTheDocument();
        expect(screen.queryByText('Отклонить')).not.toBeInTheDocument();
    });

    it('с plm.stage.manage — кнопки видны только для pending', async () => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending, approvalApproved]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        await screen.findByText('ОТК');
        expect(screen.getAllByText('Одобрить')).toHaveLength(1);
        expect(screen.getAllByText('Отклонить')).toHaveLength(1);
    });
});

describe('ProductStages — Одобрить/Отклонить', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
    });

    it('Одобрить: обновляет approvals и вызывает onStageChange с новыми стадиями', async () => {
        const user = userEvent.setup();
        const onStageChange = vi.fn();
        plmApi.getApprovals
            .mockResolvedValueOnce(ok([approvalPending]))
            .mockResolvedValueOnce(ok([{ ...approvalPending, decision: 'approved' }]));
        plmApi.approve.mockResolvedValue(ok({}));
        plmApi.getStages.mockResolvedValue(ok([{ ...stage1, status: 'active' }]));

        render(<ProductStages stages={[stage1]} productId={1} onStageChange={onStageChange} />);
        await user.click(screen.getByText('Лит.А'));
        await screen.findByText('Одобрить');
        await user.click(screen.getByText('Одобрить'));

        await waitFor(() => expect(plmApi.approve).toHaveBeenCalledWith(1, 5, ''));
        await waitFor(() => expect(plmApi.getStages).toHaveBeenCalledWith(1));
        expect(onStageChange).toHaveBeenCalledWith([{ ...stage1, status: 'active' }]);
    });

    it('Отклонить: запрашивает причину через prompt, отмена (null) — no-op', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'prompt').mockReturnValue(null);
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending]));
        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        await user.click(await screen.findByText('Отклонить'));

        expect(window.prompt).toHaveBeenCalled();
        expect(plmApi.reject).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('Отклонить с причиной вызывает plmApi.reject и обновляет стадии', async () => {
        const user = userEvent.setup();
        const onStageChange = vi.fn();
        vi.spyOn(window, 'prompt').mockReturnValue('Не соответствует ТУ');
        plmApi.getApprovals
            .mockResolvedValueOnce(ok([approvalPending]))
            .mockResolvedValueOnce(ok([{ ...approvalPending, decision: 'rejected' }]));
        plmApi.reject.mockResolvedValue(ok({}));
        plmApi.getStages.mockResolvedValue(ok([stage1]));

        render(<ProductStages stages={[stage1]} productId={1} onStageChange={onStageChange} />);
        await user.click(screen.getByText('Лит.А'));
        await user.click(await screen.findByText('Отклонить'));

        await waitFor(() => expect(plmApi.reject).toHaveBeenCalledWith(1, 5, 'Не соответствует ТУ'));
        expect(onStageChange).toHaveBeenCalledWith([stage1]);
        vi.restoreAllMocks();
    });

    it('ошибка API при одобрении показывает actionError', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([approvalPending]));
        plmApi.approve.mockResolvedValue({ ok: false, data: { success: false, error: 'Нет прав' } });

        render(<ProductStages stages={[stage1]} productId={1} onStageChange={vi.fn()} />);
        await user.click(screen.getByText('Лит.А'));
        await user.click(await screen.findByText('Одобрить'));

        expect(await screen.findByText('Нет прав')).toBeInTheDocument();
    });
});
