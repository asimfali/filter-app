import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderUploadPage from '../FolderUploadPage';
import { mediaApi } from '../../api/media';
import { catalogApi } from '../../api/catalog';
import { sessionsApi } from '../../api/sessions';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/media', () => ({
    mediaApi: {
        getFormData: vi.fn(),
        getFilters: vi.fn(),
        parseFolderPaths: vi.fn(),
        matchProductsByArticle: vi.fn(),
        uploadDocument: vi.fn(),
        addProductsToDocument: vi.fn(),
        bulkSetDocumentFilters: vi.fn(),
    },
}));
vi.mock('../../api/catalog', () => ({ catalogApi: { productTypes: vi.fn() } }));
vi.mock('../../api/sessions', () => ({
    sessionsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/common/SmartSelect', () => ({
    default: ({ placeholder, onSelect }) => (
        <div>
            <input placeholder={placeholder} readOnly />
            <button onClick={() => onSelect({ id: 999, name: 'Найденное изделие' })}>select-product</button>
        </div>
    ),
}));

const ok = (data) => ({ ok: true, data });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const docTypeFilters = { id: 1, name: 'Паспорта', code: 'passport', upload_mode: 'filters' };
const docTypeModels = { id: 2, name: '3D модели', code: 'models', upload_mode: 'filters' };
const docTypeProducts = { id: 3, name: 'Каталог', code: 'catalog', upload_mode: 'products' };
const productType1 = { id: 10, name: 'Калорифер' };

function makeFile(relPath, name) {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'webkitRelativePath', { value: relPath, configurable: true });
    return f;
}

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms('portal.documents.upload') });
    mediaApi.getFormData.mockResolvedValue(ok({
        doc_types: [docTypeFilters, docTypeModels, docTypeProducts],
        axes: [],
        folder_upload_settings: [],
    }));
    sessionsApi.list.mockResolvedValue({ results: [] });
    catalogApi.productTypes.mockResolvedValue({ ok: true, data: { results: [productType1] } });
});
afterEach(() => {
    vi.useRealTimers();
});

async function renderPage() {
    const user = userEvent.setup();
    render(<FolderUploadPage onBack={vi.fn()} />);
    await screen.findByText('Выбрать папку');
    await screen.findByText('Калорифер'); // дождаться загрузки типов продукции
    return user;
}

describe('FolderUploadPage — загрузка справочников', () => {
    it('грузит типы документов и продукции, рендерит опции', async () => {
        await renderPage();
        expect(screen.getByText('Паспорта')).toBeInTheDocument();
        expect(screen.getByText('3D модели')).toBeInTheDocument();
        expect(screen.getByText('Калорифер')).toBeInTheDocument();
    });
});

