import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateFilterModal from '../CreateFilterModal';
import { mediaApi } from '../../../api/media';

vi.mock('../../../api/media', () => ({
    mediaApi: {
        getFilters: vi.fn(),
        getAxisValues: vi.fn(),
        addFilterToDocument: vi.fn(),
        addFilterToHeatExchanger: vi.fn(),
        addFilterToAccessoryKit: vi.fn(),
        createFilter: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data: { success: true, ...data } });

const axis1 = { id: 1, name: 'Серия' };
const axis2 = { id: 2, name: 'Тип' };
const existingFilter = { id: 5, axis: { name: 'Серия' }, values: [{ value: '200' }] };
const otherFilter = { id: 6, axis: { name: 'Тип' }, values: [{ value: 'A' }] };

beforeEach(() => {
    vi.clearAllMocks();
    mediaApi.getFilters.mockResolvedValue(ok({ filters: [existingFilter, otherFilter] }));
});

describe('CreateFilterModal — режим "существующие"', () => {
    it('loading -> группировка по оси', async () => {
        render(<CreateFilterModal docId={1} axes={[axis1, axis2]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        expect(await screen.findByText('Серия')).toBeInTheDocument();
        expect(screen.getByText('Тип')).toBeInTheDocument();
        expect(screen.getByText('[200]')).toBeInTheDocument();
    });

    it('пусто -> предлагает создать первый (переключает в режим "новый")', async () => {
        const user = userEvent.setup();
        mediaApi.getFilters.mockResolvedValue(ok({ filters: [] }));
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(await screen.findByText('Создать первый'));
        expect(screen.getByText('Выберите ось параметра')).toBeInTheDocument();
    });

    it('уже привязанный фильтр — disabled с пометкой', async () => {
        const user = userEvent.setup();
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[5]} onCreated={vi.fn()} onClose={vi.fn()} />);
        const btn = await screen.findByText('[200]');
        expect(screen.getByText('уже добавлен')).toBeInTheDocument();
        await user.click(btn.closest('button'));
        expect(mediaApi.addFilterToDocument).not.toHaveBeenCalled();
    });

    it('привязка успех вызывает onCreated(filter)', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn();
        mediaApi.addFilterToDocument.mockResolvedValue(ok({}));
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[]} onCreated={onCreated} onClose={vi.fn()} />);
        await user.click(await screen.findByText('[200]'));
        await waitFor(() => expect(mediaApi.addFilterToDocument).toHaveBeenCalledWith(1, 5));
        expect(onCreated).toHaveBeenCalledWith(existingFilter);
    });

    it('привязка ошибка показывает сообщение', async () => {
        const user = userEvent.setup();
        mediaApi.addFilterToDocument.mockResolvedValue({ ok: false, data: { success: false, error: 'Уже привязан к другому' } });
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(await screen.findByText('[200]'));
        expect(await screen.findByText('Уже привязан к другому')).toBeInTheDocument();
    });

    it('привязка к heat-exchanger/accessory-kit использует правильный API-метод', async () => {
        const user = userEvent.setup();
        mediaApi.addFilterToHeatExchanger.mockResolvedValue(ok({}));
        render(<CreateFilterModal heId={9} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(await screen.findByText('[200]'));
        await waitFor(() => expect(mediaApi.addFilterToHeatExchanger).toHaveBeenCalledWith(9, 5));
    });
});

