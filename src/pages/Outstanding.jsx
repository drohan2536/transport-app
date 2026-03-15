import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

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
    const [activePreset, setActivePreset] = useState(2); // default: 1 Month
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [results, setResults] = useState([]);
    const [summary, setSummary] = useState({ total_clients: 0, total_entries: 0, total_outstanding: 0, total_paid: 0, total_unpaid: 0 });
    const [loading, setLoading] = useState(false);
    const [expandedClient, setExpandedClient] = useState(null);
    const [clientEntries, setClientEntries] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Initialize with 1 Month preset
    useEffect(() => {
        applyPreset(2);
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

    // Auto-fetch when dates change
    useEffect(() => {
        if (fromDate && toDate) {
            fetchOutstanding();
        }
    }, [fromDate, toDate]);

    const fetchOutstanding = async () => {
        if (!fromDate || !toDate) return;
        setLoading(true);
        setExpandedClient(null);
        setClientEntries([]);
        try {
            const data = await api.getOutstanding(fromDate, toDate);
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
            return;
        }
        setExpandedClient(clientId);
        setLoadingDetail(true);
        try {
            const entries = await api.getOutstandingDetail(clientId, fromDate, toDate);
            setClientEntries(entries);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoadingDetail(false);
    };

    const handleCustomDate = () => {
        setActivePreset(null);
    };

    // Calculate the percentage for the bar visualization
    const maxAmount = results.length > 0 ? Math.max(...results.map(r => r.total_amount || 0)) : 1;

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">💰</span> Outstanding</h1>
            </div>

            {/* Date Range Controls */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>Quick Date Range</label>
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
                        Try changing the date range.
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
                                        <table className="outstanding-detail-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>From</th>
                                                    <th>To</th>
                                                    <th>Weight / Bundles</th>
                                                    <th className="text-right">Amount</th>
                                                    <th>Invoice</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clientEntries.map(entry => (
                                                    <tr key={entry.id}>
                                                        <td className="font-mono">{entry.date}</td>
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
                                                            {entry.invoice_status === 'paid'
                                                                ? <span className="badge badge-success">Paid</span>
                                                                : <span className="badge badge-danger">Unpaid</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