describe('FolderUploadPage — сессия', () => {
    it('без активной сессии — поля дефолтные, предупреждения о сессии нет', async () => {
        await renderPage();
        expect(screen.getByPlaceholderText('Архив, archive')).toHaveValue('Архив, archive');
        expect(screen.queryByText(/Сессия восстановлена/)).not.toBeInTheDocument();
    });

    it('восстанавливает активную сессию: поля + items (file:null) + предупреждение', async () => {
        sessionsApi.list.mockResolvedValue({
            results: [{
                id: 55, is_active: true, session_type: 'folder_upload',
                data: {
                    doc_type_id: 1, product_type_id: 10,
                    exclude_folders: 'temp, old', folder_marker: 'АКТУАЛЬНО',
                    name_template: '{doc_type}',
                    items: [{ path: 'a/b.pdf', external_id: 'b', filters: [], matchedProducts: [] }],
                },
            }],
        });
        await renderPage();
        expect(await screen.findByText(/Сессия восстановлена/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Архив, archive')).toHaveValue('temp, old');
        expect(screen.getByPlaceholderText('ПАСПОРТ')).toHaveValue('АКТУАЛЬНО');
        expect(screen.getByText('1 файлов')).toBeInTheDocument();
    });

    it('применяет activeSettings при выборе типа документа (без восстановленной сессии)', async () => {
        mediaApi.getFormData.mockResolvedValue(ok({
            doc_types: [docTypeFilters, docTypeModels, docTypeProducts],
            axes: [],
            folder_upload_settings: [{
                doc_type_id: 1, product_type_id: null,
                settings: { exclude_folders: ['temp', 'old'], folder_marker: 'РАБОЧАЯ', name_template: '{doc_type} X' },
            }],
        }));
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        await waitFor(() => expect(screen.getByPlaceholderText('Архив, archive')).toHaveValue('temp, old'));
        expect(screen.getByPlaceholderText('ПАСПОРТ')).toHaveValue('РАБОЧАЯ');
    });

    it('автосохранение: создаёт сессию (debounce 500мс) при первом изменении, потом обновляет', async () => {
        vi.useFakeTimers();
        sessionsApi.create.mockResolvedValue({ id: 77 });
        render(<FolderUploadPage onBack={vi.fn()} />);
        await vi.waitFor(() => expect(screen.getByText('Выбрать папку')).toBeInTheDocument());
        await vi.waitFor(() => expect(screen.getByText('Калорифер')).toBeInTheDocument());

        fireEvent.change(screen.getByPlaceholderText('Архив, archive'), { target: { value: 'temp' } });
        await vi.advanceTimersByTimeAsync(500);
        await vi.waitFor(() => expect(sessionsApi.create).toHaveBeenCalledWith(
            'folder_upload', 'Загрузка из папки', expect.objectContaining({ exclude_folders: 'temp' }),
        ));

        fireEvent.change(screen.getByPlaceholderText('ПАСПОРТ'), { target: { value: 'НОВОЕ' } });
        await vi.advanceTimersByTimeAsync(500);
        await vi.waitFor(() => expect(sessionsApi.update).toHaveBeenCalledWith(
            77, expect.objectContaining({ data: expect.objectContaining({ folder_marker: 'НОВОЕ' }) }),
        ));
    });
});

describe('FolderUploadPage — разбор папки (handleFolderChange)', () => {
    it('режим filters: фильтрует по .pdf, исключает папки по excludeFolders, применяет filterLatestPassports', async () => {
        // Выбор doc type без настроенных folder_upload_settings сбрасывает
        // excludeFolders/folderMarker в '' (per-doctype настройки) — задаём их явно,
        // как это будет в реальном использовании (см. также тест "применяет activeSettings").
        mediaApi.getFormData.mockResolvedValue(ok({
            doc_types: [docTypeFilters, docTypeModels, docTypeProducts],
            axes: [],
            folder_upload_settings: [{
                doc_type_id: 1, product_type_id: null,
                settings: { exclude_folders: ['Архив', 'archive'], folder_marker: 'ПАСПОРТ', name_template: '' },
            }],
        }));
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        await waitFor(() => expect(screen.getByPlaceholderText('ПАСПОРТ')).toHaveValue('ПАСПОРТ'));

        mediaApi.parseFolderPaths.mockResolvedValue(ok({
            success: true,
            results: [{ external_id: 'a', path: 'Изделие/ПАСПОРТ-2024/a.pdf', article: 'a', filters: [] }],
        }));

        const files = [
            makeFile('Изделие/ПАСПОРТ-2023/a.pdf', 'a.pdf'),
            makeFile('Изделие/ПАСПОРТ-2024/a.pdf', 'a.pdf'),
            makeFile('Изделие/картинка.jpg', 'картинка.jpg'), // не .pdf
            makeFile('Архив/старое.pdf', 'старое.pdf'), // исключённая папка
        ];
        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files } });

        await waitFor(() => expect(mediaApi.parseFolderPaths).toHaveBeenCalled());
        const [paths, productTypeId, exclude, docTypeId, uploadMode] = mediaApi.parseFolderPaths.mock.calls[0];
        expect(paths).toEqual(['Изделие/ПАСПОРТ-2024/a.pdf']); // только последняя папка с маркером, без jpg/архива
        expect(productTypeId).toBeNull();
        expect(exclude).toEqual(['архив', 'archive']);
        expect(docTypeId).toBe('1');
        expect(uploadMode).toBe('filters');

        expect(await screen.findByText('1 файлов')).toBeInTheDocument();
    });

    it('docTypeCode="models" разрешает 3D-расширения', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '2');
        mediaApi.parseFolderPaths.mockResolvedValue(ok({ success: true, results: [{ external_id: 'm', path: 'x/m.step', article: 'm', filters: [] }] }));

        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [makeFile('x/m.step', 'm.step')] } });

        await waitFor(() => expect(mediaApi.parseFolderPaths).toHaveBeenCalled());
        expect(mediaApi.parseFolderPaths.mock.calls[0][0]).toEqual(['x/m.step']);
    });

    it('режим products: без фильтра по маркеру, вызывает matchProductsByArticle, помечает selected', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '3');
        mediaApi.parseFolderPaths.mockResolvedValue(ok({
            success: true,
            results: [
                { external_id: 'a', path: 'x/a.pdf', article: 'ART-1', filters: [] },
                { external_id: 'b', path: 'y/b.pdf', article: 'ART-1', filters: [] },
            ],
        }));
        mediaApi.matchProductsByArticle.mockResolvedValue(ok({
            success: true,
            results: { 'ART-1': [{ id: 5, name: 'Найдено по артикулу' }] },
        }));

        const input = document.querySelector('input[type="file"]');
        // Обе версии — старая и новая, БЕЗ папки-маркера "ПАСПОРТ" — filterLatestPassports не должен их убрать (режим products его не вызывает)
        fireEvent.change(input, { target: { files: [makeFile('x/a.pdf', 'a.pdf'), makeFile('y/b.pdf', 'b.pdf')] } });

        await waitFor(() => expect(mediaApi.matchProductsByArticle).toHaveBeenCalledWith(['ART-1'], '3', null));
        expect(mediaApi.parseFolderPaths.mock.calls[0][0]).toEqual(['x/a.pdf', 'y/b.pdf']);
        expect(await screen.findByText('2 файлов')).toBeInTheDocument();
    });

    it('пустой список после фильтрации — parseFolderPaths не вызывается', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [makeFile('Изделие/картинка.jpg', 'картинка.jpg')] } });
        await new Promise(r => setTimeout(r, 50));
        expect(mediaApi.parseFolderPaths).not.toHaveBeenCalled();
    });
});

