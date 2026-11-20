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

## Обязательные правила (коротко)

- **Мокать на границе модуля**, не глубже: `vi.mock('../../api/bom')`, а не `fetch` внутри компонентного теста; для тестов `api/*.js` — `vi.stubGlobal('fetch', ...)`.
- Компонент, ветвящийся по правам (`can`/`canAny`) — тест минимум на два состояния: право есть и права нет.
- Асинхронный UI — `findBy*`/`waitFor`, никогда `setTimeout`; взаимодействия — `user-event`; с `vi.useFakeTimers()` переходить на `fireEvent` целиком.
- Селекторы — по роли/тексту; `<label>` здесь часто не связан с `<input>`, поэтому `getByLabelText` может не найти — есть `getByPlaceholderText`/`querySelector`.
- Полный свод правил и известных ловушек — `references/rules-1.md` и `references/rules-2.md`. Читать перед первым тестом в новой области.
## DRY в тестах

- Общий helper — в `src/test-utils/`, не копировать между файлами.
- Параметризация вместо копипасты: `it.each([...])`.

## Что не покрывать юнит-тестами

`FilterTree.jsx`/`BindingGraph.jsx` (Cytoscape) и `ModelViewerPage.jsx` (three.js) — полноценный
mount в jsdom нецелесообразен (нет canvas/WebGL). Если в них появляется чистая логика без DOM/canvas
(сортировки, парсинг, вычисление пересечений — по образцу `byNumericValue` в `FilterTree.jsx`) —
выносить в отдельную функцию/файл и тестировать её отдельно, а не сам граф.
