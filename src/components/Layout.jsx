import React, { useState, useCallback, createContext, useContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import logo from '../assets/logo.svg';

// Toast context
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export default function Layout({ user, onLogout }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            <div className="app-layout">
                <aside className="sidebar">
                    <div className="sidebar-brand">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                            <img src={logo} alt="Logo" style={{ height: '40px', width: 'auto' }} />
                            <h1 style={{ fontSize: '1.2rem', lineHeight: '1.2' }}>Krishna Govinda<br />Tempo Services</h1>
                        </div>
                        <div className="brand-sub">Smart Transport Billing for KGTS & VTS</div>
                    </div>
                    <nav className="sidebar-nav">
                        <div className="sidebar-section">Management</div>
                        <NavLink to="/companies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🏢</span> Companies
                        </NavLink>
                        <NavLink to="/clients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">👥</span> Clients
                        </NavLink>
                        <NavLink to="/entries" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📋</span> Daily Entries
                        </NavLink>
                        <NavLink to="/vehicle-docs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🚗</span> Vehicle Documents
                        </NavLink>

                        <div className="sidebar-section">Invoicing</div>
                        <NavLink to="/invoicing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🧾</span> Create Invoice
                        </NavLink>
                        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📊</span> Invoice Dashboard
                        </NavLink>
                        <NavLink to="/outstanding" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">💰</span> Outstanding
                        </NavLink>

                        <div className="sidebar-section">Payroll</div>
                        <NavLink to="/workers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">👷</span> Workers & Salary
                        </NavLink>

                        {user?.role === 'admin' && (
                            <>
                                <div className="sidebar-section">Settings</div>
                                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <span className="nav-icon">⚙️</span> Settings
                                </NavLink>
                            </>
                        )}
                    </nav>
                </aside>
                <div className="main-wrapper">
                    {/* Top header bar with user info */}
                    {user && (
                        <header className="topbar">
                            <div className="topbar-spacer"></div>
                            <div className="topbar-user">
                                <div className="topbar-user-avatar">{user.name?.[0]?.toUpperCase() || '?'}</div>
                                <div className="topbar-user-details">
                                    <span className="topbar-user-name">{user.name}</span>
                                    <span className="topbar-user-role">@{user.username}</span>
                                </div>
                                <button className="topbar-logout-btn" onClick={onLogout} title="Logout">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                </button>
                            </div>
                        </header>
                    )}
                    <main className="main-content">
                        <Outlet />
                    </main>
                </div>

                {/* Toast notifications */}
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
}
