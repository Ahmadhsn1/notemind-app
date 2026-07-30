import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <div className="fixed z-[-1] top-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full bg-accent opacity-35 blur-[90px] animate-float"></div>
            <div className="fixed z-[-1] bottom-[-60px] right-[-40px] w-[260px] h-[260px] rounded-full bg-growth opacity-25 blur-[90px] animate-float [animation-delay:-3s]"></div>
            <div className="fixed z-[-1] top-[45%] right-[15%] w-[200px] h-[200px] rounded-full bg-growth opacity-20 blur-[90px] animate-float [animation-delay:-6s]"></div>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Production only — in dev, Vite serves unhashed /src/*.jsx module URLs that
// change content on every edit but keep the same URL, and the SW's cache-first
// strategy (see public/sw.js) would silently keep serving the pre-edit version
// forever. Registering only in a real build sidesteps that entirely.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
