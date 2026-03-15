import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import { buildPdfDefinition, loadLogoBase64, pdfMake } from '../utils/pdfGenerator.js';

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

    // Adjustment state
    const [wantsAdjustment, setWantsAdjustment] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');

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

    // Compute adjusted final amount
    const adjAmountNum = parseFloat(adjustmentAmount) || 0;
    const computedFinalAmount = wantsAdjustment && adjustmentType
        ? (adjustmentType === 'addition' ? totalAmount + adjAmountNum : totalAmount - adjAmountNum)
        : totalAmount;

    const previewInvoice = () => {
        if (selectedEntryIds.length === 0) {
            showToast('Please select at least one entry', 'error');
            return;
        }
        // Validate adjustment fields if adjustment is wanted
        if (wantsAdjustment) {
            if (!adjustmentType) {
                showToast('Please select adjustment type (Addition or Subtraction)', 'error');
                return;
            }
            if (!adjustmentAmount || adjAmountNum <= 0) {
                showToast('Please enter a valid adjustment amount', 'error');
                return;
            }
            if (!adjustmentReason.trim()) {
                showToast('Please enter the reason for adjustment', 'error');
                return;
            }
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
            const invoicePayload = {
                client_id: Number(clientId),
                from_date: fromDate,
                to_date: toDate,
                invoice_date: invoiceDate,
                entry_ids: selectedEntryIds,
            };

            // Include adjustment data if applicable
            if (wantsAdjustment && adjustmentType) {
                invoicePayload.adjustment_type = adjustmentType;
                invoicePayload.adjustment_amount = adjAmountNum;
                invoicePayload.adjustment_reason = adjustmentReason.trim();
            }

            const newInvoice = await api.createInvoice(invoicePayload);
            showToast('Invoice created successfully! 🎉');

            const docDef = buildPdfDefinition(newInvoice, logoBase64);
            pdfMake.createPdf(docDef).getBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Invoice_${newInvoice.invoice_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 1000);
                showToast('PDF downloaded automatically');
            });

            setShowPreview(false);
            setEntries([]);
            setSelectedEntryIds([]);
            // Reset adjustment state
            setWantsAdjustment(false);
            setAdjustmentType('');
            setAdjustmentAmount('');
            setAdjustmentReason('');
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

                            {/* Adjustment Section */}
                            <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: wantsAdjustment ? 'var(--space-md)' : 0 }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Any adjustments required in the Final Amount?</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <button
                                            className={`btn btn-sm ${wantsAdjustment ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setWantsAdjustment(true)}
                                            type="button"
                                        >Yes</button>
                                        <button
                                            className={`btn btn-sm ${!wantsAdjustment ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => { setWantsAdjustment(false); setAdjustmentType(''); setAdjustmentAmount(''); setAdjustmentReason(''); }}
                                            type="button"
                                        >No</button>
                                    </div>
                                </div>
                                {wantsAdjustment && (
                                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
                                        <div className="form-group">
                                            <label className="form-label required">Adjustment Type</label>
                                            <select className="form-select" value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)}>
                                                <option value="">Select…</option>
                                                <option value="addition">Addition (+)</option>
                                                <option value="subtraction">Subtraction (−)</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label required">Adjusting Amount (₹)</label>
                                            <input className="form-input" type="number" min="0" step="0.01" placeholder="Enter amount" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label required">Reason</label>
                                            <input className="form-input" type="text" placeholder="e.g. Discount, Extra charges, etc." value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preview Button */}
                            <div style={{ marginTop: 'var(--space-md)', textAlign: 'right' }}>
                                <button className="btn btn-primary" onClick={previewInvoice}>Preview Invoice →</button>
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
                        {/* Sanskrit Header */}
                        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                            ॥ श्री कृष्णं वन्दे जगद्गुरुम् ॥
                        </div>

                        {/* Company Name */}
                        <div className="inv-header">
                            <h1 style={{ margin: '4px 0' }}>{invoiceData.company_name || client?.company_name}</h1>
                            <p style={{ margin: '2px 0' }}>
                                {client?.company_address || ''}{client?.company_phone ? `. Mob. no. : ${client.company_phone}` : ''}
                            </p>
                        </div>

                        {/* Client Name + Bill Number */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 0 2px' }}>
                            <div>
                                <span>Company Name :-&nbsp;&nbsp;</span>
                                <strong style={{ fontSize: '1.05rem' }}>{client?.name}</strong>
                            </div>
                            <div>
                                <span>Bill no. :&nbsp;</span>
                                <strong style={{ fontSize: '1.05rem', color: 'var(--text-muted)' }}>Assigned on save</strong>
                            </div>
                        </div>

                        {/* Client Address */}
                        {client?.address && (
                            <div style={{ marginBottom: 4, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                                {client.address}
                            </div>
                        )}

                        {/* Date */}
                        <div style={{ textAlign: 'right', marginBottom: 12 }}>
                            <span>Date&nbsp;&nbsp;:&nbsp;&nbsp;</span><strong>{invoiceDate}</strong>
                            <span style={{ marginLeft: 16, fontSize: '0.85rem', color: '#888' }}>
                                (Period: {fromDate} to {toDate})
                            </span>
                        </div>

                        {/* Bordered Table */}
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center' }}>Sr. no.</th>
                                    {(() => {
                                        const visibleCols = JSON.parse(client?.invoice_visible_columns || '[]');
                                        const cols = visibleCols.length > 0 ? visibleCols : ['date', 'from_location', 'to_location', 'weight', 'amount'];
                                        const labelMap = {
                                            date: 'Date', from_location: 'From', to_location: 'To', entry_type: 'Type',
                                            challan_number: 'Challan', vehicle_number: 'Vehicle',
                                            amount: 'Amount', loading_charges: 'Loading', total_amount: 'Total',
                                            unit: 'Unit', length: 'L', width: 'W', gsm: 'GSM', packaging: 'Pkg',
                                            no_of_packets: 'Pkt', weight: 'Weight', rate_per_kg: 'Rate/Kg',
                                            no_of_bundles: 'Bundles', rate_per_bundle: 'Rate/Bdl'
                                        };
                                        const rightAlign = ['amount', 'loading_charges', 'total_amount', 'weight', 'rate_per_kg', 'rate_per_bundle'];
                                        return cols.map(colId => (
                                            <th key={colId} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: rightAlign.includes(colId) ? 'right' : 'left' }}>
                                                {labelMap[colId] || colId}
                                            </th>
                                        ));
                                    })()}
                                </tr>
                            </thead>
                            <tbody>
                                {selectedEntries.map((e, i) => {
                                    const visibleCols = JSON.parse(client?.invoice_visible_columns || '[]');
                                    const cols = visibleCols.length > 0 ? visibleCols : ['date', 'from_location', 'to_location', 'weight', 'amount'];
                                    const rightAlign = ['amount', 'loading_charges', 'total_amount', 'weight', 'rate_per_kg', 'rate_per_bundle'];
                                    return (
                                        <tr key={e.id}>
                                            <td style={{ border: '1px solid #333', padding: '5px 8px', textAlign: 'center' }}>{i + 1}.</td>
                                            {cols.map(colId => {
                                                let val = e[colId];
                                                if (colId === 'entry_type') val = e.entry_type === 'per_kg' ? 'Kg' : 'Bundle';
                                                else if (colId === 'challan_number') val = e.has_challan ? e.challan_number : '—';
                                                else if (colId === 'vehicle_number') val = e.has_vehicle ? e.vehicle_number : '—';
                                                else if (colId === 'weight') val = e.entry_type === 'per_kg' ? (e.weight ? `${e.weight} Kg` : '—') : (e.no_of_bundles ? `${e.no_of_bundles} Bundles` : '—');
                                                else if (['amount', 'loading_charges', 'total_amount'].includes(colId)) val = `${(e[colId] || 0).toFixed(2)}/-`;
                                                else if (['rate_per_kg', 'rate_per_bundle'].includes(colId)) val = (e[colId] || 0);

                                                return (
                                                    <td key={colId} style={{
                                                        border: '1px solid #333', padding: '5px 8px',
                                                        textAlign: rightAlign.includes(colId) ? 'right' : 'left',
                                                        fontWeight: colId === 'total_amount' ? 600 : 'normal'
                                                    }}>
                                                        {val !== undefined && val !== null ? val : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                                {/* Total Amount Row */}
                                {(() => {
                                    const visibleCols = JSON.parse(client?.invoice_visible_columns || '[]');
                                    const cols = visibleCols.length > 0 ? visibleCols : ['date', 'from_location', 'to_location', 'weight', 'amount'];
                                    return (
                                        <>
                                            <tr>
                                                <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                <td colSpan={cols.length - 1} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>
                                                    Total Amount
                                                </td>
                                                <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
                                                    {totalAmount.toFixed(2)}/-
                                                </td>
                                            </tr>
                                            {wantsAdjustment && adjustmentType && adjAmountNum > 0 && (
                                                <>
                                                    <tr>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                        <td colSpan={cols.length - 1} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 600, fontSize: '0.95rem', color: adjustmentType === 'addition' ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)' }}>
                                                            {adjustmentType === 'addition' ? 'Adding' : 'Subtracting'} ({adjustmentReason})
                                                        </td>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: '0.95rem', color: adjustmentType === 'addition' ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)' }}>
                                                            {adjustmentType === 'addition' ? '+' : '−'}{adjAmountNum.toFixed(2)}/-
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                                        <td colSpan={cols.length - 1} style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', fontWeight: 700, fontSize: '1.05rem' }}>
                                                            Final Amount
                                                        </td>
                                                        <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem' }}>
                                                            {computedFinalAmount.toFixed(2)}/-
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
                            <div style={{ fontWeight: 600 }}>{client?.pan_id && `PAN NO. :- ${client.pan_id}`}</div>
                            <div style={{ fontWeight: 600 }}>{client?.owner_name || ''}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
