# SPEC_EDITOR_FRONTEND_PROGRESS.md — Фронтенд редактора спецификаций

_Создан: апрель 2026_

---

## Архитектура фронтенда
src/
├── components/
│   ├── common/
│   │   ├── SmartSelect.jsx       — универсальный поиск с inline-create
│   │   ├── ConfirmModal.jsx
│   │   ├── AlertModal.jsx
│   │   ├── FileDropZone.jsx
│   │   ├── ModalFooter.jsx
│   │   ├── Dropdown.jsx          — умный дропдаун с позиционированием
│   │   └── WarningsList.jsx
│   └── bom/
│       ├── FolderPicker.jsx      — поиск/создание папок 1С
│       ├── MaterialCombobox.jsx  — выбор материала 1С с избранным
│       ├── ValidationReport.jsx
│       ├── SyncModal.jsx
│       ├── PullModal.jsx
│       ├── MaterialGroupsModal.jsx
│       ├── PackagingModal.jsx
│       ├── ImportExcelModal.jsx
│       ├── MergeExcelModal.jsx
│       ├── ImportJsonModal.jsx
│       ├── UnitWeightModal.jsx
│       ├── CreateSpecModal.jsx
│       └── CreateDetailsModal.jsx
├── hooks/
│   ├── useModals.jsx             — ConfirmModal + AlertModal через хук
│   └── useExcelImport.js         — общий хук для Excel/JSON импорта
├── utils/
│   └── styles.js                 — inputCls и другие общие классы
└── pages/
├── PartEditorPage.jsx        — роутинг list/editor + сессия
└── bom/
├── SpecList.jsx          — список спецификаций + контекстное меню
├── SpecEditor.jsx        — редактор спецификации + кнопки push
├── SpecHeaderForm.jsx    — форма заголовка + FolderPicker'ы
└── MaterialsPanel.jsx    — таблица материалов + MaterialCombobox

---

## SmartSelect — универсальный компонент поиска

Заменяет все предыдущие поисковые компоненты (`ProductSearch`, `DocumentSearch`, `SearchSelect`).

Возможности:
- Умное позиционирование дропдауна (вверх/вниз в зависимости от места на экране)
- Inline create (`allowCreate + createEndpoint`)
- Чип выбранного значения (`value + onClear`)
- Поддержка кастомного `nameKey` (для `onec_name` и других полей)
- Поддержка `excludeIds` (для исключения уже выбранных)
- Поддержка кастомного `inputClassName`
- Корректная работа с endpoint'ами с существующими query параметрами

Используется в:
- `DefectActPage` — поиск номенклатуры и типа дефекта
- `HeatExchangersPage` — поиск документа для привязки чертежа
- `FolderUploadPage` — поиск изделия для привязки
- `Header` — глобальный поиск товаров

---

## Ведомость дефектов

Новый модуль `apps/bom` — `DefectAct` + `DefectType`.

Страница: `src/pages/DefectActPage.jsx`

Возможности:
- Таблица актов с фильтрацией по диапазону дат и поиском
- Создание/редактирование актов
- Поиск номенклатуры через `SmartSelect` → `/api/v1/bom/parts/`
- Поиск/создание типа дефекта через `SmartSelect` с inline-create
- Генерация PDF отчёта через WeasyPrint (backend)
- Права: `bom.defect.view` / `bom.defect.write`

API:
GET/POST   /api/v1/bom/defect-acts/
PATCH/DELETE /api/v1/bom/defect-acts/{id}/
GET        /api/v1/bom/defect-acts/pdf/
GET/POST   /api/v1/bom/defect-types/

Шаблон PDF: `templates/bom/defect_acts_pdf.html`

---

## Рефакторинг PartEditorPage ✅

Исходный размер: ~4000 строк → после рефакторинга: ~180 строк

Вынесено:
- [x] Общие UI компоненты → `src/components/common/`
- [x] BOM-специфичные компоненты → `src/components/bom/`
- [x] Хуки → `src/hooks/`
- [x] Общие стили → `src/utils/styles.js`
- [x] Страницы редактора → `src/pages/bom/`

---

## Статус компонентов

| Компонент | Статус | Примечания |
|---|---|---|
| `SmartSelect` | ✅ | Заменил все поисковые компоненты |
| `SpecList` | ✅ | Контекстное меню, clone, rename, delete |
| `SpecEditor` | ✅ | Push кнопки, валидация, clone |
| `SpecHeaderForm` | ✅ | FolderPicker для 3 папок |
| `MaterialsPanel` | ✅ | Таблица материалов, sticky footer |
| `MaterialCombobox` | ✅ | Избранное ⭐, группы материалов |
| `FolderPicker` | ✅ | Хлебные крошки, создание папок |
| `DefectActPage` | ✅ | PDF отчёт, фильтрация по датам |

---

## Известные ограничения

1. PDF скачивается через blob URL — имя файла в браузере `document.pdf`
   Причина: Bearer токен нельзя передать через `window.open`
   Решение отложено: одноразовый токен через Redis (реализация готова, не внедрена)

2. `PartEditorPage` содержит `STATUS_LABEL/STATUS_COLOR` — дублируются в `SpecList` и `SpecEditor`
   Решение: вынести в `src/utils/bomConstants.js`

---

## TODO фронтенд

- [ ] Вынести `STATUS_LABEL/STATUS_COLOR` в `src/utils/bomConstants.js`
- [ ] `Field` компонент — удалить или вынести в `common`
- [ ] Исправить blob PDF — имя файла при скачивании
- [ ] Inline создание номенклатуры из строки материала (Фаза 7)
- [ ] История изменений в редакторе (ChangeHistory)