import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

const emptyContact = { name: '', phone: '', email: '' }; // Default columns to match Dashboard.jsx logic
const defaultColumns = ['date', 'from_location', 'to_location', 'entry_type', 'challan_number', 'vehicle_number', 'weight', 'no_of_bundles', 'amount', 'loading_charges', 'total_amount'];
const emptyClient = { name: '', address: '', company_id: '', invoice_visible_columns: defaultColumns, contacts: [{ ...emptyContact }], default_entry_type: '', default_rate: '', default_from_location: '', default_to_location: '' };

// Columns that are always enabled and cannot be unchecked
const ALWAYS_ON_COLUMNS = ['weight', 'no_of_bundles'];

const INVOICE_COLUMNS = [
    { id: 'date', label: 'Date' },
    { id: 'from_location', label: 'From' },
    { id: 'to_location', label: 'To' },
    { id: 'challan_number', label: 'Challan No' },
    { id: 'vehicle_number', label: 'Vehicle No' },
    { id: 'entry_type', label: 'Entry Type' },
    { id: 'unit', label: 'Unit' },
    { id: 'length', label: 'Length' },
    { id: 'width', label: 'Width' },
    { id: 'gsm', label: 'GSM' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'no_of_packets', label: 'No. of Packets' },
    { id: 'weight', label: 'Weight' },
    { id: 'rate_per_kg', label: 'Rate per Kg' },
    { id: 'no_of_bundles', label: 'No of Bundle' },
    { id: 'rate_per_bundle', label: 'Rate per Bundle' },
    { id: 'amount', label: 'Amount' },
    { id: 'loading_charges', label: 'Loading/Unloading Charges' },
    { id: 'total_amount', label: 'Total Amount' },
];

