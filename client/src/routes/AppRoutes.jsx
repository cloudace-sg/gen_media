import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const CanvasPage = React.lazy(() => import('../pages/CanvasPage'));
const BrandAssetsPage = React.lazy(() => import('../pages/BrandAssetsPage'));
const UsersPage = React.lazy(() => import('../pages/UsersPage'));
const BillingPage = React.lazy(() => import('../pages/BillingPage'));
const HelpPage = React.lazy(() => import('../pages/HelpPage'));
const MyFilesPage = React.lazy(() => import('../pages/MyFilesPage'));

const AppRoutes = () => {
  return (
    <React.Suspense fallback={<div className="p-6 text-dark-text-secondary">Loading…</div>}>
      <Routes>
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/brand" element={<BrandAssetsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/files" element={<MyFilesPage />} />
        <Route path="/" element={<Navigate to="/canvas" replace />} />
        <Route path="*" element={<Navigate to="/canvas" replace />} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;


