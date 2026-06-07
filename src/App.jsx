import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Companies from './pages/Companies.jsx';
import Clients from './pages/Clients.jsx';
import Entries from './pages/Entries.jsx';
import Invoicing from './pages/Invoicing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import VehicleDocuments from './pages/VehicleDocuments.jsx';
import Outstanding from './pages/Outstanding.jsx';
import Workers from './pages/Workers.jsx';
import Login from './pages/Login.jsx';

export default function App() {
    const [user, setUser] = useState(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Check if user is already logged in
        const token = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('auth_user');
        if (token && savedUser) {
            // Verify token is still valid
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => {
                    if (!res.ok) throw new Error('Invalid token');
                    const ct = res.headers.get('content-type') || '';
                    if (!ct.includes('application/json')) throw new Error('Server unavailable');
                    return res.json();
                })
                .then(data => {
                    setUser(data.user);
                    setChecking(false);
                })
                .catch(() => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_user');
                    setChecking(false);
                });
        } else {
            setChecking(false);
        }
    }, []);

    const handleLogin = (userData, token) => {
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setUser(null);
    };

    if (checking) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout user={user} onLogout={handleLogout} />}>
                    <Route path="/" element={<Navigate to="/entries" replace />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/entries" element={<Entries />} />
                    <Route path="/invoicing" element={<Invoicing />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/outstanding" element={<Outstanding />} />
                    <Route path="/workers" element={<Workers />} />
                    <Route path="/settings" element={user?.role === 'admin' ? <Settings /> : <Navigate to="/entries" replace />} />
                    <Route path="/smtp" element={user?.role === 'admin' ? <Settings /> : <Navigate to="/entries" replace />} />
                    <Route path="/vehicle-docs" element={<VehicleDocuments />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
