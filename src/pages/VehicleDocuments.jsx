import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Layout.jsx';

const API = 'http://localhost:9090/api/vehicle-docs';

function getExpiryStatus(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Expired', type: 'danger', icon: '🔴', days: diffDays };
    if (diffDays <= 30) return { label: `Expiring in ${diffDays}d`, type: 'warning', icon: '⚠️', days: diffDays };
    return { label: 'Valid', type: 'success', icon: '✅', days: diffDays };
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function VehicleDocuments() {
    const showToast = useToast();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [form, setForm] = useState({
        vehicle_number: '',
        doc_name: '',
        start_date: '',
        expiry_date: '',
        file: null,
    });

    const loadDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(API);
            const data = await res.json();
            setDocs(data);
        } catch {
            showToast('Failed to load documents', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadDocs(); }, [loadDocs]);

    const expiringSoon = docs.filter(d => {
        const { days } = getExpiryStatus(d.expiry_date);
        return days >= 0 && days <= 30;
    });
    const expired = docs.filter(d => getExpiryStatus(d.expiry_date).days < 0);

    const handleChange = e => {
        const { name, value, files } = e.target;
        setForm(prev => ({ ...prev, [name]: files ? files[0] : value }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.vehicle_number.trim()) return showToast('Vehicle Number is required', 'error');
        if (!form.doc_name.trim()) return showToast('Document Name is required', 'error');
        if (!form.start_date) return showToast('Start Date is required', 'error');
        if (!form.expiry_date) return showToast('Expiry Date is required', 'error');
        if (!form.file) return showToast('Please select a file to upload', 'error');
        if (new Date(form.expiry_date) < new Date(form.start_date)) {
            return showToast('Expiry Date cannot be before Start Date', 'error');
        }

        setSubmitting(true);
        const fd = new FormData();
        fd.append('vehicle_number', form.vehicle_number.trim().toUpperCase());
        fd.append('doc_name', form.doc_name.trim());
        fd.append('start_date', form.start_date);
        fd.append('expiry_date', form.expiry_date);
        fd.append('file', form.file);

        try {
            const res = await fetch(API, { method: 'POST', body: fd });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }
            const newDoc = await res.json();
            setDocs(prev => [newDoc, ...prev]);
            setForm({ vehicle_number: '', doc_name: '', start_date: '', expiry_date: '', file: null });
            // Reset file input
            document.getElementById('vdoc-file-input').value = '';
            setShowForm(false);
            showToast('Document uploaded successfully', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`${API}/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setDocs(prev => prev.filter(d => d.id !== deleteId));
            showToast('Document deleted', 'success');
        } catch {
            showToast('Failed to delete document', 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const handlePreview = (doc) => {
        window.open(`http://localhost:9090${doc.file_path}`, '_blank');
    };

    const handleDownload = (doc) => {
        const a = document.createElement('a');
        a.href = `http://localhost:9090${doc.file_path}`;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const stats = [
        { icon: '📄', label: 'Total Documents', value: docs.length, color: '#3282B8' },
        { icon: '✅', label: 'Valid', value: docs.filter(d => getExpiryStatus(d.expiry_date).days >= 0 && getExpiryStatus(d.expiry_date).days > 30).length, color: '#059669' },
        { icon: '⚠️', label: 'Expiring Soon', value: expiringSoon.length, color: '#d97706' },
        { icon: '🔴', label: 'Expired', value: expired.length, color: '#dc2626' },
    ];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <span className="page-header-icon">🚗</span>
                    Vehicle Documents
                </h1>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    + Add Document
                </button>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                {stats.map(s => (
                    <div className="stat-card" key={s.label}>
                        <div className="stat-icon" style={{ background: `${s.color}18`, fontSize: '1.6rem' }}>{s.icon}</div>
                        <div>
                            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Expiry Notification Banner */}
            {(expiringSoon.length > 0 || expired.length > 0) && (
                <div style={{
                    background: expiringSoon.length > 0 ? 'var(--warning-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${expiringSoon.length > 0 ? '#fcd34d' : '#fca5a5'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    <div style={{ fontWeight: 700, color: expiringSoon.length > 0 ? 'var(--warning)' : 'var(--danger)', marginBottom: '4px' }}>
                        {expiringSoon.length > 0 ? '⚠️ Upcoming Expiry Reminders' : '🔴 Expired Documents'}
                    </div>
                    {[...expiringSoon, ...expired].map(d => (
                        <div key={d.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.vehicle_number}</span>
                            <span>—</span>
                            <span>{d.doc_name}</span>
                            <span>—</span>
                            <span style={{ color: getExpiryStatus(d.expiry_date).days < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                {getExpiryStatus(d.expiry_date).days < 0
                                    ? `Expired ${Math.abs(getExpiryStatus(d.expiry_date).days)} days ago (${formatDate(d.expiry_date)})`
                                    : `Expires in ${getExpiryStatus(d.expiry_date).days} days (${formatDate(d.expiry_date)})`
                                }
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Document Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>📎 Add New Document</h3>
                        <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                            <div className="form-group">
                                <label className="form-label required">Vehicle Number</label>
                                <input
                                    className="form-input"
                                    name="vehicle_number"
                                    value={form.vehicle_number}
                                    onChange={handleChange}
                                    placeholder="e.g. MH12AB1234"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Document Name</label>
                                <input
                                    className="form-input"
                                    name="doc_name"
                                    value={form.doc_name}
                                    onChange={handleChange}
                                    placeholder="e.g. RC Book, Insurance, Permit"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Start Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    name="start_date"
                                    value={form.start_date}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Expiry Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    name="expiry_date"
                                    value={form.expiry_date}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Attach Document</label>
                            <input
                                id="vdoc-file-input"
                                className="form-input"
                                type="file"
                                name="file"
                                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                                onChange={handleChange}
                                style={{ padding: '7px 14px' }}
                            />
                            <div className="form-hint">Accepted: PDF, Images (JPG, PNG), Word, Excel — Max 50MB</div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳ Uploading…' : '📤 Upload Document'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Documents Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>📋 Document Records</h3>
                    <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{docs.length} total</span>
                </div>

                {loading ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⏳</div>
                        <p>Loading documents…</p>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📂</div>
                        <p>No vehicle documents yet.</p>
                        <p style={{ marginTop: '6px', fontSize: '0.8rem' }}>Click <strong>+ Add Document</strong> to get started.</p>
                    </div>
                ) : (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Vehicle Number</th>
                                    <th>Document</th>
                                    <th>File</th>
                                    <th>Start Date</th>
                                    <th>Expiry Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((doc, i) => {
                                    const status = getExpiryStatus(doc.expiry_date);
                                    return (
                                        <tr key={doc.id}>
                                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: 'var(--primary)',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.9rem',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    {doc.vehicle_number}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.doc_name}</td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-secondary)',
                                                    maxWidth: '160px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    display: 'block'
                                                }}>
                                                    📎 {doc.file_name}
                                                </span>
                                            </td>
                                            <td>{formatDate(doc.start_date)}</td>
                                            <td>{formatDate(doc.expiry_date)}</td>
                                            <td>
                                                <span className={`badge badge-${status.type}`}>
                                                    {status.icon} {status.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="actions-group">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        title="Preview"
                                                        onClick={() => handlePreview(doc)}
                                                    >
                                                        👁 Preview
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        title="Download"
                                                        onClick={() => handleDownload(doc)}
                                                    >
                                                        ⬇ Download
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        title="Delete"
                                                        onClick={() => setDeleteId(doc.id)}
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>🗑 Delete Document</h2>
                            <button className="modal-close" onClick={() => setDeleteId(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Are you sure you want to delete this document? This will permanently remove the file and cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
