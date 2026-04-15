import React, { useState } from 'react';
import EyeIcon from './EyeIcon';
import { authApi } from '../../api/auth';

const inputClass = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white";

export default function PasswordResetForm({ onBack }) {
  const [step, setStep]         = useState('request'); // 'request' | 'confirm' | 'done'
  const [email, setEmail]       = useState('');
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const mismatch = password2.length > 0 && password !== password2;
  const match    = password2.length > 0 && password === password2;

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await authApi.passwordResetRequest(email);
    setLoading(false);
    // Всегда переходим на следующий шаг — бэк не раскрывает существование email
    setStep('confirm');
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError('Пароли не совпадают'); return; }
    setLoading(true);
    const result = await authApi.passwordResetConfirm(email, code, password, password2);
    setLoading(false);
    if (result.ok && result.data.success) { setStep('done'); return; }
    setError(result.data.error?.message || 'Ошибка');
  };

  if (step === 'done') return (
    <div className="text-center space-y-4">
      <div className="text-green-500 text-4xl">✓</div>
      <p className="text-sm text-gray-700 dark:text-gray-300">Пароль успешно изменён</p>
      <button onClick={onBack}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
        Войти
      </button>
    </div>
  );

  if (step === 'confirm') return (
    <form onSubmit={handleConfirm} className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Код отправлен на <span className="font-medium text-gray-700 dark:text-gray-200">{email}</span>
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Код из письма</label>
        <input type="text" required inputMode="numeric" maxLength={6}
          value={code} onChange={e => setCode(e.target.value)}
          placeholder="123456" className={inputClass} autoFocus />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Новый пароль</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} required
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Минимум 8 символов" autoComplete="new-password"
            className={`${inputClass} pr-9`} />
          <EyeIcon show={showPass} onToggle={() => setShowPass(v => !v)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Повторите пароль</label>
        <div className="relative">
          <input type={showPass2 ? 'text' : 'password'} required
            value={password2} onChange={e => setPassword2(e.target.value)}
            placeholder="Повторите пароль" autoComplete="new-password"
            className={`${inputClass} pr-9 ${mismatch ? 'border-red-400 focus:ring-red-400' : match ? 'border-green-400 focus:ring-green-400' : ''}`} />
          <EyeIcon show={showPass2} onToggle={() => setShowPass2(v => !v)} />
        </div>
        {mismatch && <p className="text-red-500 text-xs mt-1">Пароли не совпадают</p>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

      <button type="submit" disabled={loading || mismatch || !password || !password2}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
        {loading ? 'Сохранение...' : 'Сохранить пароль'}
      </button>
    </form>
  );

  return (
    <form onSubmit={handleRequest} className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Введите email — отправим код для сброса пароля.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@teplomash.ru" autoComplete="email" autoFocus className={inputClass} />
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
        {loading ? 'Отправка...' : 'Отправить код'}
      </button>

      <button type="button" onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1">
        ← Назад
      </button>
    </form>
  );
}