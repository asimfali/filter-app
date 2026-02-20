import React, { useState } from 'react';
import { authApi } from '../../api/auth';

export default function ActivateForm({ email: initialEmail, onSuccess }) {
  const [email, setEmail]   = useState(initialEmail || '');
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await authApi.activate(email, code);
    setLoading(false);

    if (result.ok) {
      onSuccess();
      return;
    }

    setError(result.data.error || 'Неверный код или email');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg">
        Код активации отправлен на ваш email. Проверьте папку «Спам».
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Код активации (6 цифр)
        </label>
        <input
          type="text" required autoFocus={!!initialEmail}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-2xl"
          placeholder="000000"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading || code.length !== 6}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                   text-white font-medium py-2 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Проверка...' : 'Активировать'}
      </button>
    </form>
  );
}