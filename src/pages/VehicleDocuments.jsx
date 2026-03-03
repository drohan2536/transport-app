import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Layout.jsx';

const API_DOCS = 'http://localhost:9090/api/vehicle-docs';
const API_VEHICLES = 'http://localhost:9090/api/vehicles';

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

const emptyVehicle = { vehicle_number: '', chassis_number: '', engine_number: '', model: '', registration_date: '', owner_name: '', owner_address: '', owner_email: '' };

export default function VehicleDocuments() {
    const showToast = useToast();

    // Vehicles state
    const [vehicles, setVehicles] = useState([]);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [vehicleForm, setVehicleForm] = useState({ ...emptyVehicle });

    // Documents state
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDocForm, setShowDocForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(null);
    const [sendingAll, setSendingAll] = useState(false);
    const [docForm, setDocForm] = useState({
        vehicle_number: '',
        doc_name: '',
        start_date: '',
        expiry_date: '',
        file: null,
    });

    // Filters
    const [filterVehicle, setFilterVehicle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'vehicles'

    // ─── Load Data ──────────────────────────────────────
    const loadVehicles = useCallback(async () => {
        try {
            const res = await fetch(API_VEHICLES);
            setVehicles(await res.json());
        } catch { showToast('Failed to load vehicles', 'error'); }
    }, [showToast]);

    const loadDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(API_DOCS);
            setDocs(await res.json());
        } catch { showToast('Failed to load documents', 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { loadVehicles(); loadDocs(); }, [loadVehicles, loadDocs]);

    // ─── Filtered docs ──────────────────────────────────
    const filteredDocs = docs.filter(d => {
        if (filterVehicle && d.vehicle_number !== filterVehicle) return false;
        if (searchQuery && !d.doc_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const expiringSoon = docs.filter(d => { const { days } = getExpiryStatus(d.expiry_date); return days >= 0 && days <= 30; });
    const expired = docs.filter(d => getExpiryStatus(d.expiry_date).days < 0);

    // ─── Vehicle handlers ───────────────────────────────
    const openAddVehicle = () => { setEditingVehicle(null); setVehicleForm({ ...emptyVehicle }); setShowVehicleModal(true); };
    const openEditVehicle = (v) => {
        setEditingVehicle(v);
        setVehicleForm({ vehicle_number: v.vehicle_number, chassis_number: v.chassis_number, engine_number: v.engine_number, model: v.model, registration_date: v.registration_date, owner_name: v.owner_name, owner_address: v.owner_address, owner_email: v.owner_email });
        setShowVehicleModal(true);
    };

    const handleSaveVehicle = async (e) => {
        e.preventDefault();
        if (!vehicleForm.vehicle_number.trim()) return showToast('Vehicle Number is required', 'error');
        try {
            const url = editingVehicle ? `${API_VEHICLES}/${editingVehicle.id}` : API_VEHICLES;
            const method = editingVehicle ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...vehicleForm, vehicle_number: vehicleForm.vehicle_number.trim().toUpperCase() }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(editingVehicle ? 'Vehicle updated' : 'Vehicle added');
            setShowVehicleModal(false);
            loadVehicles();
        } catch (err) { showToast(err.message, 'error'); }
    };

    const handleDeleteVehicle = async (v) => {
        if (!confirm(`Delete vehicle ${v.vehicle_number}? This cannot be undone.`)) return;
        try {
            await fetch(`${API_VEHICLES}/${v.id}`, { method: 'DELETE' });
            showToast('Vehicle deleted');
            loadVehicles();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // ─── Document handlers ──────────────────────────────
    const handleDocChange = e => {
        const { name, value, files } = e.target;
        setDocForm(prev => ({ ...prev, [name]: files ? files[0] : value }));
    };

    const handleDocSubmit = async e => {
        e.preventDefault();
        if (!docForm.vehicle_number) return showToast('Please select a vehicle', 'error');
        if (!docForm.doc_name.trim()) return showToast('Document Name is required', 'error');
        if (!docForm.start_date) return showToast('Start Date is required', 'error');
        if (!docForm.expiry_date) return showToast('Expiry Date is required', 'error');
        if (!docForm.file) return showToast('Please select a file to upload', 'error');
        if (new Date(docForm.expiry_date) < new Date(docForm.start_date)) return showToast('Expiry Date cannot be before Start Date', 'error');

        setSubmitting(true);
        const fd = new FormData();
        fd.append('vehicle_number', docForm.vehicle_number);
        fd.append('doc_name', docForm.doc_name.trim());
        fd.append('start_date', docForm.start_date);
        fd.append('expiry_date', docForm.expiry_date);
        fd.append('file', docForm.file);

        // Get owner info from vehicles
        const vehicle = vehicles.find(v => v.vehicle_number === docForm.vehicle_number);
        if (vehicle) {
            fd.append('owner_name', vehicle.owner_name || '');
            fd.append('owner_email', vehicle.owner_email || '');
        }

        try {
            const res = await fetch(API_DOCS, { method: 'POST', body: fd });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Upload failed'); }
            showToast('Document uploaded successfully');
            setDocForm({ vehicle_number: '', doc_name: '', start_date: '', expiry_date: '', file: null });
            document.getElementById('vdoc-file-input').value = '';
            setShowDocForm(false);
            loadDocs();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSubmitting(false); }
    };

    const handleDeleteDoc = async () => {
        try {
            const res = await fetch(`${API_DOCS}/${deleteId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            setDocs(prev => prev.filter(d => d.id !== deleteId));
            showToast('Document deleted');
        } catch { showToast('Failed to delete document', 'error'); }
        finally { setDeleteId(null); }
    };

    const handlePreview = (doc) => window.open(`http://localhost:9090${doc.file_path}`, '_blank');
    const handleDownload = (doc) => {
        const a = document.createElement('a');
        a.href = `http://localhost:9090${doc.file_path}`;
        a.download = doc.file_name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const handleSendReminder = async (doc) => {
        setSendingEmail(doc.id);
        try {
            const res = await fetch(`${API_DOCS}/${doc.id}/send-reminder`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send email');
            showToast(data.message, 'success');
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSendingEmail(null); }
    };

    const handleSendAllReminders = async () => {
        const alertDocs = [...expiringSoon, ...expired];
        if (alertDocs.length === 0) return;
        setSendingAll(true);
        let sent = 0, failed = 0;
        for (const doc of alertDocs) {
            try { const res = await fetch(`${API_DOCS}/${doc.id}/send-reminder`, { method: 'POST' }); if (!res.ok) { failed++; continue; } sent++; } catch { failed++; }
        }
        showToast(`Sent ${sent} reminder(s)${failed > 0 ? `, ${failed} failed` : ''}`, failed > 0 ? 'warning' : 'success');
        setSendingAll(false);
    };

    const stats = [
        { icon: '📄', label: 'Total Documents', value: docs.length, color: '#3282B8' },
        { icon: '✅', label: 'Valid', value: docs.filter(d => getExpiryStatus(d.expiry_date).days > 30).length, color: '#059669' },
        { icon: '⚠️', label: 'Expiring Soon', value: expiringSoon.length, color: '#d97706' },
        { icon: '🔴', label: 'Expired', value: expired.length, color: '#dc2626' },
    ];

    const updateVehicleField = (field, value) => setVehicleForm(prev => ({ ...prev, [field]: value }));

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Page Header */}
            <div className="page-header">
                <h1>
                    <span className="page-header-icon">🚗</span>
                    Vehicle Documents
                </h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={openAddVehicle}>🚛 Add Vehicle</button>
                    <button className="btn btn-primary" onClick={() => setShowDocForm(true)}>+ Add Document</button>
                </div>
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
                    borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '20px',
                    display: 'flex', flexDirection: 'column', gap: '6px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 700, color: expiringSoon.length > 0 ? 'var(--warning)' : 'var(--danger)' }}>
                            {expiringSoon.length > 0 ? '⚠️ Upcoming Expiry Reminders' : '🔴 Expired Documents'}
                        </div>
                        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'inherit', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.8rem' }} onClick={handleSendAllReminders} disabled={sendingAll}>
                            {sendingAll ? '⏳ Sending…' : '✉️ Send All Reminders'}
                        </button>
                    </div>
                    {[...expiringSoon, ...expired].slice(0, 5).map(d => (
                        <div key={d.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.vehicle_number}</span>
                            <span>—</span><span>{d.doc_name}</span><span>—</span>
                            <span style={{ color: getExpiryStatus(d.expiry_date).days < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                {getExpiryStatus(d.expiry_date).days < 0
                                    ? `Expired ${Math.abs(getExpiryStatus(d.expiry_date).days)} days ago`
                                    : `Expires in ${getExpiryStatus(d.expiry_date).days} days`
                                }
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '2px solid var(--border-color)' }}>
                <button onClick={() => setActiveTab('documents')} style={{
                    padding: '10px 24px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    background: activeTab === 'documents' ? 'var(--primary)' : 'transparent',
                    color: activeTab === 'documents' ? 'white' : 'var(--text-secondary)',
                    borderRadius: '8px 8px 0 0', transition: 'all 0.2s'
                }}>📋 Documents ({docs.length})</button>
                <button onClick={() => setActiveTab('vehicles')} style={{
                    padding: '10px 24px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    background: activeTab === 'vehicles' ? 'var(--primary)' : 'transparent',
                    color: activeTab === 'vehicles' ? 'white' : 'var(--text-secondary)',
                    borderRadius: '8px 8px 0 0', transition: 'all 0.2s'
                }}>🚛 Vehicles ({vehicles.length})</button>
            </div>

            {/* ═══════════════ DOCUMENTS TAB ═══════════════ */}
            {activeTab === 'documents' && (
                <>
                    {/* Add Document Form */}
                    {showDocForm && (
                        <div className="card" style={{ marginBottom: '24px', borderTop: '3px solid var(--primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>📎 Add New Document</h3>
                                <button className="modal-close" onClick={() => setShowDocForm(false)}>✕</button>
                            </div>
                            <form onSubmit={handleDocSubmit}>
                                <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                                    <div className="form-group">
                                        <label className="form-label required">Vehicle</label>
                                        <select className="form-select" name="vehicle_number" value={docForm.vehicle_number} onChange={handleDocChange}>
                                            <option value="">Select vehicle…</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.vehicle_number}>
                                                    {v.vehicle_number} {v.owner_name ? `(${v.owner_name})` : ''} {v.model ? `- ${v.model}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {vehicles.length === 0 && <div className="form-hint" style={{ color: 'var(--danger)' }}>No vehicles added yet. Add a vehicle first.</div>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">Document Name</label>
                                        <input className="form-input" name="doc_name" value={docForm.doc_name} onChange={handleDocChange} placeholder="e.g. RC Book, Insurance, Permit" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">Start Date</label>
                                        <input className="form-input" type="date" name="start_date" value={docForm.start_date} onChange={handleDocChange} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">Expiry Date</label>
                                        <input className="form-input" type="date" name="expiry_date" value={docForm.expiry_date} onChange={handleDocChange} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Attach Document</label>
                                    <input id="vdoc-file-input" className="form-input" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx" onChange={handleDocChange} style={{ padding: '7px 14px' }} />
                                    <div className="form-hint">Accepted: PDF, Images (JPG, PNG), Word, Excel — Max 50MB</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowDocForm(false)} disabled={submitting}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? '⏳ Uploading…' : '📤 Upload Document'}</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Filter & Search Bar */}
                    <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>🔍 Filter:</span>
                            <select className="form-select" value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ minWidth: '200px', padding: '6px 10px', fontSize: '0.85rem' }}>
                                <option value="">All Vehicles</option>
                                {[...new Set(docs.map(d => d.vehicle_number))].sort().map(vn => (
                                    <option key={vn} value={vn}>{vn}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                            <input className="form-input" placeholder="Search by document name…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '6px 12px', fontSize: '0.85rem' }} />
                            {(filterVehicle || searchQuery) && (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setFilterVehicle(''); setSearchQuery(''); }} title="Clear filters">✕</button>
                            )}
                        </div>
                        <span className="badge badge-info">{filteredDocs.length} of {docs.length}</span>
                    </div>

                    {/* Documents Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3>📋 Document Records</h3>
                            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{filteredDocs.length} total</span>
                        </div>

                        {loading ? (
                            <div className="empty-state"><div className="empty-state-icon">⏳</div><p>Loading documents…</p></div>
                        ) : filteredDocs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📂</div>
                                <p>{docs.length === 0 ? 'No vehicle documents yet.' : 'No documents match your filters.'}</p>
                                {docs.length === 0 && <p style={{ marginTop: '6px', fontSize: '0.8rem' }}>Click <strong>+ Add Document</strong> to get started.</p>}
                            </div>
                        ) : (
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Vehicle</th>
                                            <th>Owner</th>
                                            <th>Document</th>
                                            <th>File</th>
                                            <th>Start</th>
                                            <th>Expiry</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDocs.map((doc, i) => {
                                            const status = getExpiryStatus(doc.expiry_date);
                                            return (
                                                <tr key={doc.id}>
                                                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                                    <td>
                                                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                                                            {doc.vehicle_number}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{doc.owner_name || '—'}</div>
                                                        {doc.owner_email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{doc.owner_email}</div>}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.doc_name}</td>
                                                    <td><span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>📎 {doc.file_name}</span></td>
                                                    <td>{formatDate(doc.start_date)}</td>
                                                    <td>{formatDate(doc.expiry_date)}</td>
                                                    <td><span className={`badge badge-${status.type}`}>{status.icon} {status.label}</span></td>
                                                    <td>
                                                        <div className="actions-group">
                                                            <button className="btn btn-sm btn-secondary" title="Preview" onClick={() => handlePreview(doc)}>👁</button>
                                                            <button className="btn btn-sm btn-secondary" title="Download" onClick={() => handleDownload(doc)}>⬇</button>
                                                            {status.days <= 30 && (
                                                                <button className="btn btn-sm" title="Send Expiry Reminder" style={{ background: status.days < 0 ? '#fef2f2' : '#fffbeb', color: status.days < 0 ? '#dc2626' : '#d97706', border: `1px solid ${status.days < 0 ? '#fca5a5' : '#fcd34d'}` }} onClick={() => handleSendReminder(doc)} disabled={sendingEmail === doc.id}>
                                                                    {sendingEmail === doc.id ? '⏳' : '✉️'}
                                                                </button>
                                                            )}
                                                            <button className="btn btn-sm btn-danger" title="Delete" onClick={() => setDeleteId(doc.id)}>🗑</button>
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
                </>
            )}

            {/* ═══════════════ VEHICLES TAB ═══════════════ */}
            {activeTab === 'vehicles' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3>🚛 Registered Vehicles</h3>
                        <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{vehicles.length} total</span>
                    </div>

                    {vehicles.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🚛</div>
                            <p>No vehicles registered yet.</p>
                            <p style={{ marginTop: '6px', fontSize: '0.8rem' }}>Click <strong>🚛 Add Vehicle</strong> to register your first vehicle.</p>
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Vehicle No.</th>
                                        <th>Model</th>
                                        <th>Chassis No.</th>
                                        <th>Engine No.</th>
                                        <th>Reg. Date</th>
                                        <th>Owner</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicles.map((v, i) => (
                                        <tr key={v.id}>
                                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td><span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{v.vehicle_number}</span></td>
                                            <td style={{ fontWeight: 500 }}>{v.model || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{v.chassis_number || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{v.engine_number || '—'}</td>
                                            <td>{formatDate(v.registration_date)}</td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{v.owner_name || '—'}</div>
                                                {v.owner_email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{v.owner_email}</div>}
                                            </td>
                                            <td>
                                                <div className="actions-group">
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditVehicle(v)} title="Edit">✏️</button>
                                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteVehicle(v)} title="Delete">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ ADD/EDIT VEHICLE MODAL ═══════════════ */}
            {showVehicleModal && (
                <div className="modal-overlay" onClick={() => setShowVehicleModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{editingVehicle ? '✏️ Edit Vehicle' : '🚛 Add Vehicle'}</h2>
                            <button className="modal-close" onClick={() => setShowVehicleModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSaveVehicle}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label required">Vehicle Number</label>
                                        <input className="form-input" value={vehicleForm.vehicle_number} onChange={e => updateVehicleField('vehicle_number', e.target.value)} placeholder="e.g. MH12AB1234" style={{ textTransform: 'uppercase' }} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Model</label>
                                        <input className="form-input" value={vehicleForm.model} onChange={e => updateVehicleField('model', e.target.value)} placeholder="e.g. Tata Ace, Eicher" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Chassis Number</label>
                                        <input className="form-input" value={vehicleForm.chassis_number} onChange={e => updateVehicleField('chassis_number', e.target.value)} placeholder="Chassis number" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Engine Number</label>
                                        <input className="form-input" value={vehicleForm.engine_number} onChange={e => updateVehicleField('engine_number', e.target.value)} placeholder="Engine number" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Registration Date</label>
                                        <input className="form-input" type="date" value={vehicleForm.registration_date} onChange={e => updateVehicleField('registration_date', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Owner Email</label>
                                        <input className="form-input" type="email" value={vehicleForm.owner_email} onChange={e => updateVehicleField('owner_email', e.target.value)} placeholder="owner@email.com" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Owner Name</label>
                                        <input className="form-input" value={vehicleForm.owner_name} onChange={e => updateVehicleField('owner_name', e.target.value)} placeholder="Owner name" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Owner Address</label>
                                        <input className="form-input" value={vehicleForm.owner_address} onChange={e => updateVehicleField('owner_address', e.target.value)} placeholder="Owner address" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowVehicleModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════ DELETE DOCUMENT MODAL ═══════════════ */}
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
                            <button className="btn btn-danger" onClick={handleDeleteDoc}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
