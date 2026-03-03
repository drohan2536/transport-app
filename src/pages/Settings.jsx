import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

export default function Settings() {
    const showToast = useToast();
    const [activeTab, setActiveTab] = useState('scheduler');

    // SMTP state
    const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, secure: false, username: '', password: '' });
    const [smtpLoading, setSmtpLoading] = useState(true);

    // Scheduler state
    const [schedulerForm, setSchedulerForm] = useState({ scheduler_interval_minutes: 60 });
    const [schedulerLoading, setSchedulerLoading] = useState(true);
    const [schedulerSaving, setSchedulerSaving] = useState(false);

    useEffect(() => {
        api.getSmtp().then(cfg => {
            setSmtpForm({
                host: cfg.host || '',
                port: cfg.port || 587,
                secure: !!cfg.secure,
                username: cfg.username || '',
                password: cfg.password || '',
            });
            setSmtpLoading(false);
        }).catch(e => { showToast(e.message, 'error'); setSmtpLoading(false); });

        api.getSettings().then(s => {
            setSchedulerForm({ scheduler_interval_minutes: s.scheduler_interval_minutes || 60 });
            setSchedulerLoading(false);
        }).catch(e => { showToast(e.message, 'error'); setSchedulerLoading(false); });
    }, []);

    const handleSmtpSave = async (e) => {
        e.preventDefault();
        try {
            await api.updateSmtp(smtpForm);
            showToast('SMTP settings saved');
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleSchedulerSave = async (e) => {
        e.preventDefault();
        setSchedulerSaving(true);
        try {
            const res = await api.updateSettings(schedulerForm);
            setSchedulerForm({ scheduler_interval_minutes: res.scheduler_interval_minutes });
            showToast(`Scheduler updated — checking every ${res.scheduler_interval_minutes} minute(s)`);
        } catch (err) { showToast(err.message, 'error'); }
        setSchedulerSaving(false);
    };

    const updateSmtpField = (field, value) => setSmtpForm(prev => ({ ...prev, [field]: value }));

    const tabs = [
        { id: 'scheduler', label: '⏱️ Scheduler', icon: '⏱️' },
        { id: 'smtp', label: '✉️ Email (SMTP)', icon: '✉️' },
    ];

    const presetIntervals = [
        { label: '5 min', value: 5 },
        { label: '15 min', value: 15 },
        { label: '30 min', value: 30 },
        { label: '1 hour', value: 60 },
        { label: '6 hours', value: 360 },
        { label: '12 hours', value: 720 },
        { label: '24 hours', value: 1440 },
    ];

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">⚙️</span> Settings</h1>
            </div>

            {/* Tab navigation */}
            <div className="settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'settings-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Scheduler Tab */}
            {activeTab === 'scheduler' && (
                <div className="card" style={{ maxWidth: 640 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                        <span style={{ fontSize: '1.5rem' }}>⏱️</span>
                        <h3 style={{ margin: 0 }}>Reminder Scheduler</h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                        Configure how often the system checks for expiring vehicle documents and sends reminder emails automatically.
                    </p>

                    {schedulerLoading ? (
                        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                    ) : (
                        <form onSubmit={handleSchedulerSave}>
                            <div className="form-group">
                                <label className="form-label">Check Interval (minutes)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={schedulerForm.scheduler_interval_minutes}
                                    onChange={e => setSchedulerForm({ scheduler_interval_minutes: parseInt(e.target.value) || 1 })}
                                    placeholder="60"
                                    style={{ maxWidth: 200 }}
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--space-lg)' }}>
                                <label className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Quick Presets</label>
                                <div className="preset-chips">
                                    {presetIntervals.map(p => (
                                        <button
                                            type="button"
                                            key={p.value}
                                            className={`preset-chip ${schedulerForm.scheduler_interval_minutes === p.value ? 'preset-chip-active' : ''}`}
                                            onClick={() => setSchedulerForm({ scheduler_interval_minutes: p.value })}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="scheduler-info-box">
                                <div className="scheduler-info-icon">💡</div>
                                <div>
                                    <strong>How it works:</strong> The scheduler runs in the background and checks all vehicle documents.
                                    When a document's expiry date is within <strong>30 days</strong> (or already expired), it sends an automatic
                                    email reminder. Each document is only reminded once until the reminder flag is reset.
                                </div>
                            </div>

                            <div className="scheduler-current-badge">
                                Current interval: <strong>{schedulerForm.scheduler_interval_minutes} minute(s)</strong>
                                {schedulerForm.scheduler_interval_minutes >= 60 && (
                                    <span> ({(schedulerForm.scheduler_interval_minutes / 60).toFixed(1).replace(/\.0$/, '')} hour(s))</span>
                                )}
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={schedulerSaving}>
                                {schedulerSaving ? '⏳ Saving...' : '💾 Save & Apply'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* SMTP Tab */}
            {activeTab === 'smtp' && (
                <div className="card" style={{ maxWidth: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                        <span style={{ fontSize: '1.5rem' }}>✉️</span>
                        <h3 style={{ margin: 0 }}>SMTP Configuration</h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                        Configure your email server to send invoices and automated reminders to clients.
                    </p>

                    {smtpLoading ? (
                        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                    ) : (
                        <form onSubmit={handleSmtpSave}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">SMTP Host</label>
                                    <input className="form-input" value={smtpForm.host} onChange={e => updateSmtpField('host', e.target.value)} placeholder="smtp.gmail.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Port</label>
                                    <input className="form-input" type="number" value={smtpForm.port} onChange={e => updateSmtpField('port', parseInt(e.target.value) || 587)} placeholder="587" />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="form-check">
                                    <input type="checkbox" id="smtp_secure" checked={smtpForm.secure} onChange={e => updateSmtpField('secure', e.target.checked)} />
                                    <label htmlFor="smtp_secure">Use SSL/TLS (port 465)</label>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Username / Email</label>
                                    <input className="form-input" value={smtpForm.username} onChange={e => updateSmtpField('username', e.target.value)} placeholder="your-email@gmail.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password / App Password</label>
                                    <input className="form-input" type="password" value={smtpForm.password} onChange={e => updateSmtpField('password', e.target.value)} placeholder="••••••••" />
                                </div>
                            </div>

                            <div className="form-hint mb-lg">
                                💡 For Gmail, use an <strong>App Password</strong> (not your regular password).
                                Go to Google Account → Security → 2-Step Verification → App Passwords.
                            </div>

                            <button type="submit" className="btn btn-primary">💾 Save Settings</button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
