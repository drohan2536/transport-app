import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Companies from './pages/Companies.jsx';
import Clients from './pages/Clients.jsx';
import Entries from './pages/Entries.jsx';
import Invoicing from './pages/Invoicing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SmtpSettings from './pages/SmtpSettings.jsx';
import VehicleDocuments from './pages/VehicleDocuments.jsx';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Navigate to="/companies" replace />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/entries" element={<Entries />} />
                    <Route path="/invoicing" element={<Invoicing />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/smtp" element={<SmtpSettings />} />
                    <Route path="/vehicle-docs" element={<VehicleDocuments />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
