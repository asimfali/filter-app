import React, { useState, useEffect } from 'react';
import { authApi } from '../../api/auth';

export default function RegisterForm({ onSuccess }) {
  const [form, setForm] = useState({
    email: '', username: '', password: '',
    first_name: '', last_name: '',
    department_id: '', role_id: '',
  });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);  // ← добавили
  const [roles, setRoles] = useState([]);  // ← добавили

  // Загружаем справочники при монтировании
  useEffect(() => {
    fetch('/api/v1/auth/departments/?root_only=true')
      .then(r => r.json())
      .then(data => setDepartments(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => { });

    fetch('/api/v1/auth/roles/')
      .then(r => r.json())
      .then(data => setRoles(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => { });
  }, []);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const passwordMismatch = passwordConfirm.length > 0 && form.password !== passwordConfirm;
  const passwordMatch = passwordConfirm.length > 0 && form.password === passwordConfirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== passwordConfirm) { setError('Пароли не совпадают'); return; }
    if (form.password.length < 8) { setError('Пароль должен быть не менее 8 символов'); return; }
    if (!form.department_id) { setError('Выберите подразделение'); return; }
    if (!form.role_id) { setError('Выберите роль'); return; }

    setLoading(true);
    const payload = {
      ...form,
      username: form.email,  // ← используем email как username
    };
    const result = await authApi.register(payload);
    setLoading(false);

    if (result.ok) { onSuccess(form.email); return; }

    const firstError = Object.values(result.data?.error?.details || result.data)[0];
    setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
  };

  const inputClass = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm \
focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white";

  // Рекурсивно строим плоский список с отступами для вложенных подразделений
  const flatDepts = (items, depth = 0) => items.flatMap(d => [
    { id: d.id, label: '\u00a0'.repeat(depth * 3) + d.name },
    ...flatDepts(d.children || [], depth + 1),
  ]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Имя + Фамилия */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Имя</label>
          <input type="text" value={form.first_name} onChange={set('first_name')}
            placeholder="Иван" autoComplete="given-name" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Фамилия</label>
          <input type="text" value={form.last_name} onChange={set('last_name')}
            placeholder="Иванов" autoComplete="family-name" className={inputClass} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input type="email" required value={form.email} onChange={set('email')}
          placeholder="you@teplomash.ru" autoComplete="email" className={inputClass} />
      </div>

      {/* Подразделение */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Подразделение <span className="text-red-500">*</span>
        </label>
        <select required value={form.department_id} onChange={set('department_id')} className={inputClass}>
          <option value="">— Выберите подразделение —</option>
          {flatDepts(departments).map(d => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Роль */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Роль <span className="text-red-500">*</span>
        </label>
        <select required value={form.role_id} onChange={set('role_id')} className={inputClass}>
          <option value="">— Выберите роль —</option>
          {roles.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Пароль */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Пароль <span className="text-red-500">*</span>
        </label>
        <input type="password" required value={form.password} onChange={set('password')}
          placeholder="Минимум 8 символов" autoComplete="new-password" className={inputClass} />
      </div>

      {/* Подтверждение пароля */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Подтверждение пароля <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="password" required
            value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="Повторите пароль" autoComplete="new-password"
            className={`${inputClass} ${passwordMismatch ? 'border-red-400 focus:ring-red-400' :
                passwordMatch ? 'border-green-400 focus:ring-green-400' : ''
              }`}
          />
          {passwordMismatch && <span className="absolute right-3 top-2 text-red-500 text-sm">✗</span>}
          {passwordMatch && <span className="absolute right-3 top-2 text-green-500 text-sm">✓</span>}
        </div>
        {passwordMismatch && <p className="text-red-500 text-xs mt-1">Пароли не совпадают</p>}
      </div>

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