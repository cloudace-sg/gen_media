import React from 'react';
import PageHeader from '../components/ui/PageHeader';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { listUsers, setUserRole as apiSetUserRole, setUserDisabled as apiSetUserDisabled, deleteUser as apiDeleteUser, postSignIn, inviteUser } from '../services/api';

// Local user management - hardcoded admins
const ADMIN_EMAILS = new Set(['minhngo@cloud-ace.com', 'tan.phamduy@cloud-ace.com', 'tanpham@cloud-ace.com']);
const ADMIN_CONTACT_LIST = Array.from(ADMIN_EMAILS).join(', ');

// Initialize with some sample users
const getInitialUsers = () => {
  const saved = localStorage.getItem('localUsers');
  if (saved) {
    return JSON.parse(saved);
  }
  return [
    {
      id: '1',
      email: 'minhngo@cloud-ace.com',
      displayName: 'Minh Ngo',
      role: 'admin',
      disabled: false,
      lastSignIn: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      email: 'tan.phamduy@cloud-ace.com',
      displayName: 'Tan Pham Duy',
      role: 'admin',
      disabled: false,
      lastSignIn: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      email: 'tanpham@cloud-ace.com',
      displayName: 'Tan Pham',
      role: 'admin',
      disabled: false,
      lastSignIn: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      email: 'user1@example.com',
      displayName: 'User One',
      role: 'editor',
      disabled: false,
      lastSignIn: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: '3',
      email: 'user2@example.com',
      displayName: 'User Two',
      role: 'editor',
      disabled: true,
      lastSignIn: new Date(Date.now() - 259200000).toISOString(),
      createdAt: new Date(Date.now() - 345600000).toISOString()
    }
  ];
};

