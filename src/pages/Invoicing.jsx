import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { buildPdfDefinition, loadLogoBase64 } from '../utils/pdfGenerator.js';

pdfMake.vfs = pdfFonts.default?.pdfMake?.vfs || pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

export default function Invoicing() {
    const showToast = useToast();
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [entries, setEntries] = useState([]);
    const [selectedEntryIds, setSelectedEntryIds] = useState([]);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [showPreview, setShowPreview] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.getClients().then(setClients).catch(e => showToast(e.message, 'error'));
    }, []);

    const fetchEntries = async () => {
        if (!clientId || !fromDate || !toDate) {
            showToast('Please select client, from date and to date', 'error');
            return;
        }
        setLoading(true);
        try {
            const ents = await api.getEntries({ client_id: clientId, from_date: fromDate, to_date: toDate, uninvoiced: '1' });
            setEntries(ents);
            setSelectedEntryIds(ents.map(e => e.id));
            if (ents.length === 0) showToast('No uninvoiced entries found for this period', 'info');
        } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    const toggleEntry = (id) => {
        setSelectedEntryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedEntryIds.length === entries.length) setSelectedEntryIds([]);
        else setSelectedEntryIds(entries.map(e => e.id));
    };

    const selectedEntries = entries.filter(e => selectedEntryIds.includes(e.id));
    const totalAmount = selectedEntries.reduce((s, e) => s + (e.total_amount || 0), 0);

    const client = clients.find(c => c.id === Number(clientId));

    const previewInvoice = () => {
        if (selectedEntryIds.length === 0) {
            showToast('Please select at least one entry', 'error');
            return;
        }
        // Build full invoice preview data
        setInvoiceData({
            client,
            company_name: selectedEntries[0]?.company_name || '',
            entries: selectedEntries,
            totalAmount,
            invoiceDate,
            fromDate,
            toDate,
        });
        setShowPreview(true);
    };

    const finalizeInvoice = async () => {
        try {
            const newInvoice = await api.createInvoice({
                client_id: Number(clientId),
                from_date: fromDate,
                to_date: toDate,
                invoice_date: invoiceDate,
                entry_ids: selectedEntryIds,
            });
            showToast('Invoice created successfully! 🎉');

            // Auto-download PDF
            try {
                const logoBase64 = await loadLogoBase64();
                const docDef = buildPdfDefinition(newInvoice, logoBase64);
                pdfMake.createPdf(docDef).download(`Invoice_${newInvoice.invoice_number}.pdf`);
                showToast('PDF downloaded automatically');
            } catch (pdfErr) {
                console.error('Auto-download failed', pdfErr);
                showToast('Invoice created, but PDF auto-download failed. You can download it from Dashboard.', 'warning');
            }

            setShowPreview(false);
            setEntries([]);
            setSelectedEntryIds([]);
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">🧾</span> Create Invoice</h1>
            </div>

            {!showPreview ? (
                <>
                    {/* Selection Form */}
                    <div className="card mb-lg">
                        <h3 style={{ marginBottom: 'var(--space-md)' }}>Select Client & Date Range</h3>
                        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                            <div className="form-group">
                                <label className="form-label required">Client</label>
                                <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                                    <option value="">Select client…</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label required">From Date</label>
                                <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">To Date</label>
                                <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Invoice Date</label>
                                <input className="form-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={fetchEntries} disabled={loading}>
                            {loading ? <span className="spinner"></span> : '🔍 Fetch Entries'}
                        </button>
                    </div>

                    {/* Entries Table */}
                    {entries.length > 0 && (
                        <div className="card">
                            <div className="flex-between mb-md">
                                <h3>Uninvoiced Entries ({entries.length})</h3>
                                <div className="flex gap-sm">
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Selected: {selectedEntryIds.length} | Total: <strong style={{ color: 'var(--accent-primary-hover)' }}>₹{totalAmount.toFixed(2)}</strong>
                                    </span>
                                    <button className="btn btn-primary" onClick={previewInvoice}>Preview Invoice →</button>
                                </div>
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th><input type="checkbox" checked={selectedEntryIds.length === entries.length} onChange={toggleAll} /></th>
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
                                        {entries.map(e => (
                                            <tr key={e.id} style={{ opacity: selectedEntryIds.includes(e.id) ? 1 : 0.5 }}>
                                                <td><input type="checkbox" checked={selectedEntryIds.includes(e.id)} onChange={() => toggleEntry(e.id)} /></td>
                                                <td className="font-mono">{e.date}</td>
                                                <td>{e.from_location && e.to_location ? `${e.from_location} → ${e.to_location}` : '—'}</td>
                                                <td><span className="badge badge-info">{e.entry_type === 'per_kg' ? 'Per Kg' : 'Per Bundle'}</span></td>
                                                <td>{e.has_challan ? e.challan_number : '—'}</td>
                                                <td className="text-right font-mono">₹{(e.amount || 0).toFixed(2)}</td>
                                                <td className="text-right font-mono">{e.loading_charges > 0 ? `₹${e.loading_charges.toFixed(2)}` : '—'}</td>
                                                <td className="text-right font-mono" style={{ fontWeight: 600 }}>₹{(e.total_amount || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Invoice Preview */
                <div>
                    <div className="flex-between mb-lg">
                        <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>← Back to Entries</button>
                        <button className="btn btn-primary" onClick={finalizeInvoice}>✅ Done — Save Invoice</button>
                    </div>

                    <div className="invoice-preview">
                        <div className="inv-header">
                            <h1>{invoiceData.company_name}</h1>
                            {client && <p>{client.address}</p>}
                        </div>

                        <div className="inv-meta">
                            <div className="inv-meta-block">
                                <h3>Bill To</h3>
                                <p style={{ fontWeight: 600 }}>{client?.name}</p>
                                <p>{client?.address}</p>
                            </div>
                            <div className="inv-meta-block" style={{ textAlign: 'right' }}>
                                <h3>Invoice Details</h3>
                                <p><strong>Date:</strong> {invoiceDate}</p>
                                <p><strong>Period:</strong> {fromDate} to {toDate}</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Invoice # assigned on save</p>
                            </div>
                        </div>

                        {/* Dynamic Table Rendering */}
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    {(JSON.parse(client?.invoice_visible_columns || '[]').length > 0 ? JSON.parse(client.invoice_visible_columns) : ['date', 'from_location', 'to_location', 'entry_type', 'challan_number', 'vehicle_number', 'amount', 'loading_charges', 'total_amount']).map(colId => {
                                        const labelMap = {
                                            date: 'Date', from_location: 'From', to_location: 'To', entry_type: 'Type',
                                            challan_number: 'Challan', vehicle_number: 'Vehicle',
                                            amount: 'Amount', loading_charges: 'Charges', total_amount: 'Total',
                                            unit: 'Unit', length: 'L', width: 'W', gsm: 'GSM', packaging: 'Pkg',
                                            no_of_packets: 'Pkt', weight: 'Wgt', rate_per_kg: 'Rate/Kg',
                                            no_of_bundles: 'Bdls', rate_per_bundle: 'Rate/Bdl'
                                        };
                                        return <th key={colId} className={['amount', 'loading_charges', 'total_amount', 'weight', 'rate_per_kg', 'rate_per_bundle'].includes(colId) ? 'text-right' : ''}>{labelMap[colId] || colId}</th>;
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {selectedEntries.map((e, i) => {
                                    const visibleCols = JSON.parse(client?.invoice_visible_columns || '[]');
                                    const colsToRender = visibleCols.length > 0 ? visibleCols : ['date', 'from_location', 'to_location', 'entry_type', 'challan_number', 'vehicle_number', 'amount', 'loading_charges', 'total_amount'];

                                    return (
                                        <tr key={e.id}>
                                            <td>{i + 1}</td>
                                            {colsToRender.map(colId => {
                                                let val = e[colId];
                                                // Format specific fields
                                                if (colId === 'entry_type') val = e.entry_type === 'per_kg' ? 'Kg' : 'Bundle';
                                                else if (colId === 'challan_number') val = e.has_challan ? e.challan_number : '—';
                                                else if (colId === 'vehicle_number') val = e.has_vehicle ? e.vehicle_number : '—';
                                                else if (['amount', 'loading_charges', 'total_amount'].includes(colId)) val = `₹${(e[colId] || 0).toFixed(2)}`;
                                                else if (['weight', 'rate_per_kg', 'rate_per_bundle'].includes(colId)) val = (e[colId] || 0);

                                                const isRight = ['amount', 'loading_charges', 'total_amount', 'weight', 'rate_per_kg', 'rate_per_bundle'].includes(colId);
                                                return <td key={colId} className={isRight ? 'text-right' : ''} style={colId === 'total_amount' ? { fontWeight: 600 } : {}}>{val !== undefined && val !== null ? val : '—'}</td>;
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="inv-total">
                            <div className="label">Total Amount</div>
                            <div className="amount">₹{totalAmount.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
