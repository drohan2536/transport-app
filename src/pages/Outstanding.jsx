import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import { formatUI } from '../utils/dateUtils.js';

const DATE_PRESETS = [
    { label: '1 Week', days: 7 },
    { label: '15 Days', days: 15 },
    { label: '1 Month', days: 30 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
];

function formatDate(d) {
    return d.toISOString().split('T')[0];
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(amount || 0);
}

export default function Outstanding() {
    const showToast = useToast();
    const [activePreset, setActivePreset] = useState(null); // no preset by default, will use oldest date
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [results, setResults] = useState([]);
    const [summary, setSummary] = useState({ total_clients: 0, total_entries: 0, total_outstanding: 0, total_paid: 0, total_unpaid: 0 });
    const [loading, setLoading] = useState(false);
    const [expandedClient, setExpandedClient] = useState(null);
    const [clientEntries, setClientEntries] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('unpaid'); // 'all', 'paid', 'unpaid'

    // Bulk selection state
    const [selectedEntries, setSelectedEntries] = useState(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Initialize: fetch oldest unpaid date for from-date, set to-date to today
    useEffect(() => {
        const init = async () => {
            try {
                const data = await api.getOldestUnpaidDate();
                const today = new Date();
                setToDate(formatDate(today));
                if (data.oldest_date) {
                    setFromDate(data.oldest_date);
                } else {
                    // Fallback to 1 month ago
                    const from = new Date(today);
                    from.setDate(today.getDate() - 30);
                    setFromDate(formatDate(from));
                    setActivePreset(2);
                }
            } catch (e) {
                // Fallback to 1 month ago
                const today = new Date();
                const from = new Date(today);
                from.setDate(today.getDate() - 30);
                setFromDate(formatDate(from));
                setToDate(formatDate(today));
                setActivePreset(2);
            }
        };
        init();
    }, []);

    const applyPreset = (index) => {
        const preset = DATE_PRESETS[index];
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - preset.days);
        setActivePreset(index);
        setFromDate(formatDate(from));
        setToDate(formatDate(today));
    };

    // Auto-fetch when dates or payment filter change
    useEffect(() => {
        if (fromDate && toDate) {
            fetchOutstanding();
        }
    }, [fromDate, toDate, paymentFilter]);

    const fetchOutstanding = async () => {
        if (!fromDate || !toDate) return;
        setLoading(true);
        setExpandedClient(null);
        setClientEntries([]);
        setSelectedEntries(new Set());
        try {
            const data = await api.getOutstanding(fromDate, toDate, paymentFilter);
            setResults(data.results || []);
            setSummary(data.summary || { total_clients: 0, total_entries: 0, total_outstanding: 0, total_paid: 0, total_unpaid: 0 });
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const toggleClientDetail = async (clientId) => {
        if (expandedClient === clientId) {
            setExpandedClient(null);
            setClientEntries([]);
            setSelectedEntries(new Set());
            return;
        }
        setExpandedClient(clientId);
        setLoadingDetail(true);
        setSelectedEntries(new Set());
        try {
            const entries = await api.getOutstandingDetail(clientId, fromDate, toDate, paymentFilter);
            setClientEntries(entries);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoadingDetail(false);
    };

    const toggleEntryPaidStatus = async (entryId, e) => {
        if (e) e.stopPropagation();
        try {
            await api.toggleEntryPaid(entryId);
            showToast('Payment status updated', 'success');
            // Refresh detailed list and main list
            fetchOutstanding();
            if (expandedClient) {
                const entries = await api.getOutstandingDetail(expandedClient, fromDate, toDate, paymentFilter);
                setClientEntries(entries);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleCustomDate = () => {
        setActivePreset(null);
    };

    // Bulk selection handlers
    const toggleEntrySelection = (entryId, e) => {
        if (e) e.stopPropagation();
        setSelectedEntries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entryId)) {
                newSet.delete(entryId);
            } else {
                newSet.add(entryId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        // Only select unpaid entries (those that can be marked as paid)
        const unpaidEntries = clientEntries.filter(entry =>
            entry.invoice_status !== 'paid' && entry.is_paid !== 1
        );
        if (selectedEntries.size === unpaidEntries.length && unpaidEntries.length > 0) {
            setSelectedEntries(new Set());
        } else {
            setSelectedEntries(new Set(unpaidEntries.map(e => e.id)));
        }
    };

    const handleBulkMarkPaid = async () => {
        if (selectedEntries.size === 0) return;
        setBulkProcessing(true);
        try {
            await api.bulkMarkPaid(Array.from(selectedEntries));
            showToast(`${selectedEntries.size} entries marked as paid`, 'success');
            setSelectedEntries(new Set());
            fetchOutstanding();
            if (expandedClient) {
                const entries = await api.getOutstandingDetail(expandedClient, fromDate, toDate, paymentFilter);
                setClientEntries(entries);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
        setBulkProcessing(false);
    };

    // Calculate the percentage for the bar visualization
    const maxAmount = results.length > 0 ? Math.max(...results.map(r => r.total_amount || 0)) : 1;

    // Count unpaid entries in current detail view for select-all checkbox
    const unpaidDetailEntries = clientEntries.filter(entry =>
        entry.invoice_status !== 'paid' && entry.is_paid !== 1
    );

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">💰</span> Outstanding</h1>
            </div>

            {/* Date Range Controls + Payment Filter */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                {/* Payment Filter Dropdown */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '0 0 180px' }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Payment Status</label>
                        <select
                            className="form-select"
                            value={paymentFilter}
                            onChange={e => setPaymentFilter(e.target.value)}
                            style={{
                                fontWeight: 600,
                                color: paymentFilter === 'unpaid' ? 'var(--danger)' : paymentFilter === 'paid' ? '#22c55e' : 'var(--text-primary)',
                                borderColor: paymentFilter === 'unpaid' ? 'var(--danger)' : paymentFilter === 'paid' ? '#22c55e' : 'var(--border-color)',
                            }}
                        >
                            <option value="unpaid">⏳ Unpaid</option>
                            <option value="paid">✅ Paid</option>
                            <option value="all">📋 All</option>
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Quick Date Range</label>
                        <div className="outstanding-presets">
                            {DATE_PRESETS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    className={`outstanding-preset-btn ${activePreset === idx ? 'active' : ''}`}
                                    onClick={() => applyPreset(idx)}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">From Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={fromDate}
                            onChange={e => { setFromDate(e.target.value); handleCustomDate(); }}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">To Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={toDate}
                            onChange={e => { setToDate(e.target.value); handleCustomDate(); }}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={fetchOutstanding} style={{ width: '100%' }}>
                            🔍 Fetch Outstanding
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--warning-bg)' }}>👥</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>{summary.total_clients}</div>
                        <div className="stat-label">Clients</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--info-bg)' }}>📋</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--info)' }}>{summary.total_entries}</div>
                        <div className="stat-label">Total Entries</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.12)' }}>✅</div>
                    <div>
                        <div className="stat-value" style={{ color: '#22c55e' }}>{formatCurrency(summary.total_paid)}</div>
                        <div className="stat-label">Paid Amount</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--danger-bg)' }}>⏳</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(summary.total_unpaid)}</div>
                        <div className="stat-label">Unpaid Amount</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--warning-bg)' }}>💸</div>
                    <div>
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>{formatCurrency(summary.total_outstanding)}</div>
                        <div className="stat-label">Total Amount</div>
                    </div>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : results.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎉</div>
                    <p>No entries found for the selected date range.</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                        Try changing the date range or payment filter.
                    </p>
                </div>
            ) : (
                <div className="outstanding-list">
                    {results.map((row, idx) => (
                        <div key={row.client_id} className="outstanding-card">
                            <div
                                className="outstanding-card-header"
                                onClick={() => toggleClientDetail(row.client_id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="outstanding-card-rank">
                                    <span className="outstanding-rank-number">{idx + 1}</span>
                                </div>
                                <div className="outstanding-card-info">
                                    <div className="outstanding-client-name">{row.client_name}</div>
                                    <div className="outstanding-company-name">
                                        <span className="badge badge-info">{row.company_name}</span>
                                        <span className="outstanding-meta">
                                            {row.entry_count} entr{row.entry_count > 1 ? 'ies' : 'y'}
                                            {' · '}
                                            {row.earliest_date === row.latest_date
                                                ? row.earliest_date
                                                : `${row.earliest_date} — ${row.latest_date}`
                                            }
                                        </span>
                                    </div>
                                    {/* Amount bar */}
                                    <div className="outstanding-bar-container">
                                        <div
                                            className="outstanding-bar"
                                            style={{ width: `${Math.max((row.total_amount / maxAmount) * 100, 4)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="outstanding-card-amount">
                                    <div className="outstanding-amount">{formatCurrency(row.total_amount)}</div>
                                    <div className="outstanding-paid-unpaid-row">
                                        <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 500 }}>
                                            ✅ {formatCurrency(row.paid_amount)}
                                        </span>
                                        <span style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 500, marginLeft: '0.5rem' }}>
                                            ⏳ {formatCurrency(row.unpaid_amount)}
                                        </span>
                                    </div>
                                    <div className="outstanding-expand-hint">
                                        {expandedClient === row.client_id ? '▲ Hide' : '▼ Details'}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {expandedClient === row.client_id && (
                                <div className="outstanding-card-detail">
                                    {loadingDetail ? (
                                        <div style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                                        </div>
                                    ) : clientEntries.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No entries found.
                                        </div>
                                    ) : (
                                        <>
                                            {/* Bulk Actions Bar */}
                                            {unpaidDetailEntries.length > 0 && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.75rem 1rem',
                                                    background: selectedEntries.size > 0
                                                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%)'
                                                        : 'var(--bg-secondary)',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    borderRadius: '8px 8px 0 0',
                                                    transition: 'background 0.2s ease',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedEntries.size === unpaidDetailEntries.length && unpaidDetailEntries.length > 0}
                                                                onChange={toggleSelectAll}
                                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                            />
                                                            Select All Unpaid ({unpaidDetailEntries.length})
                                                        </label>
                                                        {selectedEntries.size > 0 && (
                                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                                {selectedEntries.size} selected
                                                            </span>
                                                        )}
                                                    </div>
                                                    {selectedEntries.size > 0 && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={handleBulkMarkPaid}
                                                            disabled={bulkProcessing}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.4rem',
                                                                animation: 'fadeIn 0.2s ease',
                                                            }}
                                                        >
                                                            {bulkProcessing ? (
                                                                <span className="spinner" style={{ width: 14, height: 14 }}></span>
                                                            ) : (
                                                                <>✅ Mark {selectedEntries.size} as Paid</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <table className="outstanding-detail-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '40px' }}></th>
                                                        <th>Date</th>
                                                        <th>From</th>
                                                        <th>To</th>
                                                        <th>Weight / Bundles</th>
                                                        <th className="text-right">Amount</th>
                                                        <th>Invoice</th>
                                                        <th>Status</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clientEntries.map(entry => {
                                                        const isPaid = entry.invoice_status === 'paid' || entry.is_paid === 1;
                                                        const canSelect = !isPaid;
                                                        return (
                                                            <tr key={entry.id} style={{
                                                                background: selectedEntries.has(entry.id) ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
                                                                transition: 'background 0.15s ease',
                                                            }}>
                                                                <td>
                                                                    {canSelect && (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedEntries.has(entry.id)}
                                                                            onChange={(e) => toggleEntrySelection(entry.id, e)}
                                                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="font-mono">{formatUI(entry.date)}</td>
                                                                <td>{entry.from_location || '—'}</td>
                                                                <td>{entry.to_location || '—'}</td>
                                                                <td>
                                                                    {entry.entry_type === 'per_kg'
                                                                        ? (entry.weight ? `${entry.weight} Kg` : '—')
                                                                        : (entry.no_of_bundles ? `${entry.no_of_bundles} Bundles` : '—')}
                                                                </td>
                                                                <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                                                                    {formatCurrency(entry.total_amount)}
                                                                </td>
                                                                <td>
                                                                    {entry.invoice_number
                                                                        ? <span className="badge badge-success">{entry.invoice_number}</span>
                                                                        : <span className="badge badge-warning">Not Invoiced</span>
                                                                    }
                                                                </td>
                                                                <td>
                                                                    {isPaid
                                                                        ? <span className="badge badge-success">Paid</span>
                                                                        : <span className="badge badge-danger">Unpaid</span>
                                                                    }
                                                                </td>
                                                                <td>
                                                                    {(entry.invoice_status !== 'paid') && (
                                                                        <button 
                                                                            className="btn btn-ghost btn-sm" 
                                                                            onClick={(e) => toggleEntryPaidStatus(entry.id, e)}
                                                                            title={entry.is_paid === 1 ? 'Mark Unpaid' : 'Mark Paid directly'}
                                                                        >
                                                                            {entry.is_paid === 1 ? '❌ Unmark' : '✅ Mark Paid'}
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
