import { useState, useRef } from 'react';
import { mediaApi } from '../../api/media';
import { canPreview3D } from '../../utils/fileUtils';
import { useCommonDocUpload } from '../../hooks/useDocUpload';
import { IconImage, IconFile, IconVideo, IconPdf as PdfIcon } from '../../components/common/Icons';

export function DropZone({ docTypeId, externalId, onUploaded }) {
  const [draggingOver, setDraggingOver] = useState(false);
  const { upload, uploading, uploadResult } = useCommonDocUpload({ onUploaded });

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    await upload(e.dataTransfer.files[0], docTypeId, externalId);
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg
                      border-2 border-dashed py-4 px-3 transition-colors cursor-default
                      ${draggingOver
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
        }`}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
      onDrop={handleDrop}
    >
      {uploading ? (
        <span className="text-xs text-gray-400">Загрузка...</span>
      ) : uploadResult ? (
        <span className={`text-xs ${uploadResult.ok
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500'}`}>
          {uploadResult.message}
        </span>
      ) : draggingOver ? (
        <span className="text-xs text-blue-500">Отпустите для загрузки</span>
      ) : (
        <span className="text-xs text-gray-300 dark:text-gray-600">
          Файлов нет — перетащите для загрузки
        </span>
      )}
    </div>
  );
}

export function AddFileRow({ docTypeId, externalId, onUploaded }) {
  const [draggingOver, setDraggingOver] = useState(false);
  const { upload, uploading, uploadResult } = useCommonDocUpload({ onUploaded });
  const inputRef = useRef(null);

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    await upload(e.dataTransfer.files[0], docTypeId, externalId);
  };

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (f) await upload(f, docTypeId, externalId);
    e.target.value = '';
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
      onDrop={handleDrop}
      className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer
                  border border-dashed transition-colors
                  ${draggingOver
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      {uploading ? (
        <span className="text-xs text-gray-400">Загрузка...</span>
      ) : uploadResult ? (
        <span className={`text-xs ${uploadResult.ok ? 'text-green-600' : 'text-red-500'}`}>
          {uploadResult.message}
        </span>
      ) : draggingOver ? (
        <span className="text-xs text-blue-500">Отпустите для добавления</span>
      ) : (
        <span className="text-xs text-blue-500">+ Добавить файл (или перетащите)</span>
      )}
    </div>
  );
}

export default function FileRow({ file, siblings = [], dimmed = false, canDelete = false,
  onDeleted, onOpenViewer, docTypeId, externalId }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const { upload, uploading, uploadResult } = useCommonDocUpload({ onUploaded: onDeleted });

  const getMtlPath = () => {
    if (!file.name.toLowerCase().endsWith('.obj')) return null;
    const baseName = file.name.replace(/\.obj$/i, '');
    const mtl = siblings.find(s =>
      s.name.toLowerCase() === `${baseName.toLowerCase()}.mtl`
    );
    return mtl?.rel_path || null;
  };

  const handleClick = async (e) => {
    e.preventDefault();

    const name = file.name.toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp)$/.test(name);
    const isPdf = name.endsWith('.pdf');
    const is3D = canPreview3D(name);

    if (is3D) {
      // Открыть в 3D редакторе
      onOpenViewer?.({
        relPath: file.rel_path,
        fname: file.name,
        mtlPath: getMtlPath(),
      });
      return;
    }

    if (isPdf || isImage) {
      // Открыть в новой вкладке
      const res = await mediaApi.downloadFile(file.rel_path);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // Всё остальное — скачать
    const res = await mediaApi.downloadFile(file.rel_path);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const { ok } = await mediaApi.deleteFile(file.rel_path);
    if (ok) onDeleted?.();
    else setDeleting(false);
    setConfirming(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggingOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    await upload(e.dataTransfer.files[0], docTypeId, externalId);
  };

  return (
    <div
      className={`flex flex-col py-2 px-3 rounded-lg transition-colors group
       ${draggingOver
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <a href="#" onClick={handleClick} className="flex items-center gap-2 flex-1 min-w-0">
          {/* Иконка зависит от типа */}
          {(() => {
            const name = file.name.toLowerCase();
            if (canPreview3D(name)) return <span className="text-violet-400 shrink-0">◈</span>;
            if (/\.(jpg|jpeg|png|webp)$/.test(name)) return <IconImage className="text-green-400 shrink-0 w-4 h-4" />;
            if (/\.(webm|mp4)$/.test(name)) return <IconVideo className="text-sky-400 shrink-0 w-4 h-4" />;  // ← добавить
            if (name.endsWith('.pdf')) return <PdfIcon className={`w-5 h-5 shrink-0 ${dimmed ? 'text-gray-300 dark:text-gray-600' : 'text-red-400'}`} />;
            return <IconFile className="text-gray-400 shrink-0 w-4 h-4" />;
          })()}
          <span className={`text-sm truncate ${dimmed
            ? 'text-gray-400 dark:text-gray-500'
            : 'text-gray-700 dark:text-gray-300'}`}>
            {file.name}
          </span>
        </a>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {uploading ? (
            <span className="text-xs text-gray-400">···</span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {file.size}
            </span>
          )}
          <span className="text-xs text-blue-500
                    opacity-0 group-hover:opacity-100 transition-opacity">
            Скачать ↓
          </span>
          {canDelete && (
            confirming ? (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs text-red-600 hover:text-red-800
                              font-medium transition-colors">
                  {deleting ? '···' : 'Удалить?'}
                </button>
                <button onClick={() => setConfirming(false)}
                  className="text-xs text-gray-400 hover:text-gray-600
                              transition-colors">
                  Отмена
                </button>
              </div>
            ) : (
              <button onClick={handleDelete}
                className="text-xs text-gray-300 hover:text-red-500
                          opacity-0 group-hover:opacity-100 transition-all">
                ✕
              </button>
            )
          )}
        </div>
      </div>

      {uploadResult && (
        <div className={`mt-1 text-xs px-1 ${uploadResult.ok
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500 dark:text-red-400'}`}>
          {uploadResult.message}
        </div>
      )}

      {draggingOver && (
        <div className="mt-1 text-xs text-blue-500 dark:text-blue-400 px-1">
          Отпустите для добавления файла
        </div>
      )}
    </div>
  );
}
