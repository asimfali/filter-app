import React, { useState, useEffect } from 'react';
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
import DocumentsPage from './pages/DocumentsPage';
import ProductPage from './pages/ProductPage';
import SpecEditorPage from './pages/SpecEditorPage';

// AuthPage без изменений — твой существующий код
function AuthPage() {
  const [screen, setScreen] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [twoFA, setTwoFA] = useState({ method: '', message: '' });
  const [successMsg, setSuccessMsg] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm
                      border border-gray-200 dark:border-gray-700 w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            Теплообменное оборудование
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Корпоративный портал
          </div>
        </div>

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm
                          px-3 py-2 rounded-lg mb-4">
            {successMsg}
          </div>
        )}

        {screen === 'login' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Вход</h2>
            <LoginForm
              onSuccess={() => {}}
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
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Регистрация
            </h2>
            <RegisterForm
              onSuccess={(email) => {
                setPendingEmail(email);
                setSuccessMsg('Аккаунт создан! Введите код из письма.');
                setScreen('activate');
              }}
            />
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Активация аккаунта
            </h2>
            <ActivateForm
              email={pendingEmail}
              onSuccess={() => {
                setSuccessMsg('Email подтверждён! Теперь войдите.');
                setScreen('login');
              }}
            />
            <button onClick={() => setScreen('login')}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400
                         hover:text-gray-700 dark:text-gray-300 mt-3">
              ← Назад к входу
            </button>
          </>
        )}

        {screen === '2fa' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Двухфакторная аутентификация
            </h2>
            <TwoFAForm
              email={pendingEmail}
              method={twoFA.method}
              message={twoFA.message}
              onSuccess={() => {}}
              onBack={() => setScreen('login')}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MainApp() {
  const { user, activeSession, setActiveSession } = useAuth();
  const [page, setPage]                           = useState('configurator');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [specEditorProductIds, setSpecEditorProductIds] = useState([]);
  const [specEditorSessionId, setSpecEditorSessionId]   = useState(null);
  const [specEditorInitialChanges, setSpecEditorInitialChanges] = useState({});
  const showWarning = user && !user.is_confirmed;

  // Restore активной сессии при входе
  useEffect(() => {
    if (!activeSession) return;

    const { data, id } = activeSession;
    if (!data?.page) return;

    if (data.page === 'spec-editor' && data.product_ids?.length) {
      setSpecEditorProductIds(data.product_ids);
      setSpecEditorSessionId(id);
      setSpecEditorInitialChanges(data.changes || {});
      setPage('spec-editor');
    }
    // Другие страницы добавляются здесь по мере необходимости
  }, [activeSession]);

  const handleNavigate = (newPage, payload = null) => {
    setPage(newPage);
    if (newPage === 'product') {
      setSelectedProductId(payload);
    }
    if (newPage === 'spec-editor' && payload !== null) {
      // Только если явно переданы новые ids — сбрасываем
      setSpecEditorProductIds(payload);
      setSpecEditorSessionId(null);
      setSpecEditorInitialChanges({});
    }
    // Если payload === null (переход из меню) — не трогаем существующее состояние
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header currentPage={page} onNavigate={handleNavigate} />

      {showWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm
                        px-6 py-2 text-center">
          Ваш аккаунт ожидает назначения роли администратором. Некоторые функции недоступны.
        </div>
      )}

      <main className="flex-1 px-4 py-6">
        {page === 'configurator' && (
          <FilterTreeGraph
            onOpenSpecEditor={ids => handleNavigate('spec-editor', ids)}
          />
        )}
        {page === 'parameters'  && <ParameterEditorPage />}
        {page === 'staff'       && <StaffPage />}
        {page === 'documents'   && <DocumentsPage />}
        {page === 'product'     && (
          <ProductPage
            productId={selectedProductId}
            onBack={() => handleNavigate('configurator')}
          />
        )}
        {page === 'spec-editor' && (
          <SpecEditorPage
            productIds={specEditorProductIds}
            sessionId={specEditorSessionId}
            initialChanges={specEditorInitialChanges}
            onBack={() => handleNavigate('configurator')}
            onSessionSaved={(id) => {
              setSpecEditorSessionId(id);
              setActiveSession(prev => prev ? { ...prev, id } : null);
            }}
          />
        )}
      </main>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm">Загрузка...</div>
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