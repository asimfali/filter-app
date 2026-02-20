import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm({ onSuccess, onNeed2fa, onNeedActivation }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.ok && result.data.access) {
      onSuccess();
      return;
    }

    // 2FA
    if (result.data.requires_2fa) {
      onNeed2fa(email, result.data.method, result.data.message);
      return;
    }

    // Email не подтверждён
    if (result.data.code === 'EMAIL_NOT_CONFIRMED') {
      onNeedActivation(email);
      return;
    }

    setError(result.data.error || result.data.detail || 'Ошибка входа');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email" required autoFocus
          value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="you@teplomash.ru"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
        <input
          type="password" required
          value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
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
        {loading ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
}