async function parseWithItems(user, docTypeIdValue, results) {
    await user.selectOptions(screen.getByText('— выберите —').closest('select'), docTypeIdValue);
    mediaApi.parseFolderPaths.mockResolvedValue(ok({ success: true, results }));
    const input = document.querySelector('input[type="file"]');
    const files = results.map((r, i) => makeFile(r.path, `f${i}.pdf`));
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(mediaApi.parseFolderPaths).toHaveBeenCalled());
}

describe('FolderUploadPage — таблица: buildDocumentName + колонки осей', () => {
    it('без шаблона — имя из item.article, иначе имя типа документа', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        fireEvent.change(screen.getByPlaceholderText('{doc_type} {series} {heating} {design}'), { target: { value: '' } });
        mediaApi.parseFolderPaths.mockResolvedValue(ok({
            success: true,
            results: [
                { external_id: 'a', path: 'x/a.pdf', article: 'АРТ-1', filters: [] },
                { external_id: 'b', path: 'y/b.pdf', article: '', filters: [] },
            ],
        }));
        fireEvent.change(document.querySelector('input[type="file"]'), {
            target: { files: [makeFile('x/a.pdf', 'a.pdf'), makeFile('y/b.pdf', 'b.pdf')] },
        });
        await waitFor(() => expect(mediaApi.parseFolderPaths).toHaveBeenCalled());
        expect(await screen.findByText('АРТ-1')).toBeInTheDocument();
        // фолбэк для второй строки (пустой article) — "Паспорта" неоднозначно (тоже текст опции
        // <select>), проверяем именно в ячейке "Имя документа" (span)
        expect(screen.getAllByText('Паспорта', { selector: 'span' })).toHaveLength(1);
    });

    it('с шаблоном подставляет {doc_type} и {axis_code} (или транслитерацию имени оси)', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        fireEvent.change(screen.getByPlaceholderText('{doc_type} {series} {heating} {design}'), {
            target: { value: '{doc_type} {series} {without_code}' },
        });
        await parseWithItems(user, '1', [{
            external_id: 'a', path: 'x/a.pdf', article: 'a',
            filters: [
                { id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] },
                { id: 2, axis_id: 200, axis: 'Without Code', values: ['Y'] },
            ],
        }]);
        // Ось без явного axis_code транслитерируется из имени ("Without Code" → "without_code")
        // и тоже подставляется в шаблон
        expect(await screen.findByText('Паспорта 200 Y')).toBeInTheDocument();
        expect(screen.getByText('Without Code')).toBeInTheDocument(); // заголовок колонки оси
    });

    it('динамические переменные шаблона (availableCodes) отражают axis_code разобранных строк', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [{
            external_id: 'a', path: 'x/a.pdf', article: 'a',
            filters: [{ id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] }],
        }]);
        expect(await screen.findByText('Переменные: {doc_type} {series}')).toBeInTheDocument();
    });
});

