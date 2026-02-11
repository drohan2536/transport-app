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

    // Document Management State
    const [showDocsModal, setShowDocsModal] = useState(false);
    const [currentCompany, setCurrentCompany] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);

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

    // --- Document Management ---

    const openDocuments = async (company) => {
        setCurrentCompany(company);
        setShowDocsModal(true);
        loadDocuments(company.id);
    };

    const loadDocuments = async (companyId) => {
        try {
            const docs = await api.getCompanyDocuments(companyId);
            setDocuments(docs);
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleUpload = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.jpg,.jpeg,.png'; // Allow multiple? input.multiple = true;
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setUploading(true);
            try {
                await api.uploadCompanyDocument(currentCompany.id, file);
                showToast('Document uploaded successfully');
                loadDocuments(currentCompany.id);
            } catch (err) { showToast(err.message, 'error'); }
            setUploading(false);
        };
        input.click();
    };

    const handleDownload = (doc) => {
        // Create a temporary link to force download
        const link = document.createElement('a');
        link.href = `http://localhost:3001${doc.file_path}`;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDeleteDocument = async (doc) => {
        if (!confirm('Delete this document?')) return;
        try {
            await api.deleteCompanyDocument(currentCompany.id, doc.id);
            showToast('Document deleted');
            loadDocuments(currentCompany.id);
        } catch (e) { showToast(e.message, 'error'); }
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
                                <th>Certificates</th>
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
                                        <button className="btn btn-ghost btn-sm" onClick={() => openDocuments(c)} title="Manage Documents">
                                            📎 Manage
                                        </button>
                                    </td>
                                    <td>
                                        <div className="actions-group">
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} title="Edit">✏️</button>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(c)} title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit/Add Company Modal */}
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

            {/* Manage Documents Modal */}
            {showDocsModal && currentCompany && (
                <div className="modal-overlay" onClick={() => setShowDocsModal(false)}>
                    <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Documents: {currentCompany.name}</h2>
                            <button className="modal-close" onClick={() => setShowDocsModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="flex-between mb-md">
                                <p style={{ color: 'var(--text-secondary)' }}>manage certificates and documents.</p>
                                <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>
                                    {uploading ? 'Uploading...' : '+ Upload New'}
                                </button>
                            </div>

                            {documents.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    <p>No documents uploaded yet.</p>
                                </div>
                            ) : (
                                <div className="list-group">
                                    {documents.map(doc => (
                                        <div key={doc.id} className="card flex-between mb-sm" style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>📄</span>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{doc.file_name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-sm">
                                                <a
                                                    href={`http://localhost:3001${doc.file_path}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost btn-sm"
                                                    title="View"
                                                >
                                                    👁️
                                                </a>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleDownload(doc)}
                                                    title="Download"
                                                >
                                                    ⬇️
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm text-danger"
                                                    onClick={() => handleDeleteDocument(doc)}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDocsModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
