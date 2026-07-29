import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentsPage from '../DocumentsPage';
import { mediaApi } from '../../api/media';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/media', () => ({
    mediaApi: {
        getDocuments: vi.fn(),
        getFormData: vi.fn(),
        uploadDocument: vi.fn(),
        deleteFile: vi.fn(),
        deleteDocument: vi.fn(),
        renameDocument: vi.fn(),
        downloadFile: vi.fn(),
        bulkCreateDocuments: vi.fn(),
        searchDocuments: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/media/FiltersPanel', () => ({
    default: ({ entityId, entityType }) => (
        <div data-testid="filters-panel-stub" data-entity-id={entityId} data-entity-type={entityType} />
    ),
}));
vi.mock('../../components/media/DirectProductsPanel', () => ({
    default: () => <div data-testid="direct-products-panel-stub" />,
}));

const ok = (data) => ({ ok: true, data });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const docType1 = { id: 1, name: 'Паспорта', upload_mode: 'normal' };

function makeDoc(overrides = {}) {
    return {
        id: 1, name: '', external_id: 'passport-001', doc_type: docType1,
        current: [], archive_visible: false, archive: {}, filters: [],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms('portal.documents.upload', 'portal.documents.delete') });
    mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [docType1], axes: [] }));
    vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

async function renderWithDocs(docs) {
    mediaApi.getDocuments.mockResolvedValue(ok({ documents: docs }));
    const user = userEvent.setup();
    render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
    await screen.findByText(/Найдено:/);
    await user.click(screen.getByText('Паспорта'));
    return user;
}

async function renderWithDocsGroup(docType, docs) {
    mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [docType1, docType], axes: [] }));
    mediaApi.getDocuments.mockResolvedValue(ok({ documents: docs }));
    const user = userEvent.setup();
    render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
    await screen.findByText(/Найдено:/);
    await user.click(screen.getByText(docType.name));
    return user;
}

describe('DocumentsPage — DropZone/AddFileRow (загрузка)', () => {
    it('DropZone: пустой документ, drop файла загружает через uploadDocument', async () => {
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true }));
        await renderWithDocs([makeDoc({ current: [] })]);
        expect(screen.getByText('Файлов нет — перетащите для загрузки')).toBeInTheDocument();

        const dropzone = screen.getByText('Файлов нет — перетащите для загрузки').closest('div');
        const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

        await waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalledWith(1, 'passport-001', file));
    });

    it('AddFileRow: клик по файлу через input, показывает результат загрузки', async () => {
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true }));
        await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        const addRow = screen.getByText('+ Добавить файл (или перетащите)').closest('div');
        const input = addRow.querySelector('input[type="file"]');
        const file = new File(['x'], 'c.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalledWith(1, 'passport-001', file));
        expect(await screen.findByText('✓ c.pdf')).toBeInTheDocument();
    });
});

