import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

const emptyCompany = { name: '', address: '', email: '', phone: '', owner_name: '', pan_id: '' };

export default function Companies() {
    const showToast = useToast();
    const [companies, setCompanies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ ...emptyCompany });
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try { setCompanies(await api.getCompanies()); }
        catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openAdd = () => { setEditing(null); setForm({ ...emptyCompany }); setShowModal(true); };
    const openEdit = (c) => { setEditing(c); setForm({ name: c.name, address: c.address, email: c.email, phone: c.phone, owner_name: c.owner_name, pan_id: c.pan_id }); setShowModal(true); };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.pan_id) {
            showToast('Please fill all mandatory fields', 'error');
            return;
        }
        try {
            if (editing) {
                await api.updateCompany(editing.id, form);
                showToast('Company updated');
            } else {
                await api.createCompany(form);
                showToast('Company added');
            }
            setShowModal(false);
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleDelete = async (c) => {
        if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
        try {
            await api.deleteCompany(c.id);
            showToast('Company deleted');
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleUpload = async (companyId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.jpg,.jpeg,.png';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await api.uploadCertificate(companyId, file);
                showToast('Certificate uploaded');
                load();
            } catch (err) { showToast(err.message, 'error'); }
        };
        input.click();
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">🏢</span> Companies</h1>
                <button className="btn btn-primary" onClick={openAdd}>+ Add Company</button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : companies.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🏢</div>
                    <p>No companies yet. Add your first company to get started.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Company Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Owner</th>
                                <th>PAN ID</th>
                                <th>Certificate</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map(c => (
                                <tr key={c.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.name}</td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>{c.owner_name || '—'}</td>
                                    <td><span className="font-mono">{c.pan_id}</span></td>
                                    <td>
                                        {c.udyam_certificate_path ? (
                                            <span className="badge badge-success">✓ Uploaded</span>
                                        ) : (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleUpload(c.id)}>📎 Upload</button>
                                        )}
                                    </td>
                                    <td>
                                        <div className="actions-group">
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Edit">✏️</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleUpload(c.id)} title="Upload Certificate">📎</button>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(c)} title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Company' : 'Add Company'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label required">Company Name</label>
                                    <input className="form-input" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Krishna Govinda Transport Services" required />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label required">Email ID</label>
                                        <input className="form-input" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="company@example.com" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">PAN ID</label>
                                        <input className="form-input" value={form.pan_id} onChange={e => updateField('pan_id', e.target.value)} placeholder="ABCDE1234F" required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea className="form-textarea" value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Full address" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Phone Number</label>
                                        <input className="form-input" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+91 99999 99999" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Owner Name</label>
                                        <input className="form-input" value={form.owner_name} onChange={e => updateField('owner_name', e.target.value)} placeholder="Owner name" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add Company'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
