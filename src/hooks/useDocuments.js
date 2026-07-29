import { useState, useEffect, useCallback } from 'react';
import { mediaApi } from '../api/media';

export function useDocuments(search) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await mediaApi.getDocuments(q);
      if (ok) setDocuments(data.documents || []);
      else setError('Ошибка загрузки документов');
    } catch {
      setError('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  return { documents, loading, error, reload: () => load(search) };
}

export function useFormData() {
  const [docTypes, setDocTypes] = useState([]);
  const [axes, setAxes] = useState([]);

  useEffect(() => {
    mediaApi.getFormData()
      .then(({ ok, data }) => {
        if (ok) {
          setDocTypes(data.doc_types || []);
          setAxes(data.axes || []);   // ← добавить
        }
      });
  }, []);

  return { docTypes, axes };   // ← добавить axes
}
