import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Check periodically for automatic service worker updates
        window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);
