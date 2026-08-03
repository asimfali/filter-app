import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExcelImport } from '../useExcelImport';

describe('useExcelImport', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useExcelImport(vi.fn()));
    expect(result.current.file).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.warnings).toEqual([]);
  });

  it('handleFile sets the file and clears any previous error/warnings', async () => {
    const onAction = vi.fn().mockResolvedValue({ ok: false, error: 'Плохой файл', warnings: ['w1'] });
    const { result } = renderHook(() => useExcelImport(onAction));

    act(() => result.current.handleFile({ name: 'bad.xlsx' }));
    await act(async () => { await result.current.run(); });
    expect(result.current.error).toBe('Плохой файл');
    expect(result.current.warnings).toEqual(['w1']);

    act(() => result.current.handleFile({ name: 'good.xlsx' }));
    expect(result.current.file).toEqual({ name: 'good.xlsx' });
    expect(result.current.error).toBe('');
    expect(result.current.warnings).toEqual([]);
  });

  it('run() is a no-op when no file is selected', async () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useExcelImport(onAction));

    let returned;
    await act(async () => { returned = await result.current.run(); });

    expect(onAction).not.toHaveBeenCalled();
    expect(returned).toBeUndefined();
  });

  it('run() calls onAction with the file and toggles loading while it is pending', async () => {
    let resolveAction;
    const onAction = vi.fn(() => new Promise((resolve) => { resolveAction = resolve; }));
    const { result } = renderHook(() => useExcelImport(onAction));

    act(() => result.current.handleFile({ name: 'a.xlsx' }));

    let runPromise;
    act(() => { runPromise = result.current.run(); });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(onAction).toHaveBeenCalledWith({ name: 'a.xlsx' });

    await act(async () => {
      resolveAction({ ok: true });
      await runPromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
  });

  it('run() sets the returned error message on failure', async () => {
    const onAction = vi.fn().mockResolvedValue({ ok: false, error: 'Неверный формат столбца B' });
    const { result } = renderHook(() => useExcelImport(onAction));
    act(() => result.current.handleFile({ name: 'a.xlsx' }));

    await act(async () => { await result.current.run(); });

    expect(result.current.error).toBe('Неверный формат столбца B');
  });

  it('run() falls back to a generic error message when the failure has none', async () => {
    const onAction = vi.fn().mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useExcelImport(onAction));
    act(() => result.current.handleFile({ name: 'a.xlsx' }));

    await act(async () => { await result.current.run(); });

    expect(result.current.error).toBe('Ошибка');
  });

  it('run() surfaces warnings even on a successful import', async () => {
    const onAction = vi.fn().mockResolvedValue({ ok: true, warnings: ['Строка 5: дубликат'] });
    const { result } = renderHook(() => useExcelImport(onAction));
    act(() => result.current.handleFile({ name: 'a.xlsx' }));

    await act(async () => { await result.current.run(); });

    expect(result.current.warnings).toEqual(['Строка 5: дубликат']);
    expect(result.current.error).toBe('');
  });

  it('run() returns the resolved result to the caller', async () => {
    const onAction = vi.fn().mockResolvedValue({ ok: true, imported: 12 });
    const { result } = renderHook(() => useExcelImport(onAction));
    act(() => result.current.handleFile({ name: 'a.xlsx' }));

    let returned;
    await act(async () => { returned = await result.current.run(); });

    expect(returned).toEqual({ ok: true, imported: 12 });
  });
});
