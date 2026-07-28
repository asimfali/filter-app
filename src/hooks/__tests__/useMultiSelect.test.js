import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '../useMultiSelect';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const evt = (opts = {}) => ({ shiftKey: false, ctrlKey: false, metaKey: false, ...opts });

describe('useMultiSelect', () => {
  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));
    expect(result.current.selected.size).toBe(0);
  });

  it('plain click selects only the clicked item, replacing the previous selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.handleClick(evt(), 'a', 0));
    expect([...result.current.selected]).toEqual(['a']);

    act(() => result.current.handleClick(evt(), 'b', 1));
    expect([...result.current.selected]).toEqual(['b']);
  });

  it('plain click on the sole selected item clears the selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.handleClick(evt(), 'a', 0));
    act(() => result.current.handleClick(evt(), 'a', 0));

    expect(result.current.selected.size).toBe(0);
  });

  it('ctrl/meta click toggles membership without clearing the rest', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.handleClick(evt(), 'a', 0));
    act(() => result.current.handleClick(evt({ ctrlKey: true }), 'b', 1));
    expect(new Set(result.current.selected)).toEqual(new Set(['a', 'b']));

    act(() => result.current.handleClick(evt({ metaKey: true }), 'b', 1));
    expect([...result.current.selected]).toEqual(['a']);
  });

  it('shift click selects the inclusive range since the last click, adding to the selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.handleClick(evt(), 'a', 0)); // lastClickedIdx = 0
    act(() => result.current.handleClick(evt({ shiftKey: true }), 'd', 3));

    expect(new Set(result.current.selected)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('shift click handles a backwards range (last index > current index)', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.handleClick(evt(), 'd', 3)); // lastClickedIdx = 3
    act(() => result.current.handleClick(evt({ shiftKey: true }), 'b', 1));

    expect(new Set(result.current.selected)).toEqual(new Set(['b', 'c', 'd']));
  });

  it('selectAll selects every item; clearAll empties the selection', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.selectAll());
    expect(new Set(result.current.selected)).toEqual(new Set(['a', 'b', 'c', 'd']));

    act(() => result.current.clearAll());
    expect(result.current.selected.size).toBe(0);
  });

  it('toggle() adds/removes a single id regardless of modifier keys', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.toggle('c'));
    expect([...result.current.selected]).toEqual(['c']);

    act(() => result.current.toggle('c'));
    expect(result.current.selected.size).toBe(0);
  });

  it('exposes setSelected for direct control', () => {
    const { result } = renderHook(() => useMultiSelect(items));

    act(() => result.current.setSelected(new Set(['b', 'd'])));
    expect(new Set(result.current.selected)).toEqual(new Set(['b', 'd']));
  });
});