describe('FolderUploadPage — FilterCell', () => {
    it('пустая ячейка показывает "+ добавить", открытие грузит getFilters один раз', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [{
            external_id: 'a', path: 'x/a.pdf', article: 'a',
            filters: [{ id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] }],
        }, {
            external_id: 'b', path: 'y/b.pdf', article: 'b', filters: [],
        }]);
        mediaApi.getFilters.mockResolvedValue(ok({
            filters: [{ id: 1, axis: { id: 100, name: 'Серия' }, values: ['200'] }, { id: 2, axis: { id: 100, name: 'Серия' }, values: ['300'] }],
        }));

        const addButtons = await screen.findAllByText('+ добавить');
        await user.click(addButtons[0]);
        expect(mediaApi.getFilters).toHaveBeenCalledWith(100);
        expect(await screen.findByText('300')).toBeInTheDocument();

        await user.click(addButtons[0]); // закрыть
        await user.click(addButtons[0]); // открыть снова
        expect(mediaApi.getFilters).toHaveBeenCalledTimes(1);
    });

    it('выбор фильтра из дропдауна вызывает onAdd, повторный выбор — onRemove', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [{
            external_id: 'a', path: 'x/a.pdf', article: 'a',
            filters: [{ id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] }],
        }]);
        mediaApi.getFilters.mockResolvedValue(ok({
            filters: [
                { id: 1, axis: { id: 100, name: 'Серия' }, values: ['200'] },
                { id: 2, axis: { id: 100, name: 'Серия' }, values: ['300'] },
            ],
        }));

        await user.click(screen.getByText('200'));
        await user.click(await screen.findByText('300'));
        // Каждый выбранный фильтр — отдельный тег (а не объединённая строка значений)
        expect(await screen.findByText('300')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();

        // Повторное открытие не перезапрашивает getFilters (кэш в axisFilters);
        // выбор уже активного фильтра ("✓ 200") снимает его — тег "200" пропадает
        await user.click(screen.getByText('200'));
        await user.click(await screen.findByText('✓ 200'));
        expect(mediaApi.getFilters).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('200')).not.toBeInTheDocument();
        expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('закрытие дропдауна по клику вне', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [{
            external_id: 'a', path: 'x/a.pdf', article: 'a',
            filters: [{ id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] }],
        }]);
        mediaApi.getFilters.mockResolvedValue(ok({ filters: [] }));
        await user.click(screen.getByText('200'));
        expect(await screen.findByText('Нет фильтров')).toBeInTheDocument();
        await user.click(screen.getByText('Загрузка из папки'));
        expect(screen.queryByText('Нет фильтров')).not.toBeInTheDocument();
    });
});

describe('FolderUploadPage — режим products в таблице', () => {
    it('нераспознанный артикул показывает предупреждение', async () => {
        const user = await renderPage();
        await parseWithItems(user, '3', [{ external_id: 'a', path: 'x/a.pdf', article: '', filters: [] }]);
        expect(await screen.findByText('Артикул не распознан')).toBeInTheDocument();
    });

    it('чекбоксы toggle selected (зачёркивание невыбранных)', async () => {
        const user = await renderPage();
        mediaApi.matchProductsByArticle.mockResolvedValue(ok({
            success: true,
            results: { 'ART-1': [{ id: 5, name: 'Изделие А' }] },
        }));
        await parseWithItems(user, '3', [{ external_id: 'a', path: 'x/a.pdf', article: 'ART-1', filters: [] }]);

        const checkbox = await screen.findByRole('checkbox');
        expect(checkbox).toBeChecked();
        expect(screen.getByText('Изделие А')).not.toHaveClass('line-through');

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
        expect(screen.getByText('Изделие А')).toHaveClass('line-through');
    });

    it('SmartSelect добавляет изделие вручную (исключая уже присутствующие)', async () => {
        const user = await renderPage();
        mediaApi.matchProductsByArticle.mockResolvedValue(ok({
            success: true,
            results: { 'ART-1': [{ id: 5, name: 'Изделие А' }] },
        }));
        await parseWithItems(user, '3', [{ external_id: 'a', path: 'x/a.pdf', article: 'ART-1', filters: [] }]);
        await screen.findByText('Изделие А');

        await user.click(screen.getByText('select-product'));
        expect(await screen.findByText('Найденное изделие')).toBeInTheDocument();
    });
});

