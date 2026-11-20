# Обязательные правила и ловушки (полный свод)

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