export default function Clients() {
    const showToast = useToast();
    const [clients, setClients] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ ...emptyClient });
    const [loading, setLoading] = useState(true);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [cls, cos] = await Promise.all([api.getClients(), api.getCompanies()]);
            setClients(cls);
            setCompanies(cos);
        } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filteredClients = selectedCompanyId
        ? clients.filter(c => c.company_id === Number(selectedCompanyId))
        : clients;

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyClient, company_id: companies[0]?.id || '', invoice_visible_columns: defaultColumns, contacts: [{ ...emptyContact }], default_entry_type: '', default_rate: '', default_from_location: '', default_to_location: '' });
        setShowModal(true);
    };

    const openEdit = (c) => {
        setEditing(c);
        let visibleCols = [];
        try { visibleCols = JSON.parse(c.invoice_visible_columns || '[]'); } catch (e) { }

        setForm({
            name: c.name,
            address: c.address,
            company_id: c.company_id,
            invoice_visible_columns: visibleCols,
            contacts: c.contacts.length > 0 ? c.contacts.map(cp => ({ name: cp.name, phone: cp.phone, email: cp.email })) : [{ ...emptyContact }],
            default_entry_type: c.default_entry_type || '',
            default_rate: c.default_rate != null ? c.default_rate : '',
            default_from_location: c.default_from_location || '',
            default_to_location: c.default_to_location || ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name || !form.company_id) {
            showToast('Client Name and Company are required', 'error');
            return;
        }
        try {
            // Ensure weight and no_of_bundles are always included
            let cols = form.invoice_visible_columns || [];
            if (!cols.includes('weight')) cols = [...cols, 'weight'];
            if (!cols.includes('no_of_bundles')) cols = [...cols, 'no_of_bundles'];
            const data = { ...form, invoice_visible_columns: cols, contacts: form.contacts.filter(c => c.name || c.phone || c.email) };
            if (editing) {
                await api.updateClient(editing.id, data);
                showToast('Client updated');
            } else {
                await api.createClient(data);
                showToast('Client added');
            }
            setShowModal(false);
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleDelete = async (c) => {
        if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
        try {
            await api.deleteClient(c.id);
            showToast('Client deleted');
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const toggleColumn = (colId) => {
        // weight and no_of_bundles are always on — cannot be toggled off
        if (ALWAYS_ON_COLUMNS.includes(colId)) return;
        setForm(prev => {
            const current = prev.invoice_visible_columns || [];
            if (current.includes(colId)) return { ...prev, invoice_visible_columns: current.filter(c => c !== colId) };
            return { ...prev, invoice_visible_columns: [...current, colId] };
        });
    };

    const updateContact = (idx, field, value) => {
        setForm(prev => {
            const contacts = [...prev.contacts];
            contacts[idx] = { ...contacts[idx], [field]: value };
            return { ...prev, contacts };
        });
    };

    const addContact = () => setForm(prev => ({ ...prev, contacts: [...prev.contacts, { ...emptyContact }] }));

    const removeContact = (idx) => {
        if (form.contacts.length <= 1) return;
        setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== idx) }));
    };

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">👥</span> Clients</h1>

                <div className="flex gap-md" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                        className="form-select"
                        style={{ width: '200px' }}
                        value={selectedCompanyId}
                        onChange={e => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">All Companies</option>
                        {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={openAdd} disabled={companies.length === 0}>+ Add Client</button>
                </div>
            </div>

            {companies.length === 0 && (
                <div className="card mb-lg" style={{ borderColor: 'var(--warning)', background: 'var(--warning-bg)' }}>
                    <p style={{ color: 'var(--warning)', fontWeight: 600 }}>⚠️ Please add at least one company before adding clients.</p>
                </div>
            )}

            {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : filteredClients.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <p>{selectedCompanyId ? 'No clients found for this company.' : 'No clients yet. Add your first client to get started.'}</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                {/* Company column removed as requested */}
                                <th>Address</th>
                                <th>Contacts</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(c => (
                                <tr key={c.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.name}</td>
                                    {/* <td><span className="badge badge-info">{c.company_name}</span></td> */}
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address || '—'}</td>
                                    <td>
                                        {c.contacts.length > 0 ? c.contacts.map((cp, i) => (
                                            <div key={i} style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                                                {cp.name}{cp.phone ? ` · ${cp.phone}` : ''}{cp.email ? ` · ${cp.email}` : ''}
                                            </div>
                                        )) : '—'}
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

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Client' : 'Add Client'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label required">Client Name</label>
                                        <input className="form-input" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Client company name" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">Company</label>
                                        <select className="form-select" value={form.company_id} onChange={e => updateField('company_id', Number(e.target.value))} required>
                                            <option value="">Select company…</option>
                                            {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea className="form-textarea" value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Full address" />
                                </div>

                                {/* Default Entry Settings */}
                                <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '0.95rem' }}>📋 Default Entry Settings <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)' }}>(optional — auto-fills in Daily Entries)</span></h3>
                                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <div className="form-group">
                                            <label className="form-label">Default Entry Type</label>
                                            <select className="form-select" value={form.default_entry_type} onChange={e => updateField('default_entry_type', e.target.value)}>
                                                <option value="">None</option>
                                                <option value="per_kg">Per Kg</option>
                                                <option value="per_bundle">Per Bundle</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Default Rate (₹)</label>
                                            <input className="form-input" type="number" step="any" value={form.default_rate} onChange={e => updateField('default_rate', e.target.value)} placeholder="e.g. 3.50" />
                                        </div>
                                    </div>
                                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                        <div className="form-group">
                                            <label className="form-label">Default From Location</label>
                                            <input className="form-input" value={form.default_from_location} onChange={e => updateField('default_from_location', e.target.value)} placeholder="e.g. Warehouse A" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Default To Location</label>
                                            <input className="form-input" value={form.default_to_location} onChange={e => updateField('default_to_location', e.target.value)} placeholder="e.g. Factory B" />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Invoice Visible Columns</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                                        {INVOICE_COLUMNS.map(col => {
                                            const isAlwaysOn = ALWAYS_ON_COLUMNS.includes(col.id);
                                            return (
                                                <label key={col.id} className="form-check" style={isAlwaysOn ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isAlwaysOn || (form.invoice_visible_columns || []).includes(col.id)}
                                                        onChange={() => toggleColumn(col.id)}
                                                        disabled={isAlwaysOn}
                                                    />
                                                    <span>{col.label}{isAlwaysOn ? ' (always on)' : ''}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="form-hint">Selected columns will appear on the generated invoice PDF for this client. "Weight" and "No of Bundle" are always enabled and merged into a single column.</div>
                                </div>

                                {/* Contact Persons */}
                                <div className="flex-between mb-md" style={{ marginTop: 'var(--space-lg)' }}>
                                    <h3>Contact Persons</h3>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={addContact}>+ Add Contact</button>
                                </div>
                                {form.contacts.map((cp, idx) => (
                                    <div key={idx} className="card mb-md" style={{ padding: 'var(--space-md)', background: 'var(--bg-secondary)' }}>
                                        <div className="flex-between mb-md">
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact #{idx + 1}</span>
                                            {form.contacts.length > 1 && (
                                                <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeContact(idx)}>✕ Remove</button>
                                            )}
                                        </div>
                                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Name</label>
                                                <input className="form-input" value={cp.name} onChange={e => updateContact(idx, 'name', e.target.value)} placeholder="Contact name" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Phone</label>
                                                <input className="form-input" value={cp.phone} onChange={e => updateContact(idx, 'phone', e.target.value)} placeholder="+91 99999 99999" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Email</label>
                                                <input className="form-input" type="email" value={cp.email} onChange={e => updateContact(idx, 'email', e.target.value)} placeholder="email@example.com" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add Client'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
