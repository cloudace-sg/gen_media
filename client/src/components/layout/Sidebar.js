import React from 'react';
import { NavLink } from 'react-router-dom';
import { Image as ImageIcon, Palette, Users, CreditCard, LogOut, User, FolderOpen } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';

const IconItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    title={label}
    aria-label={label}
    className={({ isActive }) => `group relative w-10 h-10 rounded-lg transition-colors flex items-center justify-center ${isActive ? 'bg-accent text-black' : 'text-dark-text hover:bg-dark-border'}`}
  >
    <Icon className="w-5 h-5" />
    <span className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs bg-dark-surface text-dark-text border border-dark-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-75 shadow-lg">
      {label}
    </span>
  </NavLink>
);

const Sidebar = () => {
  const { user, userRole, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-14 bg-dark-bg border-r border-dark-border overflow-y-auto z-40">
      <div className="flex flex-col gap-2 p-2 pt-4 h-full">
        <IconItem to="/brand" icon={Palette} label="Brand Assets" />
        <IconItem to="/canvas" icon={ImageIcon} label="Creative Canvas" />
        <IconItem to="/files" icon={FolderOpen} label="My Files" />
        <IconItem to="/users" icon={Users} label="Users" />
        <IconItem to="/billing" icon={CreditCard} label="Billing" />
        
        <div className="mt-auto" />
        
        {user && (
          <div className="flex flex-col items-center gap-2 pb-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User className="h-4 w-4 text-gray-600" />
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;


