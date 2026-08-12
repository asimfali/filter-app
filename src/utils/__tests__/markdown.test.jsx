import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderMarkdown, extractTitle } from '../markdown.jsx';

describe('renderMarkdown', () => {
  it('renders headings of different levels', () => {
    render(<div>{renderMarkdown('# H1\n\n## H2\n\n### H3')}</div>);
    expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'H2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'H3' })).toBeInTheDocument();
  });

  it('renders a paragraph', () => {
    render(<div>{renderMarkdown('Просто абзац текста.')}</div>);
    expect(screen.getByText('Просто абзац текста.')).toBeInTheDocument();
  });

  it('renders inline bold, code and links', () => {
    render(<div>{renderMarkdown('Текст **жирный** и `код` и [ссылка](https://example.com)')}</div>);
    expect(screen.getByText('жирный').tagName).toBe('STRONG');
    expect(screen.getByText('код').tagName).toBe('CODE');
    const link = screen.getByRole('link', { name: 'ссылка' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders an unordered list', () => {
    render(<div>{renderMarkdown('- один\n- два')}</div>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders an ordered list', () => {
    render(<div>{renderMarkdown('1. первый\n2. второй')}</div>);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a code fence as <pre><code>', () => {
    const { container } = render(<div>{renderMarkdown('```\nconst x = 1;\n```')}</div>);
    const pre = container.querySelector('pre code');
    expect(pre).toHaveTextContent('const x = 1;');
  });

  it('renders a blockquote as a note block', () => {
    render(<div>{renderMarkdown('> Важное замечание')}</div>);
    expect(screen.getByText('Важное замечание')).toBeInTheDocument();
  });

  it('keeps a multi-paragraph blockquote as one note, split on the bare ">" line', () => {
    const { container } = render(
      <div>{renderMarkdown('> Первый абзац цитаты.\n>\n> Второй абзац цитаты.')}</div>
    );
    expect(screen.getByText('Первый абзац цитаты.')).toBeInTheDocument();
    expect(screen.getByText('Второй абзац цитаты.')).toBeInTheDocument();
    // Оба абзаца — внутри одного блока-заметки, а не в двух разных
    expect(container.querySelectorAll('.border-l-4')).toHaveLength(1);
  });
});

describe('extractTitle', () => {
  it('extracts the first H1 line', () => {
    expect(extractTitle('# Заголовок статьи\n\nТекст', 'fallback')).toBe('Заголовок статьи');
  });

  it('falls back when there is no H1', () => {
    expect(extractTitle('Просто текст без заголовка', 'fallback')).toBe('fallback');
  });
});
