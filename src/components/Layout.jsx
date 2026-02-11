import React, { useState, useCallback, createContext, useContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

// Toast context
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export default function Layout() {
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
                        <h1>🚛 Transport Manager</h1>
                        <div className="brand-sub">Business Management Suite</div>
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

                        <div className="sidebar-section">Invoicing</div>
                        <NavLink to="/invoicing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🧾</span> Create Invoice
                        </NavLink>
                        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📊</span> Invoice Dashboard
                        </NavLink>

                        <div className="sidebar-section">Settings</div>
                        <NavLink to="/smtp" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">✉️</span> Email Settings
                        </NavLink>
                    </nav>
                </aside>
                <main className="main-content">
                    <Outlet />
                </main>

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
