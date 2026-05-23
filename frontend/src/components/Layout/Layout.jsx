import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationCenter from '../NotificationCenter/NotificationCenter';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItemStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 14px',
    borderRadius: 'var(--radius)',
    color: isActive ? 'var(--primary)' : 'var(--gray-600)',
    background: isActive ? 'var(--primary-light)' : 'transparent',
    fontWeight: isActive ? '600' : '400',
    fontSize: '14px',
    transition: 'all 0.15s',
    marginBottom: '2px'
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '220px' : '0',
        minWidth: sidebarOpen ? '220px' : '0',
        background: 'white',
        borderRight: '1px solid var(--gray-200)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.2s',
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '10px', height: '60px' }}>
          <span style={{ fontSize: '24px' }}>🏢</span>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--gray-900)' }}>Office Booking</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Room Management</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 6px', marginBottom: '6px' }}>Main</div>

          <NavLink to="/" end style={({ isActive }) => navItemStyle(isActive)}>
            <span>📅</span> Calendar
          </NavLink>

          {hasRole('admin') && (
            <NavLink to="/admin" style={({ isActive }) => navItemStyle(isActive)}>
              <span>⚙️</span> Administration
            </NavLink>
          )}
        </nav>

        {/* User info */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius)', background: 'var(--gray-50)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <span className={`badge badge-${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', marginTop: '6px', justifyContent: 'center', fontSize: '13px' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <header style={{ height: '60px', background: 'white', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', zIndex: 5 }}>
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="btn btn-ghost"
            style={{ padding: '6px 8px', fontSize: '18px' }}
            title="Toggle sidebar"
          >
            ☰
          </button>

          <div style={{ flex: 1 }} />

          <NotificationCenter />
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
