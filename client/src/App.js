import React from 'react';
import { useStore } from './store/useStore';
import { AuthProvider, useAuth } from './contexts/auth-context';
import AppShell from './components/layout/AppShell';
import AppRoutes from './routes/AppRoutes';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/auth/LandingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { getBrandKit } from './services/api';

function AppContent() {
  const { 
    selectedImages, 
    isModalOpen, 
    lightboxImage, 
    closeLightbox,
    imageViewer,
    closeImageViewer,
    navigateImageViewer,
    leftDrawerOpen
  } = useStore();
  const { setBrandAssets } = useStore();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    (async () => {
      try {
        const kit = await getBrandKit();
        setBrandAssets(kit);
      } catch (e) {
        // ignore
      }
    })();
  }, [setBrandAssets]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-2 text-dark-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Protected routes - require authentication */}
        <Route path="/*" element={
          !user ? <LandingPage /> : (
            <ProtectedRoute>
              <AppShell>
                <AppRoutes />
              </AppShell>
            </ProtectedRoute>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