describe('DocumentsPage — FileRow', () => {
    it('PDF/изображение — скачивание blob → window.open в новой вкладке', async () => {
        const user = await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        const blob = new Blob(['x']);
        mediaApi.downloadFile.mockResolvedValue({ blob: () => Promise.resolve(blob) });
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

        await user.click(screen.getByText('b.pdf'));
        await waitFor(() => expect(mediaApi.downloadFile).toHaveBeenCalledWith('a/b.pdf'));
        expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');
        vi.restoreAllMocks();
    });

    it('прочий тип файла — скачивание через <a download>', async () => {
        const user = await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.dxf', name: 'b.dxf', size: '1 KB' }] })]);
        mediaApi.downloadFile.mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) });
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        const clicks = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            clicks.push({ href: this.href, download: this.download });
        });

        await user.click(screen.getByText('b.dxf'));
        await waitFor(() => expect(clicks.length).toBe(1));
        expect(clicks[0].download).toBe('b.dxf');
        vi.restoreAllMocks();
    });

    it('3D-превьюабельный файл вызывает onOpenViewer с mtlPath от .obj-сиблинга', async () => {
        const onOpenViewer = vi.fn();
        mediaApi.getDocuments.mockResolvedValue(ok({
            documents: [makeDoc({
                current: [
                    { rel_path: 'a/model.obj', name: 'model.obj', size: '1 KB' },
                    { rel_path: 'a/model.mtl', name: 'model.mtl', size: '1 KB' },
                ],
            })],
        }));
        const user = userEvent.setup();
        render(<DocumentsPage onOpenViewer={onOpenViewer} onFolderUpload={vi.fn()} />);
        await screen.findByText(/Найдено:/);
        await user.click(screen.getByText('Паспорта'));
        await user.click(screen.getByText('model.obj'));

        expect(onOpenViewer).toHaveBeenCalledWith({
            relPath: 'a/model.obj', fname: 'model.obj', mtlPath: 'a/model.mtl',
        });
        expect(mediaApi.downloadFile).not.toHaveBeenCalled();
    });

    it('удаление: confirm-gate (не window.confirm), canDelete=false скрывает кнопку', async () => {
        const user = await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        mediaApi.deleteFile.mockResolvedValue({ ok: true });
        await user.click(screen.getByText('✕'));
        expect(screen.getByText('Удалить?')).toBeInTheDocument();
        expect(mediaApi.deleteFile).not.toHaveBeenCalled();

        await user.click(screen.getByText('Удалить?'));
        await waitFor(() => expect(mediaApi.deleteFile).toHaveBeenCalledWith('a/b.pdf'));
    });

    it('без права portal.documents.delete — кнопки удаления нет', async () => {
        useAuth.mockReturnValue({ user: withPerms('portal.documents.upload') });
        await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });

    it('отмена удаления ("Отмена") не вызывает deleteFile', async () => {
        const user = await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        await user.click(screen.getByText('✕'));
        await user.click(screen.getByText('Отмена'));
        expect(screen.queryByText('Удалить?')).not.toBeInTheDocument();
        expect(mediaApi.deleteFile).not.toHaveBeenCalled();
    });
});

describe('DocumentsPage — EditableName', () => {
    it('canManageFilters=false — просто текст, не редактируется', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        await renderWithDocs([makeDoc({ name: 'Паспорт №1' })]);
        expect(screen.getByText('Паспорт №1')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Паспорт №1'));
        expect(document.querySelector('input.bg-transparent')).toBeNull();
    });

    it('клик включает редактирование, Enter сохраняет через renameDocument', async () => {
        mediaApi.renameDocument.mockResolvedValue(ok({ success: true, name: 'Новое имя' }));
        const user = await renderWithDocs([makeDoc({ name: 'Паспорт №1' })]);
        await user.click(screen.getByText('Паспорт №1'));
        const input = document.querySelector('input.bg-transparent');
        await user.clear(input);
        await user.type(input, 'Новое имя{Enter}');

        await waitFor(() => expect(mediaApi.renameDocument).toHaveBeenCalledWith(1, 'Новое имя'));
        expect(await screen.findByText('Новое имя')).toBeInTheDocument();
    });

    it('Escape отменяет редактирование без сохранения', async () => {
        const user = await renderWithDocs([makeDoc({ name: 'Паспорт №1' })]);
        await user.click(screen.getByText('Паспорт №1'));
        const input = document.querySelector('input.bg-transparent');
        await user.type(input, ' изменено{Escape}');
        expect(screen.getByText('Паспорт №1')).toBeInTheDocument();
        expect(mediaApi.renameDocument).not.toHaveBeenCalled();
    });

    it('пустое имя показывает placeholder (тип + external_id)', async () => {
        await renderWithDocs([makeDoc({ name: '' })]);
        expect(screen.getByText('Паспорта passport-001')).toBeInTheDocument();
    });
});

