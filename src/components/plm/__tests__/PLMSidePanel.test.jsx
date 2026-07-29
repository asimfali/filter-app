import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PLMSidePanel from '../PLMSidePanel';
import { plmApi } from '../../../api/plm';
import { authApi } from '../../../api/auth';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../api/plm', () => ({
    plmApi: {
        getStages: vi.fn(),
        getPresets: vi.fn(),
        getApprovals: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        promote: vi.fn(),
        rollback: vi.fn(),
        batchSubmit: vi.fn(),
        batchPromote: vi.fn(),
        batchRollback: vi.fn(),
        batchApprove: vi.fn(),
    },
}));
vi.mock('../../../api/auth', () => ({ authApi: { departments: vi.fn() } }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../BatchCreateForm', () => ({
    default: ({ productIds, onCreated, onCancel }) => (
        <div data-testid="batch-create-form-stub" data-product-ids={JSON.stringify(productIds)}>
            <button onClick={() => onCreated({ id: 1 })}>create-group</button>
            <button onClick={onCancel}>cancel-create</button>
        </div>
    ),
}));
vi.mock('../StageTransferPanel', () => ({
    default: ({ stage, onDone, onClose }) => (
        <div data-testid="stage-transfer-panel-stub" data-stage-id={stage.id}>
            <button onClick={() => onDone(3)}>transfer-done</button>
            <button onClick={onClose}>transfer-close</button>
        </div>
    ),
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const stageDraft = { id: 11, litera_code: 'А', litera_name: 'Опытная', status: 'draft' };
const stagePending = { id: 12, litera_code: 'Б', litera_name: 'Серийная', status: 'pending_approval' };
const stageActive = { id: 13, litera_code: 'В', litera_name: 'Финальная', status: 'active' };

const products = [{ id: 1, name: 'Изделие А' }];

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms() });
    plmApi.getPresets.mockResolvedValue(ok([]));
    authApi.departments.mockResolvedValue({ ok: true, data: [] });
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('PLMSidePanel — загрузка/пустые состояния', () => {
    it('показывает "Загрузка стадий..." пока стадии грузятся', () => {
        plmApi.getStages.mockReturnValue(new Promise(() => {}));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        expect(screen.getByText('Загрузка стадий...')).toBeInTheDocument();
    });

    it('шапка показывает количество изделий, "×" вызывает onClose', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1, 2]} products={products} onClose={onClose} selectedLitera={null} />);
        expect(await screen.findByText('PLM — Стадии (2 изд.)')).toBeInTheDocument();
        await user.click(screen.getByText('×'));
        expect(onClose).toHaveBeenCalled();
    });

    it('без стадий вообще — нет batch-панели', async () => {
        plmApi.getStages.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        await waitFor(() => expect(screen.queryByText('Загрузка стадий...')).not.toBeInTheDocument());
        expect(screen.queryByText('Пакетные действия')).not.toBeInTheDocument();
    });

    it('имя изделия — из products, иначе фолбэк "Изделие #id"', async () => {
        plmApi.getStages.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1, 99]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        expect(await screen.findByText('Изделие А')).toBeInTheDocument();
        expect(screen.getByText('Изделие #99')).toBeInTheDocument();
    });
});

describe('PLMSidePanel — фильтр visibleStages по selectedLitera', () => {
    it('selectedLitera=null — везде "Без литеры" (approvals всё равно грузятся по клику для реальных стадий изделия)', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageDraft]));
        plmApi.getApprovals.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        expect(await screen.findAllByText('Без литеры')).not.toHaveLength(0);
        await user.click(screen.getByText('Изделие А'));
        // toggleStage грузит approvals по РЕАЛЬНОМУ списку stages (не отфильтрованному
        // visibleStages) — сама стадия при этом не показывается, т.к. литера не выбрана
        await waitFor(() => expect(plmApi.getApprovals).toHaveBeenCalledWith(11));
        expect(screen.queryByText('Лит.А — Опытная')).not.toBeInTheDocument();
    });

    it('selectedLitera совпадает по litera_code — показывает бейдж и разворачивает approvals', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageDraft]));
        plmApi.getApprovals.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageDraft} />);
        expect(await screen.findByText('Лит.А')).toBeInTheDocument();
        await user.click(screen.getByText('Изделие А'));
        await waitFor(() => expect(plmApi.getApprovals).toHaveBeenCalledWith(11));
        expect(screen.getByText('Лит.А — Опытная')).toBeInTheDocument();
    });

    it('selectedLitera не совпадает по коду — "Нет стадии"', async () => {
        plmApi.getStages.mockResolvedValue(ok([stageDraft]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        expect(await screen.findByText('Нет стадии')).toBeInTheDocument();
    });
});

