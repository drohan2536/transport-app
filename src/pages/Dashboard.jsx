import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import { buildPdfDefinition, loadLogoBase64, pdfMake } from '../utils/pdfGenerator.js';

export default function Dashboard() {
    const showToast = useToast();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewInvoice, setViewInvoice] = useState(null);

    const load = async () => {
        setLoading(true);
        try { setInvoices(await api.getInvoices()); }
        catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

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

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">📊</span> Invoice Dashboard</h1>
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
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEmail(inv)} title="Email">✉️</button>
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
        </div>
    );
}
