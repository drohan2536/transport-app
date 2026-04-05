import React, { useState, useEffect, useRef } from 'react';
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

    // Invoice reset state
    const [companies, setCompanies] = useState([]);
    const [resetCompanyId, setResetCompanyId] = useState('');
    const [resetNewNumber, setResetNewNumber] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [overrides, setOverrides] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);

    // Backup & Restore state
    const [backupInfo, setBackupInfo] = useState(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const fileInputRef = useRef(null);

    // Reset Database state
    const [resetDbLoading, setResetDbLoading] = useState(false);
    const [showResetDbConfirm, setShowResetDbConfirm] = useState(false);
    const [resetDbText, setResetDbText] = useState('');

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

        api.getCompanies().then(setCompanies).catch(() => { });
        loadOverrides();
        loadBackupInfo();
    }, []);

    const loadOverrides = () => {
        api.getInvoiceOverrides().then(setOverrides).catch(() => { });
    };

    const loadBackupInfo = () => {
        api.getBackupInfo().then(setBackupInfo).catch(() => { });
    };

    const handleBackupDownload = () => {
        setBackupLoading(true);
        try {
            api.downloadBackup();
            showToast('Backup download started', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
        setTimeout(() => setBackupLoading(false), 2000);
    };

    const handleRestoreFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.zip')) {
                showToast('Only ZIP files are accepted', 'error');
                e.target.value = '';
                setRestoreFile(null);
                return;
            }
            setRestoreFile(file);
        }
    };

    const handleRestore = async () => {
        setShowRestoreConfirm(false);
        if (!restoreFile) return;
        setRestoreLoading(true);
        try {
            const res = await api.restoreBackup(restoreFile);
            showToast(res.message, 'success');
            setRestoreFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            // Reload the page after a short delay so the UI reflects the restored data
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            showToast(err.message, 'error');
        }
        setRestoreLoading(false);
    };

    const handleResetDatabase = async () => {
        if (resetDbText !== 'RESET') {
            showToast('Please type RESET to confirm', 'error');
            return;
        }
        setShowResetDbConfirm(false);
        setResetDbLoading(true);
        try {
            const res = await api.resetDatabase();
            showToast(res.message, 'success');
            setResetDbText('');
            // Reload the page after a short delay so the UI reflects the reset data
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            showToast(err.message, 'error');
        }
        setResetDbLoading(false);
    };

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

    const handleInvoiceReset = async () => {
        setShowConfirm(false);
        setResetLoading(true);
        try {
            const res = await api.resetInvoiceNumber({ company_id: resetCompanyId, new_number: resetNewNumber });
            showToast(res.message, 'success');
            setResetCompanyId('');
            setResetNewNumber('');
            loadOverrides();
        } catch (err) {
            showToast(err.message, 'error');
        }
        setResetLoading(false);
    };

    const updateSmtpField = (field, value) => setSmtpForm(prev => ({ ...prev, [field]: value }));

    // Get preview of what the next invoice number will look like
    const getPreview = () => {
        if (!resetCompanyId || !resetNewNumber) return null;
        const company = companies.find(c => c.id === parseInt(resetCompanyId));
        if (!company) return null;
        const abbr = (company.abbreviation || '').toUpperCase();
        const parts = resetNewNumber.trim().split('-');
        if (parts.length !== 3) return null;
        const prefix = abbr ? `${abbr}/` : '';
        return `${prefix}${resetNewNumber.trim()}`;
    };

    const tabs = [
        { id: 'scheduler', label: '⏱️ Scheduler', icon: '⏱️' },
        { id: 'smtp', label: '✉️ Email (SMTP)', icon: '✉️' },
        { id: 'invoice', label: '🧾 Challan / Invoice', icon: '🧾' },
        { id: 'backup', label: '💾 Backup & Restore', icon: '💾' },
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

            {/* Invoice / Challan Reset Tab */}
            {activeTab === 'invoice' && (
                <div>
                    <div className="card" style={{ maxWidth: 640 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                            <span style={{ fontSize: '1.5rem' }}>🧾</span>
                            <h3 style={{ margin: 0 }}>Reset Challan / Invoice Number</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Reset the invoice numbering for a specific company. The next invoice created for the selected company will start from the number you specify.
                        </p>

                        <div className="form-group">
                            <label className="form-label">Select Company</label>
                            <select
                                className="form-input"
                                value={resetCompanyId}
                                onChange={e => setResetCompanyId(e.target.value)}
                            >
                                <option value="">— Choose a company —</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.abbreviation ? `(${c.abbreviation})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Starting Number</label>
                            <input
                                className="form-input"
                                value={resetNewNumber}
                                onChange={e => setResetNewNumber(e.target.value)}
                                placeholder="26-27-010"
                                style={{ maxWidth: 280 }}
                            />
                            <div className="form-hint" style={{ marginTop: 6 }}>
                                Format: <strong>FY-FY-SEQ</strong> (e.g. <code>26-27-010</code> for financial year 2026-27, starting at sequence 010)
                            </div>
                        </div>

                        {/* Live Preview */}
                        {getPreview() && (
                            <div style={{
                                padding: '14px 18px',
                                background: 'rgba(34, 197, 94, 0.08)',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>👁️</span>
                                <div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Next invoice will be:
                                    </div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                                        {getPreview()}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="scheduler-info-box" style={{ marginBottom: 'var(--space-lg)' }}>
                            <div className="scheduler-info-icon">⚠️</div>
                            <div>
                                <strong>Important:</strong> This will override the automatic numbering for the selected company.
                                If the new number is lower than the current last invoice number, the system will use whichever is higher
                                to avoid duplicates. The override is applied on the next invoice creation.
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            disabled={!resetCompanyId || !resetNewNumber || resetLoading}
                            onClick={() => setShowConfirm(true)}
                            style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}
                        >
                            {resetLoading ? '⏳ Resetting...' : '🔄 Reset Invoice Number'}
                        </button>
                    </div>

                    {/* Active Overrides */}
                    {overrides.length > 0 && (
                        <div className="card" style={{ maxWidth: 640, marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
                                <span style={{ fontSize: '1.2rem' }}>📋</span>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>Pending Resets</h3>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                                These resets are waiting to be applied on the next invoice creation for each company.
                            </p>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Company</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Next Number</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overrides.map(o => (
                                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '10px 12px', fontSize: '0.88rem', fontWeight: 600 }}>
                                                {o.company_name || o.abbreviation || '(No abbreviation)'}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--warning)' }}>
                                                {o.abbreviation ? `${o.abbreviation}/` : ''}{o.fy_pattern}-{String(o.next_seq).padStart(3, '0')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Confirmation Modal */}
                    {showConfirm && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 32px',
                                maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                animation: 'slideUp 0.2s ease'
                            }}>
                                <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
                                <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>Confirm Reset</h3>
                                <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Are you sure you want to reset the invoice number for{' '}
                                    <strong>{companies.find(c => c.id === parseInt(resetCompanyId))?.name}</strong>{' '}
                                    to start at <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{getPreview()}</strong>?
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button
                                        className="btn"
                                        onClick={() => setShowConfirm(false)}
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleInvoiceReset}
                                        style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}
                                    >
                                        🔄 Yes, Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Backup & Restore Tab */}
            {activeTab === 'backup' && (
                <div>
                    {/* Backup Section */}
                    <div className="card" style={{ maxWidth: 640 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                            <span style={{ fontSize: '1.5rem' }}>📦</span>
                            <h3 style={{ margin: 0 }}>Backup Database</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Download a complete backup of your database as a ZIP file. This includes all your companies, clients, entries, invoices, workers, and settings.
                        </p>

                        {/* Database Info */}
                        {backupInfo && backupInfo.exists && (
                            <div style={{
                                padding: '14px 18px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-lg)',
                                display: 'flex',
                                gap: 24
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Database Size
                                    </div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>
                                        {backupInfo.size_readable}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Last Modified
                                    </div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                        {new Date(backupInfo.last_modified).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={handleBackupDownload}
                            disabled={backupLoading}
                            style={{ gap: 8 }}
                        >
                            {backupLoading ? '⏳ Preparing...' : '⬇️ Download Backup (ZIP)'}
                        </button>
                    </div>

                    {/* Restore Section */}
                    <div className="card" style={{ maxWidth: 640, marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                            <span style={{ fontSize: '1.5rem' }}>🔄</span>
                            <h3 style={{ margin: 0 }}>Restore Database</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Upload a previously downloaded backup ZIP file to restore your database. This will <strong>replace all current data</strong>.
                        </p>

                        <div className="scheduler-info-box" style={{ marginBottom: 'var(--space-lg)', borderColor: 'rgba(220, 38, 38, 0.2)', background: 'rgba(220, 38, 38, 0.05)' }}>
                            <div className="scheduler-info-icon">🚨</div>
                            <div>
                                <strong style={{ color: 'var(--danger)' }}>Warning:</strong> Restoring a backup will <strong>permanently replace</strong> your
                                current database with the backup data. All current data will be lost. Make sure to download a backup of your current
                                data before restoring. The server will restart automatically after a successful restore.
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Backup File (.zip only)</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip"
                                className="form-input"
                                onChange={handleRestoreFileChange}
                                style={{ padding: '10px' }}
                            />
                        </div>

                        {restoreFile && (
                            <div style={{
                                padding: '12px 16px',
                                background: 'rgba(99, 102, 241, 0.06)',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-lg)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <span style={{ fontSize: '1.1rem' }}>📁</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{restoreFile.name}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        {(restoreFile.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            disabled={!restoreFile || restoreLoading}
                            onClick={() => setShowRestoreConfirm(true)}
                            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                        >
                            {restoreLoading ? '⏳ Restoring...' : '⬆️ Restore Database'}
                        </button>
                    </div>

                    {/* Reset Database Section */}
                    <div className="card" style={{ maxWidth: 640, marginTop: '1.5rem', border: '1px solid var(--danger)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-sm)' }}>
                            <span style={{ fontSize: '1.5rem' }}>💥</span>
                            <h3 style={{ margin: 0, color: 'var(--danger)' }}>Reset Database</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
                            Permanently delete all data and reset the database to its initial empty state. <strong>This action cannot be undone.</strong>
                        </p>
                        <button
                            className="btn btn-primary"
                            disabled={resetDbLoading}
                            onClick={() => setShowResetDbConfirm(true)}
                            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                        >
                            {resetDbLoading ? '⏳ Resetting...' : '💥 Reset Database'}
                        </button>
                    </div>

                    {/* Restore Confirmation Modal */}
                    {showRestoreConfirm && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 32px',
                                maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                animation: 'slideUp 0.2s ease'
                            }}>
                                <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>🚨</div>
                                <h3 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--danger)' }}>Confirm Database Restore</h3>
                                <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    You are about to replace your <strong>entire database</strong> with the backup file:
                                </p>
                                <div style={{
                                    textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600,
                                    fontSize: '0.9rem', color: 'var(--text-heading)', marginBottom: '16px',
                                    padding: '8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)'
                                }}>
                                    {restoreFile?.name}
                                </div>
                                <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '20px' }}>
                                    ⚠️ This action cannot be undone. All current data will be lost.
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button
                                        className="btn"
                                        onClick={() => setShowRestoreConfirm(false)}
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleRestore}
                                        style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    >
                                        🚨 Yes, Restore
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reset Database Confirmation Modal */}
                    {showResetDbConfirm && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 32px',
                                maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                animation: 'slideUp 0.2s ease'
                            }}>
                                <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '12px' }}>💥</div>
                                <h3 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--danger)' }}>Confirm Database Reset</h3>
                                <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    You are about to <strong>permanently delete all data</strong>. This action will reset the application to its factory state.
                                </p>
                                <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '20px' }}>
                                    ⚠️ Type 'RESET' below to confirm this action.
                                </p>
                                <div style={{ marginBottom: '20px' }}>
                                    <input
                                        className="form-input"
                                        style={{ textAlign: 'center', border: '1px solid var(--danger)' }}
                                        placeholder="Type RESET"
                                        value={resetDbText}
                                        onChange={(e) => setResetDbText(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                    <button
                                        className="btn"
                                        onClick={() => { setShowResetDbConfirm(false); setResetDbText(''); }}
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleResetDatabase}
                                        disabled={resetDbText !== 'RESET'}
                                        style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    >
                                        💥 Confirm Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
