import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function TwoFAForm({ email, method, message, onSuccess, onBack }) {
  const { login2fa } = useAuth();
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login2fa(email, code);
    setLoading(false);

    if (result.ok && result.data.access) {
      onSuccess();
      return;
    }

    setError(result.data.error || 'Неверный код');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-3 py-2 rounded-lg">
        {message}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Код подтверждения
        </label>
        <input
          type="text" required autoFocus
          value={code} onChange={e => setCode(e.target.value)}
          maxLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
          placeholder="000000"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                   text-white font-medium py-2 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Проверка...' : 'Подтвердить'}
      </button>

      <button
        type="button" onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-700"
      >
        ← Назад
      </button>
    </form>
  );
}