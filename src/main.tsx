import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoutes from './AppRoutes';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <AppRoutes />
    </React.StrictMode>
  );
}