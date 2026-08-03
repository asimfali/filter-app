import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationReport from '../ValidationReport';

describe('ValidationReport', () => {
  it('null result — ничего не рендерит', () => {
    const { container } = render(<ValidationReport result={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is_valid:true — зелёный баннер "Проверка пройдена"', () => {
    render(<ValidationReport result={{ is_valid: true }} />);
    expect(screen.getByText('✓ Проверка пройдена')).toBeInTheDocument();
  });

  it('success:true (альтернативный флаг) тоже считается успехом', () => {
    render(<ValidationReport result={{ success: true }} />);
    expect(screen.getByText('✓ Проверка пройдена')).toBeInTheDocument();
  });

  it('неуспех без errors/error показывает "Найдено ошибок: 0"', () => {
    render(<ValidationReport result={{ is_valid: false }} />);
    expect(screen.getByText('✗ Найдено ошибок: 0')).toBeInTheDocument();
  });

  it('строковая ошибка (result.error) считается за одну ошибку и рендерится текстом', () => {
    render(<ValidationReport result={{ is_valid: false, error: 'Сервис 1С недоступен' }} />);
    expect(screen.getByText('✗ Найдено ошибок: 1')).toBeInTheDocument();
    expect(screen.getByText('Сервис 1С недоступен')).toBeInTheDocument();
  });

  it('errors[] — счётчик по длине массива, каждая с part_name (если есть) и message', () => {
    render(
      <ValidationReport result={{
        is_valid: false,
        errors: [{ part_name: 'Панель А', message: 'Нет материала' }, { message: 'Общая ошибка' }],
      }} />
    );
    expect(screen.getByText('✗ Найдено ошибок: 2')).toBeInTheDocument();
    expect(screen.getByText('Панель А:')).toBeInTheDocument();
    expect(screen.getByText('Нет материала')).toBeInTheDocument();
    expect(screen.getByText('Общая ошибка')).toBeInTheDocument();
  });

  it('warnings[] рендерятся с ⚠-префиксом, независимо от успеха/неуспеха', () => {
    render(
      <ValidationReport result={{ is_valid: true, warnings: [{ message: 'Проверьте вес' }] }} />
    );
    expect(screen.getByText('Проверьте вес')).toBeInTheDocument();
  });

  it('не-массив errors/warnings в data не ломает рендер (трактуется как пусто)', () => {
    render(<ValidationReport result={{ is_valid: false, errors: 'oops', warnings: null }} />);
    expect(screen.getByText('✗ Найдено ошибок: 0')).toBeInTheDocument();
  });
});