export default function UsersPage() {
  const { user, userRole } = useAuth();
  const [users, setUsers] = React.useState(getInitialUsers);
  const [q, setQ] = React.useState('');
  const [role, setRole] = React.useState('all');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [confirmDisable, setConfirmDisable] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [showAddUser, setShowAddUser] = React.useState(false);
  const [newUser, setNewUser] = React.useState({ email: '', displayName: '', role: 'editor' });
  const isProd = process.env.NODE_ENV === 'production';
  
  
  // Check if current user exists in local users and is not disabled
  const currentLocalUser = React.useMemo(() => {
    if (!user?.email) return null;
    return users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
  }, [user?.email, users]);
  
  const isCurrentUserDisabled = currentLocalUser?.disabled || false;

  // Determine admin privileges: hardcoded allowlist OR local role OR Firebase custom claim role
  const isAdmin = React.useMemo(() => {
    const emailIsAllowlisted = ADMIN_EMAILS.has((user?.email || '').toLowerCase());
    const localRoleIsAdmin = (currentLocalUser?.role || '').toLowerCase() === 'admin';
    const claimRoleIsAdmin = (userRole || '').toLowerCase() === 'admin';
    return emailIsAllowlisted || localRoleIsAdmin || claimRoleIsAdmin;
  }, [user?.email, currentLocalUser?.role, userRole]);

  // Save users to localStorage whenever users change
  React.useEffect(() => {
    localStorage.setItem('localUsers', JSON.stringify(users));
    // Dispatch custom event to notify auth context to refresh user role
    window.dispatchEvent(new Event('localUsersUpdated'));
  }, [users]);

  // In production, load users from server (Firebase Admin) when admin
  const loadFromServer = React.useCallback(async () => {
    if (!isProd) return;
    if (!user) return;
    if (!ADMIN_EMAILS.has((user?.email || '').toLowerCase()) && (userRole || '').toLowerCase() !== 'admin' && (currentLocalUser?.role || '').toLowerCase() !== 'admin') {
      return;
    }
    setLoading(true);
    setError('');
    try {
      // ensure custom claims are set; safe no-op if already set
      await postSignIn();

      const params = {};
      if (q) params.query = q;
      if (role && role !== 'all') params.role = role;
      const { users: serverUsers = [] } = await listUsers(params);
      const mapped = serverUsers.map(u => ({
        id: u.uid,
        email: u.email,
        displayName: u.displayName || '',
        role: u.role ?? null,
        disabled: !!u.disabled,
        lastSignIn: u.lastSignIn || null,
        createdAt: u.created || null,
      }));
      setUsers(mapped);
    } catch (e) {
      console.error('Load users failed:', e);
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [isProd, user, userRole, currentLocalUser?.role, q, role]);

  React.useEffect(() => {
    if (isProd && !isCurrentUserDisabled) {
      loadFromServer();
    }
  }, [isProd, isCurrentUserDisabled, loadFromServer]);

  // Derive visible users from filters to avoid mutating source users (prevents render loops)
  const visibleUsers = React.useMemo(() => {
    let filtered = users;
    if (q) {
      const ql = q.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(ql) ||
        (u.displayName && u.displayName.toLowerCase().includes(ql))
      );
    }
    if (role !== 'all') {
      filtered = filtered.filter(u => u.role === role);
    }
    return filtered;
  }, [users, q, role]);

  const formatLastSignIn = React.useCallback((dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(new Date(dateStr));
    } catch (_) {
      return new Date(dateStr).toLocaleString();
    }
  }, []);

  const addUser = async () => {
    if (!newUser.email || !newUser.displayName) {
      setError('Email and display name are required');
      return;
    }

    if (users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      setError('User with this email already exists');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (isProd) {
        await inviteUser({ email: newUser.email, displayName: newUser.displayName, role: newUser.role });
        await loadFromServer();
      } else {
        const user = {
          id: Date.now().toString(),
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
          disabled: false,
          lastSignIn: null,
          createdAt: new Date().toISOString()
        };
        setUsers(prev => [...prev, user]);
      }
      setNewUser({ email: '', displayName: '', role: 'editor' });
      setShowAddUser(false);
    } catch (e) {
      setError(e?.message || 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserDisabled = async (userId, disabled) => {
    if (isProd) {
      try {
        setLoading(true);
        await apiSetUserDisabled(userId, disabled);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, disabled } : u));
      } catch (e) {
        setError(e?.message || 'Failed to update status');
      } finally {
        setLoading(false);
      }
    } else {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, disabled } : u
      ));
    }
  };

  const removeUser = async (userId) => {
    if (isProd) {
      try {
        setLoading(true);
        await apiDeleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (e) {
        setError(e?.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8 space-y-6">
      <PageHeader title="Users" subtitle="Manage access and roles" />

      {!user && (
        <div className="text-sm text-red-400">
          Please sign in to access this page.
        </div>
      )}

      {user && isCurrentUserDisabled && (
        <div className="text-sm text-red-400">
          Your account has been disabled. Please contact {ADMIN_CONTACT_LIST} for assistance.
        </div>
      )}

      {user && !isCurrentUserDisabled && !isAdmin && (
        <div className="text-sm text-yellow-400">
          You are signed in as {user.email} but don't have admin privileges. Contact {ADMIN_CONTACT_LIST} for access.
        </div>
      )}

      {isAdmin && !isCurrentUserDisabled && (
        <>
          <div className="flex items-center gap-2">
            <input 
              value={q} 
              onChange={e=>setQ(e.target.value)} 
              placeholder="Search name or email" 
              className="h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text w-64" 
            />
            <RoleFilter value={role} onChange={setRole} />
            <button 
              onClick={() => { /* filtering applies live via state */ }} 
              className="h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-black"
            >
              Search
            </button>
            <button 
              onClick={() => setShowAddUser(true)}
              className="h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white"
            >
              Add User
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-400">{error}</div>
          )}

          <UsersTable
            loading={loading}
            users={visibleUsers}
            isAdmin={isAdmin}
            onChangeRole={async (userId, nextRole) => {
              if (isProd) {
                try {
                  setLoading(true);
                  await apiSetUserRole(userId, nextRole);
                  setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, role: nextRole } : u
                  ));
                } catch (e) {
                  setError(e?.message || 'Failed to update role');
                } finally {
                  setLoading(false);
                }
              } else {
                setUsers(prev => prev.map(u =>
                  u.id === userId ? { ...u, role: nextRole } : u
                ));
              }
            }}
            onToggleDisabled={(userId, disabled) => setConfirmDisable({ userId, disabled })}
            onDelete={(userId) => setConfirmDelete({ userId })}
            formatLastSignIn={formatLastSignIn}
          />

          {showAddUser && (
            <AddUserModal
              user={newUser}
              onChange={setNewUser}
              onConfirm={addUser}
              onCancel={() => {
                setShowAddUser(false);
                setNewUser({ email: '', displayName: '', role: 'editor' });
                setError('');
              }}
            />
          )}

          {confirmDisable && (
            <DisableUserModal
              user={users.find(u => u.id === confirmDisable.userId)}
              disabled={confirmDisable.disabled}
              onConfirm={() => {
                toggleUserDisabled(confirmDisable.userId, confirmDisable.disabled);
                setConfirmDisable(null);
              }}
              onCancel={() => setConfirmDisable(null)}
            />
          )}

          {confirmDelete && (
            <DeleteUserModal
              user={users.find(u => u.id === confirmDelete.userId)}
              onConfirm={() => {
                removeUser(confirmDelete.userId);
                setConfirmDelete(null);
              }}
              onCancel={() => setConfirmDelete(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function RoleFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'all', label: 'All roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' }
  ];

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 rounded-lg bg-dark-bg border border-dark-border text-dark-text hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200 flex items-center justify-between min-w-[120px]"
      >
        <span className="text-sm font-medium">{selectedOption?.label || 'All roles'}</span>
        <ChevronDown className={`w-4 h-4 text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-lg z-50">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-border transition-colors duration-150 ${
                value === option.value ? 'bg-accent/20 text-accent' : 'text-dark-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersTable({ loading, users, isAdmin, onChangeRole, onToggleDisabled, onDelete, formatLastSignIn }) {
  if (loading) return <div className="text-sm text-dark-text-secondary">Loading…</div>;
  return (
    <div className="rounded-2xl border border-dark-border overflow-visible">
      <div className="grid grid-cols-8 text-xs font-medium px-3 py-2 bg-dark-surface border-b border-dark-border text-dark-text-secondary">
        <div className="col-span-2">Name</div>
        <div className="col-span-2">Email</div>
        <div>Role</div>
        <div className="hidden md:block">Status</div>
        <div>Last sign-in</div>
        <div className="text-right pr-2">Actions</div>
      </div>
      {users.map(u => (
        <div key={u.id} className="grid grid-cols-8 items-center px-3 py-2 border-b border-dark-border">
          <div className="col-span-2 text-sm text-dark-text">{u.displayName || '-'}</div>
          <div className="col-span-2 text-sm text-dark-text">{u.email}</div>
          <div>
            {isAdmin ? (
              <UserRoleDropdown
                value={u.role}
                onChange={(next) => onChangeRole && onChangeRole(u.id, next)}
              />
            ) : (
              <span className="text-sm text-dark-text">{u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : '—'}</span>
            )}
          </div>
          <div className="hidden md:block text-sm text-dark-text">{u.disabled ? 'Disabled' : 'Enabled'}</div>
          <div className="text-xs text-dark-text-secondary whitespace-nowrap">{u.lastSignIn ? formatLastSignIn(u.lastSignIn) : '-'}</div>
          <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
            {isAdmin && u.email !== 'minhngo@cloud-ace.com' && (
              <>
                <button 
                  className="h-8 px-3 rounded-lg bg-dark-border text-dark-text hover:bg-gray-200 text-xs sm:text-sm min-w-[70px] whitespace-nowrap" 
                  onClick={()=>onToggleDisabled(u.id, !u.disabled)}
                >
                  {u.disabled ? 'Enable' : 'Disable'}
                </button>
                <button 
                  className="h-8 px-2 sm:px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text hover:bg-gray-200 text-xs sm:text-sm" 
                  onClick={()=>onDelete(u.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


function UserRoleDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [openUpward, setOpenUpward] = React.useState(false);
  const dropdownRef = React.useRef(null);
  const buttonRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const dropdownHeight = 80; // Approximate height of dropdown menu
      
      // Open upward if there's not enough space below but enough space above
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  const options = [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' }
  ];

  const selected = options.find(o => o.value === value) || options[1];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 rounded-lg bg-dark-bg border border-dark-border text-dark-text hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200 flex items-center justify-between min-w-[120px]"
      >
        <span className="text-sm font-medium">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-dark-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} bg-dark-surface border border-dark-border rounded-lg shadow-lg z-[100]`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-border transition-colors duration-150 ${
                value === option.value ? 'bg-accent/20 text-accent' : 'text-dark-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddUserModal({ user, onChange, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-bg p-4">
        <div className="text-base font-medium text-dark-text mb-4">Add New User</div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-dark-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={user.email}
              onChange={(e) => onChange({ ...user, email: e.target.value })}
              className="w-full h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="user@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm text-dark-text-secondary mb-1">Display Name</label>
            <input
              type="text"
              value={user.displayName}
              onChange={(e) => onChange({ ...user, displayName: e.target.value })}
              className="w-full h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm text-dark-text-secondary mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) => onChange({ ...user, role: e.target.value })}
              className="w-full h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button 
            className="h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-black" 
            onClick={onConfirm}
          >
            Add User
          </button>
        </div>
      </div>
    </div>
  );
}

function DisableUserModal({ user, disabled, onConfirm, onCancel }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-bg p-4">
        <div className="text-base font-medium text-dark-text mb-2">
          {disabled ? 'Disable User' : 'Enable User'}
        </div>
        <div className="text-sm text-dark-text-secondary mb-4">
          {disabled ? (
            <>
              Disable <strong>{user.email}</strong>? They will not be able to sign in.
            </>
          ) : (
            <>
              Enable <strong>{user.email}</strong>? They will be able to sign in again.
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button 
            className="h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className={`h-9 px-3 rounded-lg ${disabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
            onClick={onConfirm}
          >
            {disabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onConfirm, onCancel }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-bg p-4">
        <div className="text-base font-medium text-dark-text mb-2">Delete User</div>
        <div className="text-sm text-dark-text-secondary mb-4">
          Permanently delete <strong>{user.email}</strong>? This action cannot be undone.
        </div>
        <div className="flex justify-end gap-2">
          <button 
            className="h-9 px-3 rounded-lg bg-dark-surface border border-dark-border text-dark-text" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white" 
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}



