import React from 'react';
import UserProfile from './auth/UserProfile';

const Header = () => {
  return (
    <header className="bg-dark-surface border-b border-dark-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-end">
          <UserProfile />
        </div>
      </div>
    </header>
  );
};

export default Header;
