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
});

async function renderWithDocs(docs) {
    mediaApi.getDocuments.mockResolvedValue(ok({ documents: docs }));
    const user = userEvent.setup();
    render(<DocumentsPage onOpenViewer={vi.fn()} onFolderUpload={vi.fn()} />);
    await screen.findByText(/Найдено:/);
    await user.click(screen.getByText('Паспорта'));
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
