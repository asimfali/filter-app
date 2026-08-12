import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpPage, { buildTopics } from '../HelpPage';

const topics = buildTopics({
  '../content/help/01-first.md': '# Первая статья\n\nТекст первой статьи.',
  '../content/help/02-second.md': '# Вторая статья\n\nТекст второй статьи.',
});

describe('buildTopics', () => {
  it('sorts by filename and extracts titles from the first H1', () => {
    expect(topics.map(t => t.slug)).toEqual(['01-first', '02-second']);
    expect(topics[0].title).toBe('Первая статья');
    expect(topics[1].title).toBe('Вторая статья');
  });

  it('falls back to the file path when there is no H1', () => {
    const [t] = buildTopics({ '../content/help/03-no-title.md': 'Просто текст' });
    expect(t.title).toBe('../content/help/03-no-title.md');
  });
});

describe('HelpPage', () => {
  it('shows the first topic by default', () => {
    render(<HelpPage topics={topics} />);
    expect(screen.getByText('Текст первой статьи.')).toBeInTheDocument();
    expect(screen.queryByText('Текст второй статьи.')).not.toBeInTheDocument();
  });

  it('switches article content when another topic is picked', async () => {
    const user = userEvent.setup();
    render(<HelpPage topics={topics} />);

    await user.click(screen.getByRole('button', { name: 'Вторая статья' }));

    expect(screen.getByText('Текст второй статьи.')).toBeInTheDocument();
    expect(screen.queryByText('Текст первой статьи.')).not.toBeInTheDocument();
  });

  it('renders a placeholder when there are no topics', () => {
    render(<HelpPage topics={[]} />);
    expect(screen.getByText('Статей справки пока нет.')).toBeInTheDocument();
  });
});