describe('DocumentsPage — DocumentCard: standalone', () => {
    const standaloneType = { id: 2, name: 'Галерея', upload_mode: 'standalone' };

    it('isStandalone скрывает шапку (имя/фильтры/удаление) и DirectProductsPanel', async () => {
        await renderWithDocsGroup(standaloneType, [makeDoc({
            doc_type: standaloneType, name: 'Слаг-1', external_id: 'hero-1',
            current: [{ rel_path: 'a/b.jpg', name: 'b.jpg', size: '1 KB' }],
        })]);
        expect(screen.queryByText('Слаг-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('filters-panel-stub')).not.toBeInTheDocument();
        expect(screen.queryByTestId('direct-products-panel-stub')).not.toBeInTheDocument();
        // Файлы всё равно показываются
        expect(screen.getByText('b.jpg')).toBeInTheDocument();
    });

    it('обычный (не standalone) тип рендерит FiltersPanel/DirectProductsPanel с правильными пропами', async () => {
        await renderWithDocs([makeDoc({ id: 42 })]);
        const filtersStub = screen.getByTestId('filters-panel-stub');
        expect(filtersStub.dataset.entityId).toBe('42');
        expect(filtersStub.dataset.entityType).toBe('document');
        expect(screen.getByTestId('direct-products-panel-stub')).toBeInTheDocument();
    });
});

describe('DocumentsPage — DocumentCard: удаление документа', () => {
    it('видно только при canDelete && current.length===0, confirm-gate', async () => {
        mediaApi.deleteDocument.mockResolvedValue({ ok: true });
        const user = await renderWithDocs([makeDoc({ current: [] })]);
        await user.click(screen.getByText('✕'));
        expect(screen.getByText('Удалить документ?')).toBeInTheDocument();
        expect(mediaApi.deleteDocument).not.toHaveBeenCalled();

        await user.click(screen.getByText('Удалить документ?'));
        await waitFor(() => expect(mediaApi.deleteDocument).toHaveBeenCalledWith(1));
    });

    it('не показывается, если есть файлы (current.length>0)', async () => {
        await renderWithDocs([makeDoc({ current: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '1 KB' }] })]);
        expect(screen.queryByText('Удалить документ?')).not.toBeInTheDocument();
        // "✕" здесь — кнопка удаления файла (FileRow), не документа
    });

    it('без canDelete кнопка не рендерится', async () => {
        useAuth.mockReturnValue({ user: withPerms('portal.documents.upload') });
        await renderWithDocs([makeDoc({ current: [] })]);
        expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });
});

describe('DocumentsPage — DocumentCard: архив', () => {
    it('сворачиваемый архив, сгруппирован по дате', async () => {
        const user = await renderWithDocs([makeDoc({
            archive_visible: true,
            archive: {
                '2026-01-01': [{ rel_path: 'a/old1.pdf', name: 'old1.pdf', size: '1 KB' }],
                '2026-02-01': [{ rel_path: 'a/old2.pdf', name: 'old2.pdf', size: '1 KB' }],
            },
        })]);
        expect(screen.getByText('Архив')).toBeInTheDocument();
        expect(screen.queryByText('old1.pdf')).not.toBeInTheDocument();

        await user.click(screen.getByText('Архив'));
        expect(screen.getByText('2026-01-01')).toBeInTheDocument();
        expect(screen.getByText('old1.pdf')).toBeInTheDocument();
        expect(screen.getByText('old2.pdf')).toBeInTheDocument();
    });

    it('archive_visible=false или пустой archive — блок архива не рендерится', async () => {
        await renderWithDocs([makeDoc({ archive_visible: false, archive: { '2026-01-01': [{ rel_path: 'x', name: 'x.pdf' }] } })]);
        expect(screen.queryByText('Архив')).not.toBeInTheDocument();
    });
});