describe('PLMSidePanel — действия со стадией (промоут/откат/перенос)', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
        plmApi.getApprovals.mockResolvedValue(ok([]));
    });

    it('кнопки перенос/промоут/откат видны только для active+canManage', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        expect(await screen.findByText('↑ Серийные')).toBeInTheDocument();
        expect(screen.getByText('→ Лит.+1')).toBeInTheDocument();
        expect(screen.getByText('← Откат')).toBeInTheDocument();
    });

    it('без plm.stage.manage — кнопок действий нет даже для active', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        expect(screen.queryByText('↑ Серийные')).not.toBeInTheDocument();
    });

    it('промоут: отмена confirm — no-op; подтверждение → plmApi.promote + reload', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
        plmApi.promote.mockResolvedValue(ok({}));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        await user.click(await screen.findByText('→ Лит.+1'));
        expect(plmApi.promote).not.toHaveBeenCalled();

        await user.click(screen.getByText('→ Лит.+1'));
        await waitFor(() => expect(plmApi.promote).toHaveBeenCalledWith(13));
        await waitFor(() => expect(plmApi.getStages).toHaveBeenCalledTimes(2));
        confirmSpy.mockRestore();
    });

    it('промоут: ошибка API — alert', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        plmApi.promote.mockResolvedValue({ ok: false, data: { success: false, error: 'Нельзя перейти' } });
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        await user.click(await screen.findByText('→ Лит.+1'));
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Нельзя перейти'));
        vi.restoreAllMocks();
    });

    it('откат: confirm-гейт, успех → reload', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        plmApi.rollback.mockResolvedValue(ok({}));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        await user.click(await screen.findByText('← Откат'));
        await waitFor(() => expect(plmApi.rollback).toHaveBeenCalledWith(13));
        await waitFor(() => expect(plmApi.getStages).toHaveBeenCalledTimes(2));
        vi.restoreAllMocks();
    });

    it('"↑ Серийные" переключает строку на StageTransferPanel; onDone/onClose возвращают обратно + reload', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={stageActive} />);
        await screen.findByText('Лит.В');
        await user.click(screen.getByText('Изделие А'));
        await user.click(await screen.findByText('↑ Серийные'));

        const stub = await screen.findByTestId('stage-transfer-panel-stub');
        expect(stub.dataset.stageId).toBe('13');

        await user.click(screen.getByText('transfer-done'));
        await waitFor(() => expect(plmApi.getStages).toHaveBeenCalledTimes(2));
        expect(screen.queryByTestId('stage-transfer-panel-stub')).not.toBeInTheDocument();
    });
});

describe('PLMSidePanel — batch-панель и создание группы', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
    });

    it('batch-панель показывает submit/promote-rollback/approve по статусам, скрыта без стадий', async () => {
        plmApi.getStages.mockImplementation((id) => Promise.resolve(
            ok(id === 1 ? [stageDraft] : id === 2 ? [stagePending] : [stageActive])
        ));
        render(<PLMSidePanel productIds={[1, 2, 3]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        expect(await screen.findByText('Пакетные действия')).toBeInTheDocument();
        expect(screen.getByText('На согласование (1)')).toBeInTheDocument();
        expect(screen.getByText('→ Следующая литера (1)')).toBeInTheDocument();
        expect(screen.getByText('← Откат (1)')).toBeInTheDocument();
        expect(screen.getByText('Выберите отдел').closest('select')).toBeInTheDocument();
    });

    it('batch submit вызывает batchSubmit(draftIds) и показывает результат', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageDraft]));
        plmApi.batchSubmit.mockResolvedValue(ok({ submitted: 1 }));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        await user.click(await screen.findByText('На согласование (1)'));
        await waitFor(() => expect(plmApi.batchSubmit).toHaveBeenCalledWith([11], null));
        expect(await screen.findByText('Отправлено: 1')).toBeInTheDocument();
    });

    it('batch promote: confirm-гейт + результат с учётом skipped', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stageActive]));
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        plmApi.batchPromote.mockResolvedValue(ok({ promoted: 1, skipped: 2 }));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        await user.click(await screen.findByText('→ Следующая литера (1)'));
        await waitFor(() => expect(plmApi.batchPromote).toHaveBeenCalledWith([13]));
        expect(await screen.findByText('Переведено: 1, пропущено: 2')).toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('batch approve: disabled без выбранного отдела, активна после выбора', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([stagePending]));
        authApi.departments.mockResolvedValue({ ok: true, data: [{ id: 9, name: 'ОТК' }] });
        plmApi.batchApprove.mockResolvedValue(ok({ approved: 1 }));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        const approveBtn = await screen.findByText('Одобрить (1)');
        expect(approveBtn).toBeDisabled();

        await user.selectOptions(screen.getByText('Выберите отдел').closest('select'), '9');
        await user.click(approveBtn);
        await waitFor(() => expect(plmApi.batchApprove).toHaveBeenCalledWith([12], 9));
        expect(await screen.findByText('Одобрено: 1')).toBeInTheDocument();
    });

    it('"+ Создать группу стадий" открывает форму (только canManage), onCreated закрывает + reload', async () => {
        const user = userEvent.setup();
        plmApi.getStages.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        await user.click(await screen.findByText('+ Создать группу стадий'));
        const stub = await screen.findByTestId('batch-create-form-stub');
        expect(stub.dataset.productIds).toBe(JSON.stringify([1]));

        await user.click(screen.getByText('create-group'));
        await waitFor(() => expect(plmApi.getStages).toHaveBeenCalledTimes(2));
        expect(screen.queryByTestId('batch-create-form-stub')).not.toBeInTheDocument();
    });

    it('без plm.stage.manage — нет кнопки создания группы', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        plmApi.getStages.mockResolvedValue(ok([]));
        render(<PLMSidePanel productIds={[1]} products={products} onClose={vi.fn()} selectedLitera={null} />);
        await waitFor(() => expect(screen.queryByText('Загрузка стадий...')).not.toBeInTheDocument());
        expect(screen.queryByText('+ Создать группу стадий')).not.toBeInTheDocument();
    });
});
