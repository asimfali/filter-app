import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocTypeSelector from '../DocTypeSelector';

const dt1 = { code: 'passport', name: 'Паспорт' };
const dt2 = { code: 'cert', name: 'Сертификат' };

describe('DocTypeSelector', () => {
    it('не рендерится при пустом docTypes', () => {
        const { container } = render(<DocTypeSelector docTypes={[]} activeDocType={null} onSelect={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('рендерит кнопки типов и hint', () => {
        render(<DocTypeSelector docTypes={[dt1, dt2]} activeDocType={dt1} onSelect={vi.fn()} hint="Тип документа:" />);
        expect(screen.getByText('Тип документа:')).toBeInTheDocument();
        expect(screen.getByText('Паспорт')).toBeInTheDocument();
        expect(screen.getByText('Сертификат')).toBeInTheDocument();
    });

    it('подсвечивает активный тип по code', () => {
        render(<DocTypeSelector docTypes={[dt1, dt2]} activeDocType={dt2} onSelect={vi.fn()} />);
        expect(screen.getByText('Паспорт')).toHaveClass('bg-neutral-100');
        expect(screen.getByText('Сертификат')).toHaveClass('bg-emerald-600');
    });

    it('клик по типу вызывает onSelect(dt)', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<DocTypeSelector docTypes={[dt1, dt2]} activeDocType={null} onSelect={onSelect} />);
        await user.click(screen.getByText('Сертификат'));
        expect(onSelect).toHaveBeenCalledWith(dt2);
    });
});
