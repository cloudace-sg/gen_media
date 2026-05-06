import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Footer from './Footer';

const AppShell = ({ children }) => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar />
      <div className="ml-14 flex flex-col min-h-screen">
        <main className="flex-1 p-4">
          {children || <Outlet />}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AppShell;


