import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MissingProductsPanel from '../MissingProductsPanel';
import { externalApi } from '../../../api/external';

vi.mock('../../../api/external', () => ({
  externalApi: { missingProducts: vi.fn(), deactivateProducts: vi.fn(), taskStatus: vi.fn() },
}));

const configs = [
  { id: 1, name: 'Папка 1', product_type_slug: 'heaters', product_type_name: 'Тепловентиляторы' },
  { id: 2, name: 'Папка 2', product_type_slug: 'heaters', product_type_name: 'Тепловентиляторы' },
  { id: 3, name: 'Папка 3', product_type_slug: 'curtains', product_type_name: 'Завесы' },
];

const missing = [
  { id: 10, name: 'КЭВ-1', sku: 'A1', external_id: 'e1', is_published: true },
  { id: 11, name: 'КЭВ-2', sku: 'A2', external_id: 'e2', is_published: false },
];

const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

// запуск проверки типа heaters и завершение задачи с заданным результатом
const runCheck = async (result) => {
  externalApi.missingProducts.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { task_id: 't1' } } });
  externalApi.taskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: true, status: 'SUCCESS', result } } });
  render(<MissingProductsPanel configs={configs} />);
  fireEvent.click(screen.getAllByText('Проверить товары не из 1С')[0]);
  await flush();
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('MissingProductsPanel', () => {
  it('группирует папки по типу продукции', () => {
    render(<MissingProductsPanel configs={configs} />);
    // 3 папки → 2 типа, по строке на тип
    expect(screen.getAllByText('Проверить товары не из 1С')).toHaveLength(2);
    expect(screen.getByText('Тепловентиляторы')).toBeTruthy();
    expect(screen.getByText('Завесы')).toBeTruthy();
  });

  it('есть errors → ошибки показаны, кнопки снятия нет', async () => {
    await runCheck({ success: false, configs: [], errors: ['Папка 1: 1С не ответила'], missing: [] });
    expect(externalApi.missingProducts).toHaveBeenCalledWith('heaters');
    expect(screen.getByText('Папка 1: 1С не ответила')).toBeTruthy();
    expect(screen.queryByText(/Снять с активных/)).toBeNull();
  });

  it('отправляются только отмеченные id после подтверждения', async () => {
    await runCheck({ success: true, configs: [{ name: 'Папка 1', count: 5 }], errors: [], missing });
    expect(screen.getByText(/Папок опрошено: 1, товаров в 1С: 5/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('КЭВ-2'));   // снять отметку
    externalApi.deactivateProducts.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { deactivated: 1 } } });
    fireEvent.click(screen.getByText('Снять с активных (1)'));
    expect(externalApi.deactivateProducts).not.toHaveBeenCalled();   // сначала подтверждение
    expect(screen.getByText(/останутся в портале неактивными/)).toBeTruthy();
    fireEvent.click(screen.getByText('Подтвердить'));
    await flush();
    expect(externalApi.deactivateProducts).toHaveBeenCalledWith('heaters', [10]);
    expect(screen.getByText('✓ Снято с активных: 1')).toBeTruthy();
  });
});
