import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WarningsList from '../WarningsList';

describe('WarningsList', () => {
  it('shows the count and each warning with a "· " prefix', () => {
    render(<WarningsList warnings={['Строка 3: дубликат', 'Строка 7: пустое поле']} />);

    expect(screen.getByText('Предупреждения (2):')).toBeInTheDocument();
    expect(screen.getByText('· Строка 3: дубликат')).toBeInTheDocument();
    expect(screen.getByText('· Строка 7: пустое поле')).toBeInTheDocument();
  });

  it('renders a zero count and no warning lines for an empty list', () => {
    render(<WarningsList warnings={[]} />);

    expect(screen.getByText('Предупреждения (0):')).toBeInTheDocument();
    expect(screen.queryByText(/^·/)).not.toBeInTheDocument();
  });
});
