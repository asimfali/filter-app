import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderUploadPage from '../FolderUploadPage';
import { mediaApi } from '../../api/media';
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ results: [productType1] }),
    }));
});
afterEach(() => {
    vi.unstubAllGlobals();
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