describe('CreateFilterModal — режим "новый"', () => {
    async function gotoNewMode(user) {
        render(<CreateFilterModal docId={1} axes={[axis1, axis2]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await screen.findByText('Серия'); // дождаться загрузки существующих
        await user.click(screen.getByText('+ Создать новый'));
    }

    it('шаг 1: выбор оси переходит к значениям, грузит getAxisValues', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }, { id: 101, value: '250' }] }));
        await gotoNewMode(user);
        expect(screen.getByText('Выберите ось параметра')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        expect(mediaApi.getAxisValues).toHaveBeenCalledWith(1);
        expect(await screen.findByText('200')).toBeInTheDocument();
        expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('"← Назад" возвращает к выбору оси', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }] }));
        await gotoNewMode(user);
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await screen.findByText('200');
        await user.click(screen.getByText('← Назад'));
        expect(screen.getByText('Выберите ось параметра')).toBeInTheDocument();
    });

    it('toggle значений, счётчик выбранных, disabled без выбора', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }, { id: 101, value: '250' }] }));
        await gotoNewMode(user);
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await screen.findByText('200');

        expect(screen.getByText('Создать фильтр')).toBeDisabled();
        await user.click(screen.getByText('200'));
        expect(screen.getByText('Выбрано: 1')).toBeInTheDocument();
        expect(screen.getByText('Создать фильтр')).not.toBeDisabled();
        await user.click(screen.getByText('200'));
        expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument();
    });

    it('создание+привязка успех вызывает onCreated, payload соответствует heId/kitId/docId', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }] }));
        mediaApi.createFilter.mockResolvedValue(ok({ filter: { id: 50, axis: axis1, values: [{ value: '200' }] } }));
        mediaApi.addFilterToDocument.mockResolvedValue(ok({}));
        render(<CreateFilterModal docId={3} axes={[axis1]} currentFilterIds={[]} onCreated={onCreated} onClose={vi.fn()} />);
        await user.click(screen.getByText('+ Создать новый'));
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await user.click(await screen.findByText('200'));
        await user.click(screen.getByText('Создать фильтр'));

        await waitFor(() => expect(mediaApi.createFilter).toHaveBeenCalledWith(1, [100], false));
        await waitFor(() => expect(mediaApi.addFilterToDocument).toHaveBeenCalledWith(3, 50));
        expect(onCreated).toHaveBeenCalledWith({ id: 50, axis: axis1, values: [{ value: '200' }] });
    });

    it('isExclude чекбокс передаётся в createFilter', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }] }));
        mediaApi.createFilter.mockResolvedValue(ok({ filter: { id: 50, axis: axis1, values: [] } }));
        mediaApi.addFilterToDocument.mockResolvedValue(ok({}));
        render(<CreateFilterModal docId={3} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(screen.getByText('+ Создать новый'));
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await user.click(await screen.findByText('200'));
        await user.click(screen.getByLabelText(/Исключающий фильтр/));
        await user.click(screen.getByText('Создать фильтр'));
        await waitFor(() => expect(mediaApi.createFilter).toHaveBeenCalledWith(1, [100], true));
    });

    it('ошибка создания останавливает до привязки', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }] }));
        mediaApi.createFilter.mockResolvedValue({ ok: false, data: { success: false, error: 'Такой фильтр уже есть' } });
        render(<CreateFilterModal docId={3} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(screen.getByText('+ Создать новый'));
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await user.click(await screen.findByText('200'));
        await user.click(screen.getByText('Создать фильтр'));

        expect(await screen.findByText('Такой фильтр уже есть')).toBeInTheDocument();
        expect(mediaApi.addFilterToDocument).not.toHaveBeenCalled();
    });

    it('ошибка привязки после успешного создания показывает сообщение', async () => {
        const user = userEvent.setup();
        mediaApi.getAxisValues.mockResolvedValue(ok({ values: [{ id: 100, value: '200' }] }));
        mediaApi.createFilter.mockResolvedValue(ok({ filter: { id: 50, axis: axis1, values: [] } }));
        mediaApi.addFilterToDocument.mockResolvedValue({ ok: false, data: { success: false, error: 'Ошибка привязки X' } });
        render(<CreateFilterModal docId={3} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.click(screen.getByText('+ Создать новый'));
        await user.click(screen.getByRole('button', { name: 'Серия' }));
        await user.click(await screen.findByText('200'));
        await user.click(screen.getByText('Создать фильтр'));

        expect(await screen.findByText('Ошибка привязки X')).toBeInTheDocument();
    });
});

describe('CreateFilterModal — закрытие', () => {
    it('клик по фону закрывает, клик по контенту — нет', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={onClose} />);
        await screen.findByText('Добавить фильтр');
        await user.click(screen.getByText('Добавить фильтр'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Добавить фильтр').closest('.fixed'));
        expect(onClose).toHaveBeenCalled();
    });

    it('× закрывает модалку', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<CreateFilterModal docId={1} axes={[axis1]} currentFilterIds={[]} onCreated={vi.fn()} onClose={onClose} />);
        await screen.findByText('Добавить фильтр');
        await user.click(screen.getByText('×'));
        expect(onClose).toHaveBeenCalled();
    });
});
