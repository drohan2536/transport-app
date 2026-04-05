import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import { buildPdfDefinition, loadLogoBase64, pdfMake } from '../utils/pdfGenerator.js';

export default function Dashboard() {
    const showToast = useToast();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewInvoice, setViewInvoice] = useState(null);

    // Schedule Send state
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleInvoice, setScheduleInvoice] = useState(null);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduling, setScheduling] = useState(false);

    // Scheduled emails list
    const [showScheduledList, setShowScheduledList] = useState(false);
    const [scheduledEmails, setScheduledEmails] = useState([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    const load = async () => {
        setLoading(true);
        try { setInvoices(await api.getInvoices()); }
        catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const loadScheduledEmails = async () => {
        setLoadingScheduled(true);
        try { setScheduledEmails(await api.getScheduledEmails()); }
        catch (e) { showToast(e.message, 'error'); }
        setLoadingScheduled(false);
    };

    const handleDelete = async (inv) => {
        if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
        try {
            await api.deleteInvoice(inv.id);
            showToast('Invoice deleted');
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleTogglePaid = async (inv) => {
        try {
            const result = await api.markPaid(inv.id);
            showToast(`Invoice marked as ${result.status}`);
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleSavePdf = async (inv) => {
        try {
            const full = await api.getInvoice(inv.id);
            const logoBase64 = await loadLogoBase64();

            const docDef = buildPdfDefinition(full, logoBase64);
            pdfMake.createPdf(docDef).getBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Invoice_${full.invoice_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 1000);
                showToast('PDF downloaded successfully! 🎉');
            });
        } catch (e) {
            console.error('PDF Generation Error:', e);
            showToast('Failed to generate PDF: ' + e.message, 'error');
        }
    };

    const handleEmail = async (inv) => {
        try {
            const full = await api.getInvoice(inv.id);
            if (!full.client_email) {
                showToast('No email found for this client', 'error');
                return;
            }

            const logoBase64 = await loadLogoBase64();

            // Generate PDF as base64 using already-initialized pdfMake
            const docDef = buildPdfDefinition(full, logoBase64);
            pdfMake.createPdf(docDef).getBase64(async (base64) => {
                try {
                    await api.emailInvoice(inv.id, base64);
                    showToast(`Invoice emailed to ${full.client_email} ✉️`);
                } catch (e) {
                    console.error('Email Error:', e);
                    showToast('Failed to email invoice: ' + e.message, 'error');
                }
            });
        } catch (e) {
            console.error('PDF Generation Error (Email):', e);
            showToast('Failed to prepare email: ' + e.message, 'error');
        }
    };

    // ─── Schedule Send ─────────────────
    const openScheduleModal = (inv) => {
        setScheduleInvoice(inv);
        // Default to tomorrow, 9 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduleDate(tomorrow.toISOString().split('T')[0]);
        setScheduleTime('09:00');
        setShowScheduleModal(true);
    };

    const handleScheduleSend = async () => {
        if (!scheduleDate || !scheduleTime) {
            showToast('Please select both date and time', 'error');
            return;
        }

        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
        if (scheduledAt <= new Date()) {
            showToast('Scheduled time must be in the future', 'error');
            return;
        }

        setScheduling(true);
        try {
            const full = await api.getInvoice(scheduleInvoice.id);
            if (!full.client_email) {
                showToast('No email found for this client', 'error');
                setScheduling(false);
                return;
            }

            const logoBase64 = await loadLogoBase64();
            const docDef = buildPdfDefinition(full, logoBase64);

            pdfMake.createPdf(docDef).getBase64(async (base64) => {
                try {
                    await api.scheduleEmail(scheduleInvoice.id, scheduledAt.toISOString(), base64);
                    showToast(`📅 Email scheduled for ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
                    setShowScheduleModal(false);
                    setScheduleInvoice(null);
                } catch (e) {
                    showToast('Failed to schedule email: ' + e.message, 'error');
                } finally {
                    setScheduling(false);
                }
            });
        } catch (e) {
            showToast('Failed to prepare email: ' + e.message, 'error');
            setScheduling(false);
        }
    };

    const handleCancelScheduled = async (id) => {
        if (!confirm('Cancel this scheduled email?')) return;
        try {
            await api.cancelScheduledEmail(id);
            showToast('Scheduled email cancelled');
            loadScheduledEmails();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleView = async (inv) => {
        try {
            const full = await api.getInvoice(inv.id);
            setViewInvoice(full);
        } catch (e) { showToast(e.message, 'error'); }
    };

    // Stats
    const totalPaid = invoices.filter(i => i.status === 'paid').length;
    const totalUnpaid = invoices.filter(i => i.status === 'unpaid').length;
    const totalRevenue = invoices.reduce((s, i) => s + (i.final_amount || 0), 0);
    const paidRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.final_amount || 0), 0);

    // Minimum datetime for schedule picker (now + 5 min)
    const minDate = new Date().toISOString().split('T')[0];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="badge badge-warning">⏳ Pending</span>;
            case 'sent': return <span className="badge badge-success">✅ Sent</span>;
            case 'failed': return <span className="badge badge-danger" style={{ background: '#fef2f2', color: '#dc2626' }}>❌ Failed</span>;
            case 'cancelled': return <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>🚫 Cancelled</span>;
            default: return <span className="badge">{status}</span>;
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">📊</span> Invoice Dashboard</h1>
                <button
                    className="btn btn-secondary"
                    onClick={() => { setShowScheduledList(true); loadScheduledEmails(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    📅 Scheduled Emails
                </button>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon">📄</div>
                    <div>
                        <div className="stat-value">{invoices.length}</div>
                        <div className="stat-label">Total Invoices</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--success-bg)' }}>✅</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--success)' }}>{totalPaid}</div>
                        <div className="stat-label">Paid</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--warning-bg)' }}>⏳</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>{totalUnpaid}</div>
                        <div className="stat-label">Unpaid</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--info-bg)' }}>💰</div>
                    <div>
                        <div className="stat-value">₹{totalRevenue.toFixed(0)}</div>
                        <div className="stat-label">Total Revenue</div>
                    </div>
                </div>
            </div>

            {/* Invoice Table */}
            {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : invoices.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <p>No invoices yet. Create your first invoice from the Create Invoice page.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Client</th>
                                <th>Company</th>
                                <th>Date</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id}>
                                    <td>
                                        <span className="font-mono" style={{ color: 'var(--accent-primary-hover)', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleView(inv)}>
                                            {inv.invoice_number}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.client_name}</td>
                                    <td><span className="badge badge-info">{inv.company_name}</span></td>
                                    <td className="font-mono">{inv.invoice_date}</td>
                                    <td className="text-right font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{(inv.final_amount || 0).toFixed(2)}</td>
                                    <td>
                                        {inv.status === 'paid'
                                            ? <span className="badge badge-success">✓ Paid</span>
                                            : <span className="badge badge-warning">Unpaid</span>
                                        }
                                    </td>
                                    <td>
                                        <div className="actions-group">
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleView(inv)} title="View">👁️</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleSavePdf(inv)} title="Download PDF">📥</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(inv)} title="Send Email Now">✉️</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openScheduleModal(inv)} title="Schedule Email" style={{ position: 'relative' }}>
                                                📅
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleTogglePaid(inv)} title={inv.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}>
                                                {inv.status === 'paid' ? '↩️' : '✅'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(inv)} title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invoice View Modal */}
            {viewInvoice && (
                <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
                        <div className="modal-header">
                            <h2>Invoice {viewInvoice.invoice_number}</h2>
                            <button className="modal-close" onClick={() => setViewInvoice(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="invoice-preview">
                                {/* Sanskrit Header */}
                                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                                    ॥ श्री कृष्णं वन्दे जगद्गुरुम् ॥
                                </div>

                                {/* Company Name */}
                                <div className="inv-header">
                                    <h1 style={{ margin: '4px 0' }}>{viewInvoice.company_name}</h1>
                                    <p style={{ margin: '2px 0' }}>{viewInvoice.company_address}{viewInvoice.company_phone ? `. Mob. no. : ${viewInvoice.company_phone}` : ''}</p>
                                </div>

                                {/* Client Name + Bill Number */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0 2px' }}>
                                    <div><span>Company Name :-&nbsp;&nbsp;</span><strong style={{ fontSize: '1.05rem' }}>{viewInvoice.client_name}</strong></div>
                                    <div><span>Bill no. :&nbsp;</span><strong style={{ fontSize: '1.05rem' }}>{viewInvoice.invoice_number}</strong></div>
                                </div>

                                {/* Client Address */}
                                {viewInvoice.client_address && (
                                    <div style={{ marginBottom: 4, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                                        {viewInvoice.client_address}
                                    </div>
                                )}

                                {/* Date */}
                                <div style={{ textAlign: 'right', marginBottom: 12 }}>
                                    <span>Date&nbsp;&nbsp;:&nbsp;&nbsp;</span><strong>{viewInvoice.invoice_date}</strong>
                                    {viewInvoice.from_date && viewInvoice.to_date && (
                                        <span style={{ marginLeft: 16, fontSize: '0.85rem', color: '#888' }}>
                                            (Period: {viewInvoice.from_date} to {viewInvoice.to_date})
                                        </span>
                                    )}
                                </div>

                                {/* Bordered Table */}
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center' }}>Sr. no.</th>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px' }}>Date</th>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px' }}>From</th>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px' }}>To</th>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px' }}>Weight / Bundles</th>
                                            <th style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(viewInvoice.entries || []).map((e, i) => (
                                            <tr key={e.id}>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px', textAlign: 'center' }}>{i + 1}.</td>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{e.date}</td>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{e.from_location || '—'}</td>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px' }}>{e.to_location || '—'}</td>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px' }}>
                                                    {e.entry_type === 'per_kg'
                                                        ? (e.weight ? `${e.weight} Kg` : '—')
                                                        : (e.no_of_bundles ? `${e.no_of_bundles} Bundles` : '—')}
                                                </td>
                                                <td style={{ border: '1px solid #333', padding: '5px 8px', textAlign: 'right' }}>
                                                    {(e.total_amount || 0).toFixed(2)}/-
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Total Amount Row */}
                                        {(() => {
                                            const entriesTotal = (viewInvoice.entries || []).reduce((sum, e) => sum + (e.total_amount || 0), 0);
                                            const hasAdj = viewInvoice.adjustment_type && viewInvoice.adjustment_amount > 0;
                                            return (
                                                <>
                                                    <tr>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                        <td colSpan={4} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>
                                                            Total Amount
                                                        </td>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
                                                            {hasAdj ? entriesTotal.toFixed(2) : (viewInvoice.final_amount || 0).toFixed(2)}/-
                                                        </td>
                                                    </tr>
                                                    {hasAdj && (
                                                        <>
                                                            <tr>
                                                                <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                                <td colSpan={4} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 600, fontSize: '0.95rem', color: viewInvoice.adjustment_type === 'addition' ? '#16a34a' : '#dc2626' }}>
                                                                    {viewInvoice.adjustment_type === 'addition' ? 'Adding' : 'Subtracting'} ({viewInvoice.adjustment_reason})
                                                                </td>
                                                                <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: '0.95rem', color: viewInvoice.adjustment_type === 'addition' ? '#16a34a' : '#dc2626' }}>
                                                                    {viewInvoice.adjustment_type === 'addition' ? '+' : '−'}{viewInvoice.adjustment_amount.toFixed(2)}/-
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                                <td colSpan={4} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 700, fontSize: '1.05rem' }}>
                                                                    Final Amount
                                                                </td>
                                                                <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>
                                                                    {(viewInvoice.final_amount || 0).toFixed(2)}/-
                                                                </td>
                                                            </tr>
                                                        </>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>

                                {/* Footer: PAN + Owner */}
                                <div className="inv-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                                    <div style={{ fontWeight: 600 }}>{viewInvoice.pan_id && `PAN NO. :- ${viewInvoice.pan_id}`}</div>
                                    <div style={{ fontWeight: 600 }}>{viewInvoice.owner_name || ''}</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setViewInvoice(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { handleSavePdf(viewInvoice); }}>📥 Download PDF</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Schedule Send Modal ─── */}
            {showScheduleModal && scheduleInvoice && (
                <div className="modal-overlay" onClick={() => { setShowScheduleModal(false); setScheduleInvoice(null); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>📅 Schedule Email</h2>
                            <button className="modal-close" onClick={() => { setShowScheduleModal(false); setScheduleInvoice(null); }}>×</button>
                        </div>
                        <div className="modal-body">
                            {/* Invoice info card */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-md)',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{scheduleInvoice.invoice_number}</span>
                                    <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-primary-hover)' }}>₹{(scheduleInvoice.final_amount || 0).toFixed(2)}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {scheduleInvoice.client_name} • {scheduleInvoice.company_name}
                                </div>
                            </div>

                            {/* Date picker */}
                            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                <label className="form-label required">Schedule Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    min={minDate}
                                />
                            </div>

                            {/* Time picker */}
                            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                                <label className="form-label required">Schedule Time</label>
                                <input
                                    className="form-input"
                                    type="time"
                                    value={scheduleTime}
                                    onChange={e => setScheduleTime(e.target.value)}
                                />
                            </div>

                            {/* Quick time presets */}
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <label className="form-label" style={{ marginBottom: 6 }}>Quick Presets</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[
                                        { label: '🌅 9:00 AM', time: '09:00' },
                                        { label: '☀️ 12:00 PM', time: '12:00' },
                                        { label: '🌇 5:00 PM', time: '17:00' },
                                        { label: '🌙 8:00 PM', time: '20:00' },
                                    ].map(preset => (
                                        <button
                                            key={preset.time}
                                            className={`btn btn-sm ${scheduleTime === preset.time ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setScheduleTime(preset.time)}
                                            type="button"
                                            style={{ fontSize: '0.82rem' }}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preview scheduled time */}
                            {scheduleDate && scheduleTime && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                                    border: '1px solid #93c5fd',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    textAlign: 'center',
                                    fontSize: '0.9rem',
                                    color: '#1e40af'
                                }}>
                                    ✉️ Email will be sent on <strong>{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong> at <strong>{new Date(`${scheduleDate}T${scheduleTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowScheduleModal(false); setScheduleInvoice(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleScheduleSend} disabled={scheduling}>
                                {scheduling ? <span className="spinner"></span> : '📅 Schedule Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Scheduled Emails List Modal ─── */}
            {showScheduledList && (
                <div className="modal-overlay" onClick={() => setShowScheduledList(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 850 }}>
                        <div className="modal-header">
                            <h2>📅 Scheduled Emails</h2>
                            <button className="modal-close" onClick={() => setShowScheduledList(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {loadingScheduled ? (
                                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                            ) : scheduledEmails.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                                    <div className="empty-state-icon">📅</div>
                                    <p>No scheduled emails yet. Use the 📅 button on an invoice to schedule one.</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Invoice</th>
                                                <th>Client</th>
                                                <th>Scheduled For</th>
                                                <th>Status</th>
                                                <th>Created</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scheduledEmails.map(se => (
                                                <tr key={se.id}>
                                                    <td>
                                                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent-primary-hover)' }}>
                                                            {se.invoice_number}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{se.client_name}</td>
                                                    <td>
                                                        <div className="font-mono" style={{ fontSize: '0.88rem' }}>
                                                            {new Date(se.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                            {new Date(se.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td>{getStatusBadge(se.status)}</td>
                                                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                        {new Date(se.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                    </td>
                                                    <td>
                                                        {se.status === 'pending' && (
                                                            <button
                                                                className="btn btn-ghost btn-sm text-danger"
                                                                onClick={() => handleCancelScheduled(se.id)}
                                                                title="Cancel"
                                                            >
                                                                🚫
                                                            </button>
                                                        )}
                                                        {se.status === 'failed' && se.error_message && (
                                                            <span title={se.error_message} style={{ cursor: 'help', fontSize: '0.8rem', color: '#dc2626' }}>
                                                                ⓘ {se.error_message.substring(0, 30)}{se.error_message.length > 30 ? '…' : ''}
                                                            </span>
                                                        )}
                                                        {se.status === 'sent' && se.sent_at && (
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--success)' }}>
                                                                Sent {new Date(se.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowScheduledList(false)}>Close</button>
                            <button className="btn btn-ghost" onClick={loadScheduledEmails} disabled={loadingScheduled}>🔄 Refresh</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
