import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useColumnPrefs } from '../useColumnPrefs';
import { authApi } from '../../api/auth';

vi.mock('../../api/auth', () => ({
  authApi: {
    getPreferences: vi.fn(),
    saveColumnPrefs: vi.fn(),
  },
}));

const axes = [{ id: 1, name: 'Power' }, { id: 2, name: 'Voltage' }];
const defs = [{ id: 10, display_name: 'Weight' }];
const docTypes = [{ code: 'passport', name: 'Паспорт' }];

const simplify = (columns) => columns.map(({ type, id, visible, order }) => ({ type, id, visible, order }));

beforeEach(() => {
  vi.clearAllMocks();
  authApi.saveColumnPrefs.mockResolvedValue({ ok: true, data: {} });
});

describe('useColumnPrefs', () => {
  it('с пустыми осями/спеками/типами документов не запрашивает preferences', () => {
    const { result } = renderHook(() => useColumnPrefs('products', [], [], []));

    expect(result.current.columns).toEqual([]);
    expect(result.current.loaded).toBe(false);
    expect(authApi.getPreferences).not.toHaveBeenCalled();
  });

  it('без сохранённых prefs для этой таблицы использует порядок по умолчанию', async () => {
    authApi.getPreferences.mockResolvedValue({
      ok: true,
      data: { success: true, data: { table_column_prefs: {} } },
    });

    const { result } = renderHook(() => useColumnPrefs('products', axes, defs, docTypes));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(simplify(result.current.columns)).toEqual([
      { type: 'axis', id: '1', visible: true, order: 0 },
      { type: 'axis', id: '2', visible: true, order: 1 },
      { type: 'spec', id: '10', visible: true, order: 2 },
      { type: 'docs', id: 'passport', visible: true, order: 3 },
    ]);
  });

  it('применяет сохранённые prefs: реордер, скрытие и добавление новых колонок в конец', async () => {
    authApi.getPreferences.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        data: {
          table_column_prefs: {
            products: {
              columns: [
                { type: 'docs', id: 'passport', visible: true, order: 0 },
                { type: 'axis', id: '2', visible: false, order: 1 },
                { type: 'axis', id: '1', visible: true, order: 2 },
                // 'spec:10' намеренно отсутствует — новая колонка, должна уйти в конец
              ],
            },
          },
        },
      },
    });

    const { result } = renderHook(() => useColumnPrefs('products', axes, defs, docTypes));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(simplify(result.current.columns)).toEqual([
      { type: 'docs', id: 'passport', visible: true, order: 0 },
      { type: 'axis', id: '2', visible: false, order: 1 },
      { type: 'axis', id: '1', visible: true, order: 2 },
      { type: 'spec', id: '10', visible: true, order: 3 },
    ]);
  });

  it('при неудачном getPreferences откатывается на порядок по умолчанию, но всё равно помечает loaded', async () => {
    authApi.getPreferences.mockResolvedValue({ ok: false, data: {} });

    const { result } = renderHook(() => useColumnPrefs('products', axes, defs, docTypes));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(simplify(result.current.columns)).toEqual([
      { type: 'axis', id: '1', visible: true, order: 0 },
      { type: 'axis', id: '2', visible: true, order: 1 },
      { type: 'spec', id: '10', visible: true, order: 2 },
      { type: 'docs', id: 'passport', visible: true, order: 3 },
    ]);
  });

  it('toggle() инвертирует видимость колонки и сохраняет весь список через saveColumnPrefs', async () => {
    authApi.getPreferences.mockResolvedValue({
      ok: true,
      data: { success: true, data: { table_column_prefs: {} } },
    });
    const { result } = renderHook(() => useColumnPrefs('products', axes, defs, docTypes));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    result.current.toggle('axis', '1');

    await waitFor(() =>
      expect(result.current.columns.find((c) => c.type === 'axis' && c.id === '1').visible).toBe(false)
    );
    expect(authApi.saveColumnPrefs).toHaveBeenCalledWith('products', result.current.columns);
    // остальные колонки не задеты
    expect(result.current.columns.find((c) => c.type === 'axis' && c.id === '2').visible).toBe(true);
  });

  it('reorder() перемещает колонку и переиндексирует order 0..n-1, сохраняя через saveColumnPrefs', async () => {
    authApi.getPreferences.mockResolvedValue({
      ok: true,
      data: { success: true, data: { table_column_prefs: {} } },
    });
    const { result } = renderHook(() => useColumnPrefs('products', axes, defs, docTypes));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // было: axis:1(0) axis:2(1) spec:10(2) docs:passport(3) — переносим последнюю колонку в начало
    result.current.reorder(3, 0);

    await waitFor(() =>
      expect(simplify(result.current.columns)).toEqual([
        { type: 'docs', id: 'passport', visible: true, order: 0 },
        { type: 'axis', id: '1', visible: true, order: 1 },
        { type: 'axis', id: '2', visible: true, order: 2 },
        { type: 'spec', id: '10', visible: true, order: 3 },
      ])
    );
    expect(authApi.saveColumnPrefs).toHaveBeenCalledWith('products', result.current.columns);
  });

  it('пересчитывает колонки только при изменении длины входных массивов, не их содержимого', async () => {
    authApi.getPreferences.mockResolvedValue({
      ok: true,
      data: { success: true, data: { table_column_prefs: {} } },
    });
    const { result, rerender } = renderHook(
      ({ axes: a }) => useColumnPrefs('products', a, defs, docTypes),
      { initialProps: { axes } }
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(authApi.getPreferences).toHaveBeenCalledTimes(1);

    // та же длина, другое содержимое (переименована ось) — эффекты завязаны на .length, не пересчитываются
    const renamedAxes = [{ id: 1, name: 'Мощность' }, { id: 2, name: 'Voltage' }];
    rerender({ axes: renamedAxes });

    expect(authApi.getPreferences).toHaveBeenCalledTimes(1);
    expect(result.current.columns.find((c) => c.type === 'axis' && c.id === '1').label).toBe('Power');
  });
});
