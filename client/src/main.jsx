import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <div className="fixed z-[-1] top-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full bg-[#6c5ce7] opacity-35 blur-[90px] animate-float"></div>
        <div className="fixed z-[-1] bottom-[-60px] right-[-40px] w-[260px] h-[260px] rounded-full bg-[#e84393] opacity-25 blur-[90px] animate-float [animation-delay:-3s]"></div>
        <div className="fixed z-[-1] top-[45%] right-[15%] w-[200px] h-[200px] rounded-full bg-[#00cec9] opacity-20 blur-[90px] animate-float [animation-delay:-6s]"></div>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
