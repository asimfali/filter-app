// src/components/auth/RegisterForm.jsx

import React, { useState } from 'react';
import { authApi } from '../../api/auth';

export default function RegisterForm({ onSuccess }) {
  const [form, setForm] = useState({
    email: '', username: '', password: '',
    first_name: '', last_name: '', phone: '',
  });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // Совпадают ли пароли
  const passwordMismatch = passwordConfirm.length > 0 && form.password !== passwordConfirm;
  const passwordMatch    = passwordConfirm.length > 0 && form.password === passwordConfirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }

    if (form.password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }

    setLoading(true);
    const result = await authApi.register(form);
    setLoading(false);

    if (result.ok) {
      onSuccess(form.email);
      return;
    }

    const firstError = Object.values(result.data?.error?.details || result.data)[0];
    setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
  };

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm \
focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Имя + Фамилия */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
          <input type="text" value={form.first_name} onChange={set('first_name')}
            placeholder="Иван" autoComplete="given-name" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
          <input type="text" value={form.last_name} onChange={set('last_name')}
            placeholder="Иванов" autoComplete="family-name" className={inputClass} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input type="email" required value={form.email} onChange={set('email')}
          placeholder="you@teplomash.ru" autoComplete="email" className={inputClass} />
      </div>

      {/* Логин */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Логин <span className="text-red-500">*</span>
        </label>
        <input type="text" required value={form.username} onChange={set('username')}
          placeholder="ivanov" autoComplete="username" className={inputClass} />
      </div>

      {/* Пароль */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пароль <span className="text-red-500">*</span>
        </label>
        <input type="password" required value={form.password} onChange={set('password')}
          placeholder="Минимум 8 символов" autoComplete="new-password" className={inputClass} />
      </div>

      {/* Подтверждение пароля */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Подтверждение пароля <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="password" required
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="Повторите пароль" autoComplete="new-password"
            className={`${inputClass} ${
              passwordMismatch ? 'border-red-400 focus:ring-red-400' :
              passwordMatch    ? 'border-green-400 focus:ring-green-400' : ''
            }`}
          />
          {/* Иконка статуса */}
          {passwordMismatch && (
            <span className="absolute right-3 top-2 text-red-500 text-sm">✗</span>
          )}
          {passwordMatch && (
            <span className="absolute right-3 top-2 text-green-500 text-sm">✓</span>
          )}
        </div>
        {passwordMismatch && (
          <p className="text-red-500 text-xs mt-1">Пароли не совпадают</p>
        )}
      </div>

      {/* Телефон */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
        <input type="tel" value={form.phone} onChange={set('phone')}
          placeholder="+7 (999) 000-00-00" autoComplete="tel" className={inputClass} />
      </div>

      {/* Общая ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || passwordMismatch || !form.password || !passwordConfirm}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                   text-white font-medium py-2 rounded-lg transition-colors text-sm mt-2"
      >
        {loading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>

    </form>
  );
}