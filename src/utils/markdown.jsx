// Компактный markdown-рендерер под наши собственные md-файлы справки
// (src/content/help) — без внешней библиотеки, т.к. содержимое полностью
// авторское (не пользовательский ввод) и использует ограниченное подмножество
// markdown. Рендерит сразу в React-элементы (без dangerouslySetInnerHTML).
//
// Поддержка: # .. #### заголовки, абзацы, - / * / 1. списки, ```code```,
// > заметки, ---, **bold**, *italic*, `code`, [text](url), ![alt](src).
// Ссылка вида [text](help:slug) — переход на другую статью справки внутри
// HelpPage (не новая вкладка) — см. renderMarkdown(md, { onNavigate }).

function isBlockStart(line) {
  return line.startsWith('```') || /^#{1,4}\s/.test(line) || /^-{3,}$/.test(line.trim())
    || line === '>' || line.startsWith('> ') || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

const HEADING_CLS = {
  h1: 'text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3 first:mt-0',
  h2: 'text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-2',
  h3: 'text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2',
  h4: 'text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1.5',
};

const LINK_CLS = 'text-blue-600 dark:text-blue-400 hover:underline';

// Инлайн-разметка: **bold**, `code`, ![alt](src), [text](url), *italic*
function renderInline(text, opts) {
  const nodes = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<code key={key++} className="bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 text-xs">{match[3]}</code>);
    } else if (match[5] !== undefined) {
      nodes.push(<img key={key++} src={match[5]} alt={match[4]}
        className="rounded-lg border border-gray-200 dark:border-gray-700 my-2 max-w-full" />);
    } else if (match[7] !== undefined) {
      const href = match[7];
      if (href.startsWith('help:')) {
        const slug = href.slice('help:'.length);
        nodes.push(
          <a key={key++} href="#" className={LINK_CLS}
            onClick={e => { e.preventDefault(); opts?.onNavigate?.(slug); }}>
            {match[6]}
          </a>
        );
      } else {
        nodes.push(<a key={key++} href={href} target="_blank" rel="noreferrer" className={LINK_CLS}>{match[6]}</a>);
      }
    } else if (match[8] !== undefined) {
      nodes.push(<em key={key++}>{match[8]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Парсит markdown-текст в массив React-блоков. opts.onNavigate — обработчик help:-ссылок. */
export function renderMarkdown(md, opts) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Код-блок ```
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++; // закрывающий ```
      blocks.push(
        <pre key={key++} className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 my-3 overflow-x-auto text-xs">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Заголовок
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const Tag = ['h1', 'h2', 'h3', 'h4'][heading[1].length - 1];
      blocks.push(<Tag key={key++} className={HEADING_CLS[Tag]}>{renderInline(heading[2], opts)}</Tag>);
      i++;
      continue;
    }

    // Горизонтальная линия
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-4 border-gray-200 dark:border-gray-700" />);
      i++;
      continue;
    }

    // Заметка (blockquote)
    if (line === '>' || line.startsWith('> ')) {
      // Строка "> " без текста — пустая строка ВНУТРИ цитаты (разрыв абзаца
      // в рамках одного блока), а не конец цитаты — иначе многоабзацные
      // заметки рвутся на несколько кусков посреди текста.
      const quoteLines = [];
      while (i < lines.length && (lines[i] === '>' || lines[i].startsWith('> '))) {
        quoteLines.push(lines[i] === '>' ? '' : lines[i].slice(2));
        i++;
      }
      const paragraphs = [];
      let cur = [];
      for (const l of quoteLines) {
        if (l === '') { if (cur.length) { paragraphs.push(cur.join(' ')); cur = []; } }
        else cur.push(l);
      }
      if (cur.length) paragraphs.push(cur.join(' '));
      blocks.push(
        <div key={key++} className="border-l-4 border-blue-300 dark:border-blue-700
                                     bg-blue-50 dark:bg-blue-950/40 px-4 py-2 my-3 rounded-r
                                     text-sm text-gray-700 dark:text-gray-300 space-y-2">
          {paragraphs.map((p, idx) => <p key={idx}>{renderInline(p, opts)}</p>)}
        </div>
      );
      continue;
    }

    // Списки
    const isUl = /^[-*]\s+/.test(line);
    const isOl = /^\d+\.\s+/.test(line);
    if (isUl || isOl) {
      const items = [];
      while (i < lines.length && (isUl ? /^[-*]\s+/.test(lines[i]) : /^\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(isUl ? /^[-*]\s+/ : /^\d+\.\s+/, ''));
        i++;
      }
      const ListTag = isUl ? 'ul' : 'ol';
      blocks.push(
        <ListTag key={key++} className={`my-2 pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300
                                          ${isUl ? 'list-disc' : 'list-decimal'}`}>
          {items.map((item, idx) => <li key={idx}>{renderInline(item, opts)}</li>)}
        </ListTag>
      );
      continue;
    }

    // Абзац — строки до пустой строки или начала другого блока
    const paraLines = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { paraLines.push(lines[i]); i++; }
    blocks.push(
      <p key={key++} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-2">
        {renderInline(paraLines.join(' '), opts)}
      </p>
    );
  }

  return blocks;
}

/** Заголовок документа — первая строка `# ...`, иначе имя файла. */
export function extractTitle(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}
