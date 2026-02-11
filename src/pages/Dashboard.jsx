import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.default?.pdfMake?.vfs || pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

function buildPdfDefinition(invoice) {
    const entries = invoice.entries || [];
    const tableBody = [
        [
            { text: '#', style: 'tableHeader' },
            { text: 'Date', style: 'tableHeader' },
            { text: 'Route', style: 'tableHeader' },
            { text: 'Type', style: 'tableHeader' },
            { text: 'Challan', style: 'tableHeader' },
            { text: 'Vehicle', style: 'tableHeader' },
            { text: 'Amount', style: 'tableHeader', alignment: 'right' },
            { text: 'Charges', style: 'tableHeader', alignment: 'right' },
            { text: 'Total', style: 'tableHeader', alignment: 'right' },
        ],
        ...entries.map((e, i) => [
            i + 1,
            e.date,
            e.from_location && e.to_location ? `${e.from_location} → ${e.to_location}` : '-',
            e.entry_type === 'per_kg' ? 'Per Kg' : 'Per Bundle',
            e.has_challan ? (e.challan_number || '-') : '-',
            e.has_vehicle ? (e.vehicle_number || '-') : '-',
            { text: `₹${(e.amount || 0).toFixed(2)}`, alignment: 'right' },
            { text: e.loading_charges > 0 ? `₹${e.loading_charges.toFixed(2)}` : '-', alignment: 'right' },
            { text: `₹${(e.total_amount || 0).toFixed(2)}`, alignment: 'right', bold: true },
        ]),
    ];

    return {
        content: [
            { text: invoice.company_name, style: 'companyName', alignment: 'center' },
            { text: invoice.company_address || '', alignment: 'center', fontSize: 10, color: '#666', margin: [0, 0, 0, 2] },
            { text: invoice.company_phone ? `Phone: ${invoice.company_phone}` : '', alignment: 'center', fontSize: 9, color: '#999', margin: [0, 0, 0, 15] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#ddd' }], margin: [0, 0, 0, 15] },
            {
                columns: [
                    {
                        width: '50%',
                        stack: [
                            { text: 'BILL TO', style: 'sectionLabel' },
                            { text: invoice.client_name, bold: true, fontSize: 12 },
                            { text: invoice.client_address || '', fontSize: 10, color: '#666' },
                        ],
                    },
                    {
                        width: '50%',
                        alignment: 'right',
                        stack: [
                            { text: 'INVOICE', style: 'sectionLabel', alignment: 'right' },
                            { text: `#${invoice.invoice_number}`, bold: true, fontSize: 14, color: '#6366f1' },
                            { text: `Date: ${invoice.invoice_date}`, fontSize: 10, color: '#666' },
                            { text: `Period: ${invoice.from_date} to ${invoice.to_date}`, fontSize: 9, color: '#999' },
                        ],
                    },
                ],
                margin: [0, 0, 0, 20],
            },
            {
                table: { headerRows: 1, widths: [20, 55, 70, 45, 50, 50, 55, 50, 60], body: tableBody },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
                    vLineWidth: () => 0,
                    hLineColor: (i) => i <= 1 ? '#ccc' : '#eee',
                    paddingTop: () => 6,
                    paddingBottom: () => 6,
                    fillColor: (i) => i === 0 ? '#f8f9fa' : null,
                },
            },
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        width: 'auto',
                        stack: [
                            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 2, lineColor: '#e2e8f0' }], margin: [0, 10, 0, 8] },
                            { text: 'TOTAL AMOUNT', fontSize: 9, color: '#999', alignment: 'right' },
                            { text: `₹${(invoice.final_amount || 0).toFixed(2)}`, fontSize: 20, bold: true, alignment: 'right', color: '#1a1a2e' },
                        ],
                    },
                ],
            },
            { text: '', margin: [0, 30, 0, 0] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 0, 0, 10] },
            {
                columns: [
                    { width: '50%', text: invoice.owner_name ? `Authorized Signatory: ${invoice.owner_name}` : '', fontSize: 9, color: '#666' },
                    { width: '50%', text: invoice.pan_id ? `PAN: ${invoice.pan_id}` : '', fontSize: 9, color: '#666', alignment: 'right' },
                ],
            },
        ],
        styles: {
            companyName: { fontSize: 20, bold: true, color: '#1a1a2e', margin: [0, 0, 0, 4] },
            sectionLabel: { fontSize: 8, bold: true, color: '#999', letterSpacing: 1, margin: [0, 0, 0, 4] },
            tableHeader: { bold: true, fontSize: 8, color: '#555' },
        },
        defaultStyle: { font: 'Roboto', fontSize: 10 },
    };
}

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
            const docDef = buildPdfDefinition(full);
            pdfMake.createPdf(docDef).download(`Invoice_${full.invoice_number}.pdf`);
            showToast('PDF downloaded');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleEmail = async (inv) => {
        try {
            const full = await api.getInvoice(inv.id);
            if (!full.client_email) {
                showToast('No email found for this client', 'error');
                return;
            }
            // Generate PDF as base64
            const docDef = buildPdfDefinition(full);
            pdfMake.createPdf(docDef).getBase64(async (base64) => {
                try {
                    await api.emailInvoice(inv.id, base64);
                    showToast(`Invoice emailed to ${full.client_email}`);
                } catch (e) { showToast(e.message, 'error'); }
            });
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
                                <div className="inv-header">
                                    <h1>{viewInvoice.company_name}</h1>
                                    <p>{viewInvoice.company_address}</p>
                                    {viewInvoice.company_phone && <p>Phone: {viewInvoice.company_phone}</p>}
                                </div>

                                <div className="inv-meta">
                                    <div className="inv-meta-block">
                                        <h3>Bill To</h3>
                                        <p style={{ fontWeight: 600 }}>{viewInvoice.client_name}</p>
                                        <p>{viewInvoice.client_address}</p>
                                    </div>
                                    <div className="inv-meta-block" style={{ textAlign: 'right' }}>
                                        <h3>Invoice</h3>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366f1' }}>#{viewInvoice.invoice_number}</p>
                                        <p>Date: {viewInvoice.invoice_date}</p>
                                        <p style={{ fontSize: '0.8rem' }}>Period: {viewInvoice.from_date} to {viewInvoice.to_date}</p>
                                    </div>
                                </div>

                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Date</th>
                                            <th>Route</th>
                                            <th>Type</th>
                                            <th>Challan</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-right">Charges</th>
                                            <th className="text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(viewInvoice.entries || []).map((e, i) => (
                                            <tr key={e.id}>
                                                <td>{i + 1}</td>
                                                <td>{e.date}</td>
                                                <td>{e.from_location && e.to_location ? `${e.from_location} → ${e.to_location}` : '—'}</td>
                                                <td>{e.entry_type === 'per_kg' ? 'Per Kg' : 'Per Bundle'}</td>
                                                <td>{e.has_challan ? e.challan_number : '—'}</td>
                                                <td className="text-right">₹{(e.amount || 0).toFixed(2)}</td>
                                                <td className="text-right">{e.loading_charges > 0 ? `₹${e.loading_charges.toFixed(2)}` : '—'}</td>
                                                <td className="text-right" style={{ fontWeight: 600 }}>₹{(e.total_amount || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="inv-total">
                                    <div className="label">Total Amount</div>
                                    <div className="amount">₹{(viewInvoice.final_amount || 0).toFixed(2)}</div>
                                </div>

                                <div className="inv-footer">
                                    <div>{viewInvoice.owner_name && `Authorized: ${viewInvoice.owner_name}`}</div>
                                    <div>{viewInvoice.pan_id && `PAN: ${viewInvoice.pan_id}`}</div>
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