describe('FolderUploadPage — handleUpload (режим filters)', () => {
    it('disabled без docTypeId даже если items есть', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [{ external_id: 'a', path: 'x/a.pdf', article: 'a', filters: [] }]);
        await user.selectOptions(screen.getByText('Паспорта').closest('select'), '');
        expect(screen.getByRole('button', { name: /Загрузить 1 файлов/ })).toBeDisabled();
    });

    it('успешная загрузка: uploadDocument с generatedName, bulkSetDocumentFilters для непустых filters, статус ok, "✓ Готово"', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        fireEvent.change(screen.getByPlaceholderText('{doc_type} {series} {heating} {design}'), {
            target: { value: '{doc_type} {series}' },
        });
        await parseWithItems(user, '1', [
            {
                external_id: 'a', path: 'x/a.pdf', article: 'a',
                filters: [{ id: 1, axis_id: 100, axis: 'Серия', axis_code: 'series', values: ['200'] }],
            },
            { external_id: 'b', path: 'y/b.pdf', article: 'b', filters: [] },
        ]);
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, document: { id: 500 } }));
        mediaApi.bulkSetDocumentFilters.mockResolvedValue(ok({ success: true }));

        await user.click(screen.getByRole('button', { name: /Загрузить 2 файлов/ }));

        await waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalledTimes(2));
        expect(mediaApi.uploadDocument.mock.calls[0][0]).toBe('1');
        expect(mediaApi.uploadDocument.mock.calls[0][1]).toBe('a');
        expect(mediaApi.uploadDocument.mock.calls[0][3]).toBe('Паспорта 200');

        // Фильтры проставляются только для строки с непустыми filters
        await waitFor(() => expect(mediaApi.bulkSetDocumentFilters).toHaveBeenCalledTimes(1));
        expect(mediaApi.bulkSetDocumentFilters).toHaveBeenCalledWith(500, [1]);
        expect(mediaApi.addProductsToDocument).not.toHaveBeenCalled();

        expect(await screen.findByText('✓ Готово')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '✓ Готово' })).toBeDisabled();
        expect(screen.getAllByText('✓ Загружено')).toHaveLength(2);
    });

    it('ошибка API одной строки не прерывает цикл, накапливает progress.errors и статус error', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [
            { external_id: 'a', path: 'x/a.pdf', article: 'a', filters: [] },
            { external_id: 'b', path: 'y/b.pdf', article: 'b', filters: [] },
        ]);
        mediaApi.uploadDocument
            .mockResolvedValueOnce({ ok: false, data: { success: false, error: 'Дубликат' } })
            .mockResolvedValueOnce(ok({ success: true, document: { id: 501 } }));

        await user.click(screen.getByRole('button', { name: /Загрузить 2 файлов/ }));

        expect(await screen.findByText('✓ Готово')).toBeInTheDocument();
        expect(screen.getByText('Ошибок: 1')).toBeInTheDocument();
        expect(screen.getByText('✗ Ошибка', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('✓ Загружено')).toBeInTheDocument();
    });

    it('сетевая ошибка (reject) тоже засчитывается как error, не роняет цикл', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [
            { external_id: 'a', path: 'x/a.pdf', article: 'a', filters: [] },
            { external_id: 'b', path: 'y/b.pdf', article: 'b', filters: [] },
        ]);
        mediaApi.uploadDocument
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce(ok({ success: true, document: { id: 502 } }));

        await user.click(screen.getByRole('button', { name: /Загрузить 2 файлов/ }));

        expect(await screen.findByText('✓ Готово')).toBeInTheDocument();
        expect(screen.getByText('Ошибок: 1')).toBeInTheDocument();
    });

    it('прогресс во время загрузки показывает "Загрузка N/M..."', async () => {
        const user = await renderPage();
        await parseWithItems(user, '1', [
            { external_id: 'a', path: 'x/a.pdf', article: 'a', filters: [] },
            { external_id: 'b', path: 'y/b.pdf', article: 'b', filters: [] },
        ]);
        let resolveFirst;
        mediaApi.uploadDocument
            .mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }))
            .mockResolvedValueOnce(ok({ success: true }));

        await user.click(screen.getByRole('button', { name: /Загрузить 2 файлов/ }));
        expect(await screen.findByText('Загрузка 0/2...')).toBeInTheDocument();

        resolveFirst(ok({ success: true }));
        expect(await screen.findByText('✓ Готово')).toBeInTheDocument();
    });

    it('STEP-подсказка о конвертации видна только после allDone и при наличии .step файла', async () => {
        const user = await renderPage();
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '2'); // docTypeModels
        mediaApi.parseFolderPaths.mockResolvedValue(ok({
            success: true,
            results: [{ external_id: 'a', path: 'x/a.step', article: 'a', filters: [] }],
        }));
        fireEvent.change(document.querySelector('input[type="file"]'), {
            target: { files: [makeFile('x/a.step', 'a.step')] },
        });
        await waitFor(() => expect(mediaApi.parseFolderPaths).toHaveBeenCalled());

        expect(screen.queryByText(/STEP файлы конвертируются/)).not.toBeInTheDocument();
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true }));
        await user.click(screen.getByRole('button', { name: /Загрузить 1 файлов/ }));
        expect(await screen.findByText(/STEP файлы конвертируются в GLB/)).toBeInTheDocument();
    });
});

