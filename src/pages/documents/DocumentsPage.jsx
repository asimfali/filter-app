import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { can, PERM } from '../../utils/permissions';
import { useDocuments, useFormData } from '../../hooks/useDocuments';
import { IconFolder } from '../../components/common/Icons';
import { DocumentGroup, declDocs } from './DocumentCard';
import BulkCreateForm from './BulkCreateForm';
import UploadForm from './UploadForm';

export default function DocumentsPage({ onOpenViewer, onFolderUpload }) {
  const { user } = useAuth();
  const canUpload = can(user, PERM.PORTAL_DOCUMENTS_UPLOAD);
  const canDelete = can(user, PERM.PORTAL_DOCUMENTS_DELETE);
  const canManageFilters = can(user, PERM.PORTAL_DOCUMENTS_UPLOAD);
  const [uploadMode, setUploadMode] = useState('single');

  // ← сначала search
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // ← потом хук который search использует
  const { documents, loading, error, reload } = useDocuments(search);
  const { docTypes, axes } = useFormData();

  // Группировка по типу документа
  const groups = documents.reduce((acc, doc) => {
    const key = doc.doc_type?.name ?? 'Без типа';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const totalCount = documents.length;

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4
                      flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Документы</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Паспорта, сертификаты и другие документы
          </p>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(o => !o)}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${showUpload
                ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}>
              {showUpload ? '← Назад' : '+ Загрузить'}
            </button>
            <button onClick={onFolderUpload}
              className="text-sm px-4 py-2 rounded-lg transition-colors
                       bg-neutral-100 dark:bg-neutral-800
                       text-gray-700 dark:text-gray-300
                       hover:bg-neutral-200 dark:hover:bg-neutral-700">
              <IconFolder /> Из папки
            </button>
          </div>
        )}
      </div>

      {showUpload ? (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5 max-w-lg">
          {/* Переключатель */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit mb-4">
            <button onClick={() => setUploadMode('single')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${uploadMode === 'single'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}>
              Загрузить файл
            </button>
            <button onClick={() => setUploadMode('bulk')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${uploadMode === 'bulk'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}>
              Добавить несколько
            </button>
          </div>

          {uploadMode === 'single' && (
            <>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Загрузка документа
              </h3>
              <UploadForm
                docTypes={docTypes}
                onUploaded={() => { reload(); setShowUpload(false); }}
              />
            </>
          )}
          {uploadMode === 'bulk' && (
            <>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Пакетное создание документов
              </h3>
              <BulkCreateForm
                docTypes={docTypes}
                onCreated={reload}
              />
            </>
          )}
        </div>
      ) : (
        <>
          {/* Поиск */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по типу, оси, значению..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                 px-3 py-2 text-sm bg-white dark:bg-neutral-800
                 text-gray-900 dark:text-white
                 placeholder-gray-400 dark:placeholder-gray-500
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {loading && search && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2
                       text-gray-400 text-xs animate-pulse">···</span>
              )}
            </div>
          </div>

          {/* Контент */}
          {loading ? (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8
                            text-center text-gray-400 dark:text-gray-500 text-sm">
              Загрузка...
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                            rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : totalCount === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                {search ? 'Ничего не найдено' : 'Документов пока нет'}
              </p>
              {!search && canUpload && (
                <button onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                             px-4 py-2 rounded-lg transition-colors">
                  + Загрузить первый документ
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Счётчик */}
              <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                Найдено: {totalCount} {declDocs(totalCount)}
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="ml-3 text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Сбросить ×
                  </button>
                )}
              </div>

              {/* Группы */}
              {Object.entries(groups).map(([typeName, items]) => (
                <DocumentGroup
                  key={typeName}
                  typeName={typeName}
                  items={items}
                  canDelete={canDelete}
                  canManageFilters={canManageFilters}
                  axes={axes}
                  onDeleted={reload}
                  onOpenViewer={onOpenViewer}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
