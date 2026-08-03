import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FiltersPanel from '../FiltersPanel';
import { mediaApi } from '../../../api/media';

vi.mock('../../../api/media', () => ({
    mediaApi: {
        removeFilterFromDocument: vi.fn(),
        removeFilterFromHeatExchanger: vi.fn(),
        removeFilterFromAccessoryKit: vi.fn(),
    },
}));
vi.mock('../CreateFilterModal', () => ({
    default: ({ docId, heId, kitId, currentFilterIds, onCreated, onClose }) => (
        <div data-testid="create-filter-modal-stub"
            data-doc-id={docId ?? ''} data-he-id={heId ?? ''} data-kit-id={kitId ?? ''}
            data-current-ids={JSON.stringify(currentFilterIds)}>
            <button onClick={() => onCreated({ id: 99, axis: { name: 'Серия' }, values: [{ value: 'ВО' }], is_exclude: false })}>
                create-filter
            </button>
            <button onClick={onClose}>close-create-filter</button>
        </div>
    ),
}));

const axis1 = { id: 1, name: 'Серия' };
const filter1 = { id: 10, axis: { name: 'Серия' }, values: [{ value: '200' }], is_exclude: false };
const filter2 = { id: 11, axis: { name: 'Тип' }, values: [{ value: 'A' }, { value: 'B' }], is_exclude: true };

describe('FiltersPanel — рендер по entityType', () => {
    it('document: пустые фильтры показывают подсказку', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={1} entityType="document" initialFilters={[]} axes={[axis1]} canWrite={false} />);
        expect(screen.getByText('Фильтры не заданы')).toBeInTheDocument();
        await user.click(screen.getByTitle('Управление фильтрами'));
        expect(screen.getByText('Документ без фильтров не показывается в карточке товара')).toBeInTheDocument();
    });

    it('heat-exchanger: другой hint-текст', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={1} entityType="heat-exchanger" initialFilters={[]} axes={[axis1]} canWrite={false} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        expect(screen.getByText('Без фильтров теплообменник не привязан ни к одному изделию')).toBeInTheDocument();
    });

    it('рендерит фильтры: обычный (∈, синий) и исключающий (≠, красный)', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={1} entityType="document" initialFilters={[filter1, filter2]} axes={[axis1]} canWrite={false} />);
        expect(screen.getByText('Серия:')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        await user.click(screen.getByTitle('Управление фильтрами'));
        expect(screen.getByText('∈')).toBeInTheDocument();
        expect(screen.getAllByText('≠').length).toBe(2); // заголовок (тег фильтра) + строка в панели
        expect(screen.getByText('[A, B]')).toBeInTheDocument();
    });
});

describe('FiltersPanel — canWrite=false', () => {
    it('скрывает удаление и "+ Добавить фильтр"', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={1} entityType="document" initialFilters={[filter1]} axes={[axis1]} canWrite={false} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        expect(screen.queryByText('×')).not.toBeInTheDocument();
        expect(screen.queryByText('+ Добавить фильтр')).not.toBeInTheDocument();
    });
});

describe('FiltersPanel — canWrite=true', () => {
    it('удаление фильтра вызывает removeFilterFromDocument и убирает из списка', async () => {
        const user = userEvent.setup();
        mediaApi.removeFilterFromDocument.mockResolvedValue({ ok: true });
        render(<FiltersPanel entityId={5} entityType="document" initialFilters={[filter1]} axes={[axis1]} canWrite={true} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        await user.click(screen.getByText('×'));
        await waitFor(() => expect(mediaApi.removeFilterFromDocument).toHaveBeenCalledWith(5, 10));
        expect(screen.queryByText('Серия')).not.toBeInTheDocument();
    });

    it('удаление для heat-exchanger/accessory-kit вызывает нужный removeFilterFrom...', async () => {
        const user = userEvent.setup();
        mediaApi.removeFilterFromAccessoryKit.mockResolvedValue({ ok: true });
        render(<FiltersPanel entityId={7} entityType="accessory-kit" initialFilters={[filter1]} axes={[axis1]} canWrite={true} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        await user.click(screen.getByText('×'));
        await waitFor(() => expect(mediaApi.removeFilterFromAccessoryKit).toHaveBeenCalledWith(7, 10));
    });

    it('"+ Добавить фильтр" открывает CreateFilterModal с правильными id/currentFilterIds', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={5} entityType="document" initialFilters={[filter1]} axes={[axis1]} canWrite={true} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        await user.click(screen.getByText('+ Добавить фильтр'));

        const stub = screen.getByTestId('create-filter-modal-stub');
        expect(stub.dataset.docId).toBe('5');
        expect(stub.dataset.heId).toBe('');
        expect(stub.dataset.currentIds).toBe(JSON.stringify([10]));
    });

    it('передаёт heId/kitId вместо docId в зависимости от entityType', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={9} entityType="heat-exchanger" initialFilters={[]} axes={[axis1]} canWrite={true} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        await user.click(screen.getByText('+ Добавить фильтр'));
        const stub = screen.getByTestId('create-filter-modal-stub');
        expect(stub.dataset.heId).toBe('9');
        expect(stub.dataset.docId).toBe('');
    });

    it('onCreated добавляет фильтр в список и закрывает модалку', async () => {
        const user = userEvent.setup();
        render(<FiltersPanel entityId={5} entityType="document" initialFilters={[]} axes={[axis1]} canWrite={true} />);
        await user.click(screen.getByTitle('Управление фильтрами'));
        await user.click(screen.getByText('+ Добавить фильтр'));
        await user.click(screen.getByText('create-filter'));

        expect(screen.queryByTestId('create-filter-modal-stub')).not.toBeInTheDocument();
        expect(screen.getByText('ВО')).toBeInTheDocument();
    });
});
