import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/layout/Header';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ActivateForm from './components/auth/ActivateForm';
import TwoFAForm from './components/auth/TwoFAForm';
import FilterTreeGraph from './components/FilterTree';
import ParameterEditorPage from './pages/ParameterEditorPage';
import StaffPage from './pages/StaffPage';

// Страница авторизации — объединяет все auth-экраны
function AuthPage() {
  // screen: 'login' | 'register' | 'activate' | '2fa'
  const [screen, setScreen] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [twoFA, setTwoFA] = useState({ method: '', message: '' });
  const [successMsg, setSuccessMsg] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">

        {/* Лого / заголовок */}
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-900">Теплообменное оборудование</div>
          <div className="text-sm text-gray-500 mt-1">Корпоративный портал</div>
        </div>

        {/* Успешное сообщение */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm
                          px-3 py-2 rounded-lg mb-4">
            {successMsg}
          </div>
        )}

        {screen === 'login' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Вход</h2>
            <LoginForm
              onSuccess={() => {/* AuthContext обновит user → App перерендерится */ }}
              onNeed2fa={(email, method, message) => {
                setPendingEmail(email);
                setTwoFA({ method, message });
                setScreen('2fa');
              }}
              onNeedActivation={(email) => {
                setPendingEmail(email);
                setScreen('activate');
              }}
            />
            <p className="text-center text-sm text-gray-500 mt-4">
              Нет аккаунта?{' '}
              <button onClick={() => { setScreen('register'); setSuccessMsg(''); }}
                className="text-blue-600 hover:underline font-medium">
                Зарегистрироваться
              </button>
            </p>
          </>
        )}

        {screen === 'register' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Регистрация</h2>
            <RegisterForm
              onSuccess={(email) => {
                setPendingEmail(email);
                setSuccessMsg('Аккаунт создан! Введите код из письма.');
                setScreen('activate');
              }}
            />
            <p className="text-center text-sm text-gray-500 mt-4">
              Уже есть аккаунт?{' '}
              <button onClick={() => setScreen('login')}
                className="text-blue-600 hover:underline font-medium">
                Войти
              </button>
            </p>
          </>
        )}

        {screen === 'activate' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Активация аккаунта</h2>
            <ActivateForm
              email={pendingEmail}
              onSuccess={() => {
                setSuccessMsg('Email подтверждён! Теперь войдите.');
                setScreen('login');
              }}
            />
            <button
              onClick={() => setScreen('login')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-3"
            >
              ← Назад к входу
            </button>
          </>
        )}

        {screen === '2fa' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Двухфакторная аутентификация</h2>
            <TwoFAForm
              email={pendingEmail}
              method={twoFA.method}
              message={twoFA.message}
              onSuccess={() => {/* user обновится через context */ }}
              onBack={() => setScreen('login')}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Основное приложение (после входа)
function MainApp() {
  const [page, setPage] = useState('configurator');
  const { user } = useAuth();
  const showWarning = user && !user.is_confirmed;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header currentPage={page} onNavigate={setPage} />

      {showWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm
                        px-6 py-2 text-center">
          Ваш аккаунт ожидает назначения роли администратором. Некоторые функции недоступны.
        </div>
      )}

      <main className="flex-1 px-4 py-6">
        {page === 'configurator' && <FilterTreeGraph />}
        {page === 'parameters'   && <ParameterEditorPage />}
        {page === 'staff'        && <StaffPage />}  {/* ← внутри return! */}
      </main>
    </div>
  );
}

// Корень: переключение auth / main
function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Загрузка...</div>
      </div>
    );
  }

  return user ? <MainApp /> : <AuthPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}