describe('DocumentsPage — DocumentGroup', () => {
    it('свёрнута по умолчанию, разворачивается по клику, счётчик со склонением', async () => {
        const user = userEvent.setup();
        mediaApi.getDocuments.mockResolvedValue(ok({
            documents: [makeDoc({ id: 1, external_id: 'p-1' }), makeDoc({ id: 2, external_id: 'p-2' })],
        }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText(/Найдено:/);

        expect(screen.getByText('2 документа')).toBeInTheDocument();
        expect(screen.queryByText('Паспорта passport-001')).not.toBeInTheDocument();
        await user.click(screen.getByText('Паспорта'));
        expect(await screen.findAllByText(/Паспорта p-/)).not.toHaveLength(0);
        await user.click(screen.getByText('Паспорта'));
        expect(screen.queryByText(/Паспорта p-/)).not.toBeInTheDocument();
    });

    it.each([
        [1, 'документ'],
        [2, 'документа'],
        [5, 'документов'],
        [11, 'документов'],
        [21, 'документ'],
    ])('склонение для %i — "%s"', async (count, word) => {
        mediaApi.getDocuments.mockResolvedValue(ok({
            documents: Array.from({ length: count }, (_, i) => makeDoc({ id: i + 1, external_id: `p-${i + 1}` })),
        }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText(/Найдено:/);
        expect(screen.getByText(`${count} ${word}`)).toBeInTheDocument();
    });
});

describe('DocumentsPage — главная страница: гейтинг и режим загрузки', () => {
    it('без canUpload — нет кнопок "+ Загрузить"/"Из папки"', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');
        expect(screen.queryByText('+ Загрузить')).not.toBeInTheDocument();
        expect(screen.queryByText(/Из папки/)).not.toBeInTheDocument();
    });

    it('"+ Загрузить" переключает панель загрузки, single/bulk toggle', async () => {
        const user = userEvent.setup();
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');

        await user.click(screen.getByText('+ Загрузить'));
        expect(screen.getByText('Загрузка документа')).toBeInTheDocument();

        await user.click(screen.getByText('Добавить несколько'));
        expect(screen.getByText('Пакетное создание документов')).toBeInTheDocument();

        await user.click(screen.getByText('← Назад'));
        expect(screen.queryByText('Загрузка документа')).not.toBeInTheDocument();
    });

    it('"Из папки" вызывает onFolderUpload', async () => {
        const user = userEvent.setup();
        const onFolderUpload = vi.fn();
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={onFolderUpload} />);
        await screen.findByText('Документов пока нет');
        await user.click(screen.getByText(/Из папки/));
        expect(onFolderUpload).toHaveBeenCalled();
    });
});

describe('DocumentsPage — поиск/список верхнего уровня', () => {
    it('loading -> список сгруппирован по типу, счётчик, "Сбросить"', async () => {
        const user = userEvent.setup();
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [makeDoc()] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        expect(await screen.findByText('Найдено: 1 документ')).toBeInTheDocument();
        expect(screen.getByText('Паспорта')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText(/Поиск по типу/), 'passport');
        await waitFor(() => expect(mediaApi.getDocuments).toHaveBeenCalledWith('passport'), { timeout: 2000 });
        expect(screen.getByText('Сбросить ×')).toBeInTheDocument();
        await user.click(screen.getByText('Сбросить ×'));
        expect(screen.getByPlaceholderText(/Поиск по типу/)).toHaveValue('');
    });

    it('ошибка загрузки показывает сообщение', async () => {
        mediaApi.getDocuments.mockResolvedValue({ ok: false, data: {} });
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        expect(await screen.findByText('Ошибка загрузки документов')).toBeInTheDocument();
    });

    it('пусто без поиска — предложение загрузить первый (canUpload)', async () => {
        const user = userEvent.setup();
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await user.click(await screen.findByText('+ Загрузить первый документ'));
        expect(screen.getByText('Загрузка документа')).toBeInTheDocument();
    });

    it('пусто с непустым поиском — "Ничего не найдено", без предложения загрузить', async () => {
        const user = userEvent.setup();
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');
        await user.type(screen.getByPlaceholderText(/Поиск по типу/), 'zzz');
        expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
        expect(screen.queryByText('+ Загрузить первый документ')).not.toBeInTheDocument();
    });
});

describe('DocumentsPage — BulkCreateForm', () => {
    async function openBulk(user) {
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');
        await user.click(screen.getByText('+ Загрузить'));
        await user.click(screen.getByText('Добавить несколько'));
    }

    it('парсит строки (trim + убирает пустые), disabled без типа/строк', async () => {
        const user = userEvent.setup();
        await openBulk(user);
        const submitBtn = screen.getByRole('button', { name: /Создать/ });
        expect(submitBtn).toBeDisabled();

        await user.type(screen.getByPlaceholderText(/passport-001/), '  a  \n\nb\n  ');
        expect(screen.getByText('2 записей')).toBeInTheDocument();
        expect(submitBtn).toBeDisabled(); // тип документа ещё не выбран

        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        expect(submitBtn).not.toBeDisabled();
    });

    it('успех (created>0) сбрасывает текст и вызывает reload (getDocuments снова)', async () => {
        const user = userEvent.setup();
        mediaApi.bulkCreateDocuments.mockResolvedValue({ ok: true, data: { created: 2, skipped: 0 } });
        await openBulk(user);
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        await user.type(screen.getByPlaceholderText(/passport-001/), 'a\nb');
        mediaApi.getDocuments.mockClear();
        await user.click(screen.getByRole('button', { name: /Создать/ }));

        expect(await screen.findByText('✓ Создано: 2')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/passport-001/)).toHaveValue('');
        await waitFor(() => expect(mediaApi.getDocuments).toHaveBeenCalled());
    });

    it('created=0, skipped>0 — "все уже существуют", текст не сбрасывается', async () => {
        const user = userEvent.setup();
        mediaApi.bulkCreateDocuments.mockResolvedValue({ ok: true, data: { created: 0, skipped: 3 } });
        await openBulk(user);
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        await user.type(screen.getByPlaceholderText(/passport-001/), 'a\nb\nc');
        await user.click(screen.getByRole('button', { name: /Создать/ }));

        expect(await screen.findByText('Все 3 записей уже существуют')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/passport-001/)).toHaveValue('a\nb\nc');
    });

    it('ошибки построчно отображаются', async () => {
        const user = userEvent.setup();
        mediaApi.bulkCreateDocuments.mockResolvedValue({ ok: true, data: { created: 0, skipped: 0, errors: ['a: неверный формат'] } });
        await openBulk(user);
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
        await user.type(screen.getByPlaceholderText(/passport-001/), 'a');
        await user.click(screen.getByRole('button', { name: /Создать/ }));
        expect(await screen.findByText('✗ a: неверный формат')).toBeInTheDocument();
    });
});

