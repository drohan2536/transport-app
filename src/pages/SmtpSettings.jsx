import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

export default function SmtpSettings() {
    const showToast = useToast();
    const [form, setForm] = useState({ host: '', port: 587, secure: false, username: '', password: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getSmtp().then(cfg => {
            setForm({
                host: cfg.host || '',
                port: cfg.port || 587,
                secure: !!cfg.secure,
                username: cfg.username || '',
                password: cfg.password || '',
            });
            setLoading(false);
        }).catch(e => { showToast(e.message, 'error'); setLoading(false); });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await api.updateSmtp(form);
            showToast('SMTP settings saved');
        } catch (err) { showToast(err.message, 'error'); }
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>;

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">✉️</span> Email Settings</h1>
            </div>

            <div className="card" style={{ maxWidth: 600 }}>
                <h3 style={{ marginBottom: 'var(--space-md)' }}>SMTP Configuration</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                    Configure your email server to send invoices directly to clients.
                </p>

                <form onSubmit={handleSave}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">SMTP Host</label>
                            <input className="form-input" value={form.host} onChange={e => updateField('host', e.target.value)} placeholder="smtp.gmail.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Port</label>
                            <input className="form-input" type="number" value={form.port} onChange={e => updateField('port', parseInt(e.target.value) || 587)} placeholder="587" />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="form-check">
                            <input type="checkbox" id="smtp_secure" checked={form.secure} onChange={e => updateField('secure', e.target.checked)} />
                            <label htmlFor="smtp_secure">Use SSL/TLS (port 465)</label>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Username / Email</label>
                            <input className="form-input" value={form.username} onChange={e => updateField('username', e.target.value)} placeholder="your-email@gmail.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password / App Password</label>
                            <input className="form-input" type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="••••••••" />
                        </div>
                    </div>

                    <div className="form-hint mb-lg">
                        💡 For Gmail, use an <strong>App Password</strong> (not your regular password).
                        Go to Google Account → Security → 2-Step Verification → App Passwords.
                    </div>

                    <button type="submit" className="btn btn-primary">💾 Save Settings</button>
                </form>
            </div>
        </div>
    );
}
