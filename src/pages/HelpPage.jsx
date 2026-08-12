import { useMemo, useState } from 'react';
import { renderMarkdown, extractTitle } from '../utils/markdown.jsx';

// md-файлы справки лежат в src/content/help — подключаются как есть, сборкой,
// порядок в меню задаётся числовым префиксом имени файла (01-..., 02-...).
const files = import.meta.glob('../content/help/*.md', { query: '?raw', import: 'default', eager: true });

export function buildTopics(filesMap) {
  return Object.entries(filesMap)
    .map(([path, content]) => ({
      slug: path.split('/').pop().replace(/\.md$/, ''),
      title: extractTitle(content, path),
      content,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const defaultTopics = buildTopics(files);

// topics — только для тестов (подмена набора статей без реальных md-файлов).
export default function HelpPage({ topics = defaultTopics } = {}) {
  const [activeSlug, setActiveSlug] = useState(topics[0]?.slug);
  const active = useMemo(() => topics.find(t => t.slug === activeSlug) ?? topics[0], [activeSlug]);

  // Переход по ссылке [text](help:slug) внутри статьи или клику по сайдбару —
  // сбрасываем скролл, иначе после перехода из середины длинной статьи
  // читатель окажется в середине следующей.
  const goToTopic = (slug) => {
    if (!topics.some(t => t.slug === slug)) return;
    setActiveSlug(slug);
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (topics.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center
                      text-gray-400 dark:text-gray-500 text-sm">
        Статей справки пока нет.
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      <nav className="w-64 shrink-0 bg-white dark:bg-neutral-900 rounded-lg shadow p-2 sticky top-4">
        {topics.map(t => (
          <button
            key={t.slug}
            onClick={() => goToTopic(t.slug)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
              ${t.slug === active?.slug
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}>
            {t.title}
          </button>
        ))}
      </nav>

      <article className="flex-1 min-w-0 bg-white dark:bg-neutral-900 rounded-lg shadow px-6 py-5">
        {active && renderMarkdown(active.content, { onNavigate: goToTopic })}
      </article>
    </div>
  );
}
