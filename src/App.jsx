import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { IssuesProvider } from './contexts/IssuesContext.jsx';
import { NotificationsProvider } from './contexts/NotificationsContext.jsx';
import Header from './components/layout/Header';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ActivateForm from './components/auth/ActivateForm';
import TwoFAForm from './components/auth/TwoFAForm';
import FilterTreeGraph from './components/configurator/FilterTree';
import ParameterEditorPage from './pages/ParameterEditorPage';
import StaffPage from './pages/StaffPage';
import DocumentsPage from './pages/DocumentsPage';
import ProductPage from './pages/ProductPage';
import SpecEditorPage from './pages/SpecEditorPage';
import IssuesPage from './pages/IssuesPage.jsx';
import IssueThreadPage from './pages/IssueThreadPage.jsx';
import SpecPreviewPage from './pages/SpecPreviewPage';
import ModelViewerPage from './pages/ModelViewerPage';
import PLMPage from './pages/PLMPage';
import PartEditorPage from './pages/PartEditorPage';

// AuthPage без изменений — твой существующий код
function AuthPage() {
  const [screen, setScreen] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [twoFA, setTwoFA] = useState({ method: '', message: '' });
  const [successMsg, setSuccessMsg] = useState('');

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                      border border-gray-200 dark:border-gray-700 w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            Тепломаш
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
              onSuccess={() => { }}
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
              onSuccess={() => { }}
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
  const [page, setPage] = useState(() => {
    const path = window.location.pathname.slice(1); // 'staff', 'documents', etc.
    return path || 'configurator';
  });
  const [selectedProductId, setSelectedProductId] = useState(() => {
    const path = window.location.pathname.slice(1);
    if (path === 'product') {
      return sessionStorage.getItem('selectedProductId') || null;
    }
    return null;
  });
  const [specEditorProductIds, setSpecEditorProductIds] = useState([]);
  const [specEditorSessionId, setSpecEditorSessionId] = useState(null);
  const [specEditorInitialChanges, setSpecEditorInitialChanges] = useState({});
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [specPreviewProductIds, setSpecPreviewProductIds] = useState(() => {
    const path = window.location.pathname.slice(1);
    if (path === 'spec-preview') {
      const saved = sessionStorage.getItem('specPreviewProductIds');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [modelViewerFile, setModelViewerFile] = useState(null);

  const handleNavigate = (newPage, payload = null) => {
    setPage(newPage);
    window.history.pushState({ page: newPage, payload }, '', `/${newPage}`);

    if (newPage === 'product') {
      setSelectedProductId(payload);
      if (payload) sessionStorage.setItem('selectedProductId', payload);  // ← добавить
    }
    if (newPage === 'issue-thread') setSelectedThreadId(payload);
    if (newPage === 'spec-preview' && payload !== null) {
      setSpecPreviewProductIds(payload);
      sessionStorage.setItem('specPreviewProductIds', JSON.stringify(payload));  // ← добавить
    }
    if (newPage === 'model-viewer' && payload !== null) {
      setModelViewerFile(payload);
    }
    if (newPage === 'spec-editor' && payload !== null) {
      setSpecEditorProductIds(payload);
      setSpecEditorSessionId(null);
      setSpecEditorInitialChanges({});
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const newPage = e.state?.page || 'configurator';
      const payload = e.state?.payload || null;
      setPage(newPage);
      if (newPage === 'product') setSelectedProductId(payload);
      if (newPage === 'issue-thread') setSelectedThreadId(payload);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    window.history.replaceState(
      { page, payload: selectedProductId || selectedThreadId || null },
      '',
      `/${page}`
    );
  }, []);

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

  const PUBLIC_PAGES = ['configurator', 'product'];
  return (
    <>
        {page === 'model-viewer' && modelViewerFile ? (
            <ModelViewerPage
                relPath={modelViewerFile.relPath}
                fname={modelViewerFile.fname}
                mtlPath={modelViewerFile.mtlPath || null}
                onBack={() => handleNavigate('documents')}
            />
        ) : (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col">
                <Header currentPage={page} onNavigate={handleNavigate} />
                <main className={`flex-1 ${page === 'issue-thread' ? 'px-0 py-4' : 'px-4 py-6'}`}>
                    {/* весь остальной контент без model-viewer */}
                    {page === 'plm' && <PLMPage onOpenProduct={(id) => handleNavigate('product', id)} />}
                    {page === 'part-editor' && <PartEditorPage />}
                    {page === 'configurator' && (
                        <FilterTreeGraph
                            onOpenSpecEditor={ids => handleNavigate('spec-editor', ids)}
                            onOpenSpecPreview={ids => handleNavigate('spec-preview', ids)}
                        />
                    )}
                    {page === 'product' && (
                        <ProductPage
                            productId={selectedProductId}
                            onBack={() => handleNavigate('configurator')}
                            onOpenThread={(id) => handleNavigate('issue-thread', id)}
                            onOpenViewer={payload => handleNavigate('model-viewer', payload)}
                        />
                    )}
                    {!user.is_confirmed && !PUBLIC_PAGES.includes(page) && (
                        <div className="max-w-sm mx-auto text-center py-16">
                            <div className="text-4xl mb-4">⏳</div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                Ожидание подтверждения
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Ваша заявка на вступление в подразделение отправлена руководителю.
                                Доступ к порталу будет открыт после подтверждения.
                            </p>
                        </div>
                    )}
                    {user.is_confirmed && (
                        <>
                            {page === 'parameters' && <ParameterEditorPage />}
                            {page === 'staff' && <StaffPage />}
                            {page === 'documents' && <DocumentsPage onOpenViewer={payload => handleNavigate('model-viewer', payload)} />}
                            {page === 'spec-preview' && (
                                <SpecPreviewPage
                                    productIds={specPreviewProductIds}
                                    onBack={() => handleNavigate('configurator')}
                                    onOpenEditor={(ids) => handleNavigate('spec-editor', ids)}
                                    onOpenViewer={payload => handleNavigate('model-viewer', payload)}
                                />
                            )}
                            {page === 'spec-editor' && (
                                <SpecEditorPage
                                    productIds={specEditorProductIds}
                                    sessionId={specEditorSessionId}
                                    initialChanges={specEditorInitialChanges}
                                    onBack={() => handleNavigate('configurator')}
                                    onReset={() => {
                                        setSpecEditorSessionId(null);
                                        setSpecEditorInitialChanges({});
                                        setActiveSession(null);
                                        handleNavigate('configurator');
                                    }}
                                    onSessionSaved={(id) => {
                                        setSpecEditorSessionId(id);
                                        setActiveSession(prev => prev ? { ...prev, id } : null);
                                    }}
                                />
                            )}
                            {page === 'issues' && <IssuesPage onOpenThread={(id) => handleNavigate('issue-thread', id)} />}
                            {page === 'issue-thread' && (
                                <IssueThreadPage
                                    threadId={selectedThreadId}
                                    onBack={() => handleNavigate('issues')}
                                />
                            )}
                        </>
                    )}
                </main>
            </div>
        )}
    </>
);
}

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm">Загрузка...</div>
      </div>
    );
  }

  // Если пользователь залогинен, оборачиваем MainApp в провайдеры данных.
  // Теперь и "экран ожидания", и "основной экран" будут внутри NotificationsProvider.
  return user ? (
    <NotificationsProvider>
      <IssuesProvider>
        <MainApp />
      </IssuesProvider>
    </NotificationsProvider>
  ) : (
    <AuthPage />
  );
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