---
name: frontend-tests
description: Написание тестов для React-компонентов, хуков, api-слоя и утилит на Vitest + Testing Library. Использовать при любой задаче со словом "тест", "покрытие", "vitest", "testing-library".
---

# Тесты фронтенда

## Стек

Vitest (`environment: jsdom`, конфиг — блок `test` в `vite.config.js`) + `@testing-library/react` +
`@testing-library/user-event` + `@testing-library/jest-dom/vitest` (подключён в `src/setupTests.js`,
именно `/vitest`-энтрипоинт, не голый `@testing-library/jest-dom` — иначе `expect` не расширяется).

Никаких MSW/nock — на моки поверх `fetch` пока намеренно не заводили лишнюю зависимость (см. ниже).

## Команды

```bash
npm test                                   # весь набор, разово (vitest run)
npm run test:watch                         # watch-режим
npx vitest run src/utils/__tests__/permissions.test.js
npx vitest run -t "returns false when user is null"
```

## Структура

Тесты лежат рядом с тестируемым файлом, в `__tests__/`:
```
src/utils/permissions.js          → src/utils/__tests__/permissions.test.js
src/components/common/ConfirmModal.jsx → src/components/common/__tests__/ConfirmModal.test.jsx
src/api/bom.js                    → src/api/__tests__/bom.test.js
src/hooks/useMultiSelect.js       → src/hooks/__tests__/useMultiSelect.test.js
```
`.test.js` для чистых модулей (utils, api, хуки без JSX), `.test.jsx` для всего, что рендерит JSX.
Общих фабрик/фикстур пока нет — если понадобится общий helper для нескольких тестов, класть в
`src/test-utils/` (создать при первой необходимости), не дублировать по файлам.

## Обязательные правила

- Мокать на границе модуля, а не глубже: `vi.mock('../../api/bom')` вместо мока `fetch` внутри
  компонентного теста. Для тестов самого `api/*.js` — мокать `global.fetch` (`vi.stubGlobal('fetch', vi.fn())`)
  или `apiFetch` из `api/auth.js`, а не переизобретать обёртку.
- Компонент, ветвящийся по правам (`can`/`canAny` из `utils/permissions.js`) — тест минимум на два
  состояния: право есть / права нет.
- Асинхронные обновления UI — `findBy*`/`waitFor`, никогда `setTimeout`/произвольные задержки.
- Взаимодействия пользователя — `@testing-library/user-event` (`userEvent.setup()` + `await user.click(...)`),
  не `fireEvent`, если не нужен низкоуровневый контроль. **Fake timers — низкоуровневый контроль**:
  как только в файле есть `vi.useFakeTimers()`, переходить на `fireEvent` полностью (см. ниже, почему).
- Селекторы — по роли/тексту, видимому пользователю (`getByRole`, `getByText`, `getByLabelText`);
  `data-testid` — только когда действительно нет другого устойчивого селектора. В этом кодбейзе
  `<label>` часто НЕ связан с `<input>` через `htmlFor`/`id` (визуальные соседи) — `getByLabelText`
  в таких местах ничего не найдёт; использовать `getByPlaceholderText`, `container.querySelector`
  или позиционные запросы (`getAllByDisplayValue(...)[0]`).
- Компонент, зависящий от контекста (`AuthContext`, `ThemeContext`, ...) — оборачивать в реальный
  Provider с замоканными api-ответами, а не дублировать логику контекста в тесте.
- `useIssuesSocket`/что-либо на WebSocket — мокать глобальный `WebSocket`, не поднимать реальное соединение.
- Кастомные dropdown-компоненты этого проекта (`Dropdown`, `SmartSelect`, и большинство
  autocomplete-паттернов в `components/bom/*`) выбирают пункт через `onMouseDown` (с
  `preventDefault`), не `onClick` — `fireEvent.click` на пункте списка ничего не даст,
  нужен `fireEvent.mouseDown` (обычный `userEvent.click` работает, т.к. сам эмитит mousedown).

## Известные ловушки (проверено на практике, экономит время)

- **`userEvent` под `vi.useFakeTimers()` виснет.** Внутренние задержки user-event полагаются на
  реальные таймеры и не отпускают управление, тест падает по общему таймауту (5000мс), причём
  зависает КАЖДОЕ взаимодействие в файле, а не одно. Как только в файле есть fake timers —
  всё взаимодействие через `fireEvent` (`fireEvent.click/change/mouseDown/keyDown`).
- **Fake timers + динамический `import()` внутри `setInterval`-колбэка тоже виснут.**
  `vi.advanceTimersByTimeAsync` не всегда докручивает микрозадачи через цепочку динамического
  импорта (встречалось в `SyncModal.jsx` — режимы `extract`/`dxf_import` делают
  `await import('../../api/selection')` внутри поллинг-интервала). Для таких кейсов — реальные
  таймеры + `await screen.findByText(x, {}, { timeout: 3000 })` с увеличенным таймаутом теста
  третьим аргументом `it('...', async () => {...}, 8000)`, а не `vi.advanceTimersByTimeAsync`.
- **Один зависший fake-timers тест травит все следующие тесты файла.** Если тест с
  `vi.useFakeTimers()` падает/виснет до своего же `vi.useRealTimers()`, фейковые таймеры остаются
  активными в следующих тестах (даже без явного fake timers в них) — начинают виснуть уже они.
  Защита: `afterEach(() => vi.useRealTimers())` в любом файле, где хоть один тест включает fake timers.
- **Отладочный/начальный fetch может быть завязан на тот же debounce, что и поиск, включая
  самый первый вызов при маунте** (нет отдельного немедленного fetch-эффекта) — например,
  `PackagingModal.loadItems()` вызывается только из `useEffect(() => setTimeout(loadItems, 300),
  [packSearch])`, который отрабатывает и на маунте тоже. Если компонент так устроен — продвигать
  debounce-таймер нужно в КАЖДОМ тесте, а не только там, где явно проверяется поиск.
- **`fireEvent.change` с ТЕМ ЖЕ значением, что уже стоит в input, не вызывает `onChange` повторно** —
  React отслеживает предыдущее value нативного инпута. Если тестовый стаб-input используется
  несколько раз подряд с потенциально одинаковым значением (например, навигационный стаб,
  дёргаемый с одинаковыми аргументами) — подмешивать nonce/counter в значение, чтобы строка
  всегда была новой.
- **`getByText`/`getNodeText` считает только ПРЯМЫЕ текстовые узлы элемента** — текст вложенного
  `<span>` НЕ входит в матчинг родителя (`<p>текст<span>ещё текст</span></p>` — родительский `<p>`
  "видит" только "текст", не "ещё текст"). Плюс дефолтная нормализация обрезает края строки —
  короткий `<span>текст с пробелом на конце </span>` после trim теряет этот пробел. При "Unable to
  find" на, казалось бы, точный текст — проверить, не разбит ли он между элементами и не
  просят ли эти самые крайние пробелы одну лишнюю проверку.

## DRY в тестах

- Общий helper — в `src/test-utils/`, не копировать между файлами.
- Параметризация вместо копипасты: `it.each([...])`.

## Что не покрывать юнит-тестами

`FilterTree.jsx`/`BindingGraph.jsx` (Cytoscape) и `ModelViewerPage.jsx` (three.js) — полноценный
mount в jsdom нецелесообразен (нет canvas/WebGL). Если в них появляется чистая логика без DOM/canvas
(сортировки, парсинг, вычисление пересечений — по образцу `byNumericValue` в `FilterTree.jsx`) —
выносить в отдельную функцию/файл и тестировать её отдельно, а не сам граф.