describe('DocumentsPage — UploadForm: поиск/создание документа', () => {
    async function openUpload(user) {
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');
        await user.click(screen.getByText('+ Загрузить'));
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '1');
    }

    it('поиск существующего документа (searchDocuments), выбор — "Обновление существующего"', async () => {
        const user = userEvent.setup();
        mediaApi.searchDocuments.mockResolvedValue({ ok: true, data: { results: [{ id: 5, external_id: 'passport-777' }] } });
        await openUpload(user);
        await user.type(screen.getByPlaceholderText('Введите название...'), 'pass');
        await waitFor(() => expect(mediaApi.searchDocuments).toHaveBeenCalledWith('1', 'pass'), { timeout: 2000 });
        await user.click(await screen.findByText('passport-777'));
        expect(screen.getByText('↻ Обновление существующего')).toBeInTheDocument();
    });

    it('"+ Создать «query»" — "+ Новый документ"', async () => {
        const user = userEvent.setup();
        mediaApi.searchDocuments.mockResolvedValue({ ok: true, data: { results: [] } });
        await openUpload(user);
        await user.type(screen.getByPlaceholderText('Введите название...'), 'newdoc');
        await user.click(await screen.findByText('+ Создать «newdoc»'));
        expect(screen.getByText('+ Новый документ')).toBeInTheDocument();
    });

    it('standalone тип — свободный слаг, без поиска существующих', async () => {
        const user = userEvent.setup();
        const standaloneType = { id: 2, name: 'Галерея', upload_mode: 'standalone' };
        mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [docType1, standaloneType], axes: [] }));
        mediaApi.getDocuments.mockResolvedValue(ok({ documents: [] }));
        render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
        await screen.findByText('Документов пока нет');
        await user.click(screen.getByText('+ Загрузить'));
        await user.selectOptions(screen.getByText('— выберите —').closest('select'), '2');

        const slugInput = screen.getByPlaceholderText('hero-1, hero-2...');
        await user.type(slugInput, 'hero-1');
        expect(mediaApi.searchDocuments).not.toHaveBeenCalled();
        expect(screen.getByText('+ Новый документ')).toBeInTheDocument();
    });

    it('недопустимый тип файла отклоняется с сообщением', async () => {
        const user = userEvent.setup();
        await openUpload(user);
        const dropzone = screen.getByText('Перетащите файл сюда').closest('div');
        const badFile = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
        fireEvent.drop(dropzone, { dataTransfer: { files: [badFile] } });
        expect(await screen.findByText(/Допустимы PDF, изображения, STL, OBJ, GLTF, GLB, STEP и RVT\/RFA/)).toBeInTheDocument();
    });

    it('одиночная загрузка: успех показывает сообщение, затем закрывает панель с задержкой', async () => {
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, path: '/media/a.pdf' }));
        const user = userEvent.setup();
        await openUpload(user);
        await user.type(screen.getByPlaceholderText('Введите название...'), 'passport-900');
        await user.click(await screen.findByText('+ Создать «passport-900»'));
        const dropzone = screen.getByText('Перетащите файл сюда').closest('div');
        const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

        // fake timers включаем только сейчас — дальше только fireEvent (userEvent виснет под fake timers)
        vi.useFakeTimers();
        fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

        await vi.waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalledWith('1', 'passport-900', file));
        await vi.waitFor(() => expect(screen.getByText('✓ Загружен: /media/a.pdf')).toBeInTheDocument());
        // Панель ещё не закрыта — сообщение должно быть видно какое-то время
        expect(screen.getByText('Загрузка документа')).toBeInTheDocument();

        await vi.advanceTimersByTimeAsync(1500);
        expect(screen.queryByText('Загрузка документа')).not.toBeInTheDocument();
    });

    it('converting:true — показывает сообщение о конвертации STEP и НЕ закрывает панель автоматически', async () => {
        const user = userEvent.setup();
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, converting: true }));
        await openUpload(user);
        await user.type(screen.getByPlaceholderText('Введите название...'), 'passport-901');
        await user.click(await screen.findByText('+ Создать «passport-901»'));
        const dropzone = screen.getByText('Перетащите файл сюда').closest('div');
        fireEvent.drop(dropzone, { dataTransfer: { files: [new File(['x'], 'a.step')] } });
        await user.click(screen.getByRole('button', { name: 'Загрузить' }));

        expect(await screen.findByText(/конвертация в GLB/)).toBeInTheDocument();
        // Регрессия на исправленный баг: раньше onUploaded() вызывался безусловно
        // и панель закрывалась в том же батче, до того как сообщение успевало отрендериться
        expect(screen.getByText('Загрузка документа')).toBeInTheDocument();
    });

    it('множественная загрузка: цикл по файлам, результаты по каждому, панель не закрывается при частичной ошибке', async () => {
        const user = userEvent.setup();
        mediaApi.uploadDocument
            .mockResolvedValueOnce(ok({ success: true }))
            .mockResolvedValueOnce({ ok: false, data: { success: false, error: 'Ошибка Б' } });
        await openUpload(user);
        await user.type(screen.getByPlaceholderText('Введите название...'), 'passport-902');
        await user.click(await screen.findByText('+ Создать «passport-902»'));
        const dropzone = screen.getByText('Перетащите файл сюда').closest('div');
        const fileA = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        const fileB = new File(['x'], 'b.pdf', { type: 'application/pdf' });
        fireEvent.drop(dropzone, { dataTransfer: { files: [fileA, fileB] } });
        expect(await screen.findByText('2 файлов выбрано')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Загрузить 2 файлов/ }));
        await waitFor(() => expect(mediaApi.uploadDocument).toHaveBeenCalledTimes(2));
        expect(await screen.findByText(/Ошибка Б/)).toBeInTheDocument();
        expect(screen.getByText('Загрузка документа')).toBeInTheDocument();
    });
});
