import { useRef, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dropdown from '../Dropdown';

const items = [{ id: 1, label: 'Опция 1' }, { id: 2, label: 'Опция 2' }];

function Harness({ initialItems = [], onSelect = () => {}, anchored = true }) {
  const anchorRef = useRef(null);
  const [visibleItems, setVisibleItems] = useState(initialItems);
  return (
    <div>
      <input ref={anchored ? anchorRef : undefined} data-testid="anchor" />
      <button onClick={() => setVisibleItems(items)}>show</button>
      <button onClick={() => setVisibleItems([])}>hide</button>
      <Dropdown
        anchorRef={anchorRef}
        items={visibleItems}
        onSelect={onSelect}
        renderItem={(item) => item.label}
      />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  delete HTMLElement.prototype.offsetHeight;
});

describe('Dropdown', () => {
  it('renders nothing when items is empty', () => {
    render(<Harness initialItems={[]} />);
    expect(document.querySelector('[data-dropdown="true"]')).toBeNull();
  });

  it('renders items into a portal under document.body', () => {
    render(<Harness initialItems={items} />);

    const dropdown = document.querySelector('[data-dropdown="true"]');
    expect(dropdown).not.toBeNull();
    expect(dropdown.parentElement).toBe(document.body);
    expect(screen.getByText('Опция 1')).toBeInTheDocument();
    expect(screen.getByText('Опция 2')).toBeInTheDocument();
  });

  it('selecting an item calls onSelect via mousedown (preventing default)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness initialItems={items} onSelect={onSelect} />);

    await user.click(screen.getByText('Опция 2'));

    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('positions below the anchor by default (enough space below in jsdom)', () => {
    render(<Harness initialItems={items} />);

    const dropdown = document.querySelector('[data-dropdown="true"]');
    expect(dropdown.style.position).toBe('fixed');
    expect(dropdown.style.opacity).toBe('1');
    // jsdom-геометрия анкора нулевая: anchorRect.bottom(0) + 4
    expect(dropdown.style.top).toBe('4px');
  });

  it('flips above the anchor when there is not enough space below', () => {
    const onSelect = vi.fn();
    render(<Harness initialItems={[]} onSelect={onSelect} />);

    const anchor = screen.getByTestId('anchor');
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 700, bottom: 730, left: 10, width: 200, height: 30, right: 210, x: 10, y: 700, toJSON() {},
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768); // spaceBelow = 38
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 200 });

    fireEvent.click(screen.getByText('show'));

    const dropdown = document.querySelector('[data-dropdown="true"]');
    expect(dropdown.style.top).toBe('496px'); // 700 - 200 - 4
    expect(dropdown.style.left).toBe('10px');
    expect(dropdown.style.width).toBe('200px');
  });

  it('stays hidden (opacity 0) and does not crash when the anchor is not mounted', () => {
    render(<Harness initialItems={items} anchored={false} />);

    const dropdown = document.querySelector('[data-dropdown="true"]');
    expect(dropdown).not.toBeNull();
    expect(dropdown.style.opacity).toBe('0');
  });
});