describe('FolderUploadPage — handleUpload (режим products)', () => {
    it('передаёт addProductsToDocument только с selected id, no-op если ничего не выбрано', async () => {
        const user = await renderPage();
        mediaApi.matchProductsByArticle.mockResolvedValue(ok({
            success: true,
            results: { 'ART-1': [{ id: 5, name: 'Изделие А' }, { id: 6, name: 'Изделие Б' }] },
        }));
        await parseWithItems(user, '3', [{ external_id: 'a', path: 'x/a.pdf', article: 'ART-1', filters: [] }]);
        await screen.findByText('Изделие А');

        // Снимаем выбор со второго изделия
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);

        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, document: { id: 600 } }));
        await user.click(screen.getByRole('button', { name: /Загрузить 1 файлов/ }));

        await waitFor(() => expect(mediaApi.addProductsToDocument).toHaveBeenCalledWith(600, [5]));
        expect(mediaApi.bulkSetDocumentFilters).not.toHaveBeenCalled();
    });

    it('ничего не выбрано — addProductsToDocument не вызывается', async () => {
        const user = await renderPage();
        mediaApi.matchProductsByArticle.mockResolvedValue(ok({
            success: true,
            results: { 'ART-1': [{ id: 5, name: 'Изделие А' }] },
        }));
        await parseWithItems(user, '3', [{ external_id: 'a', path: 'x/a.pdf', article: 'ART-1', filters: [] }]);
        const checkbox = await screen.findByRole('checkbox');
        await user.click(checkbox);

        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, document: { id: 601 } }));
        await user.click(screen.getByRole('button', { name: /Загрузить 1 файлов/ }));

        await waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalled());
        expect(mediaApi.addProductsToDocument).not.toHaveBeenCalled();
    });
});

describe('FolderUploadPage — права доступа', () => {
    it('без пользователя ничего не рендерит', () => {
        useAuth.mockReturnValue({ user: null });
        const { container } = render(<FolderUploadPage onBack={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('без portal.documents.upload — экран "Нет доступа", "← Назад" вызывает onBack', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        const user = userEvent.setup();
        const onBack = vi.fn();
        render(<FolderUploadPage onBack={onBack} />);
        expect(await screen.findByText('Нет доступа к этой странице')).toBeInTheDocument();
        await user.click(screen.getByText('← Назад'));
        expect(onBack).toHaveBeenCalled();
    });

    it('с правом — обычный рендер, "← Назад" в шапке вызывает onBack', async () => {
        const onBack = vi.fn();
        const user = userEvent.setup();
        render(<FolderUploadPage onBack={onBack} />);
        await screen.findByText('Загрузка из папки');
        await user.click(screen.getByText('← Назад'));
        expect(onBack).toHaveBeenCalled();
    });
});
