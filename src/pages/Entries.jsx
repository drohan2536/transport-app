import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

const today = () => new Date().toISOString().split('T')[0];

const emptyEntry = {
    client_id: '', date: today(), from_location: '', to_location: '',
    has_challan: false, challan_number: '', has_vehicle: false, vehicle_number: '',
    entry_type: 'per_kg',
    unit: 'cm', length: '', width: '', gsm: '', packaging: '', no_of_packets: '',
    rate_per_kg: '',
    no_of_bundles: '', rate_per_bundle: '',
    has_loading_charges: false, loading_charges: '',
};

export default function Entries() {
    const showToast = useToast();
    const [entries, setEntries] = useState([]);
    const [clients, setClients] = useState([]);
    const [form, setForm] = useState({ ...emptyEntry });
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [ents, cls] = await Promise.all([api.getEntries(), api.getClients()]);
            setEntries(ents);
            setClients(cls);
        } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // Auto-calculations
    const calculations = useMemo(() => {
        if (form.entry_type === 'per_kg') {
            const l = parseFloat(form.length) || 0;
            const w = parseFloat(form.width) || 0;
            const g = parseFloat(form.gsm) || 0;
            const pkg = parseFloat(form.packaging) || 0;
            const packets = parseInt(form.no_of_packets) || 0;
            const rate = parseFloat(form.rate_per_kg) || 0;
            const divisor = form.unit === 'inches' ? 3100 : 20000;
            const weight = (l * w * g) / divisor / 5 * pkg * packets;
            const amount = weight * rate;
            const lc = form.has_loading_charges ? (parseFloat(form.loading_charges) || 0) : 0;
            return { weight: Math.round(weight * 100) / 100, amount: Math.round(amount * 100) / 100, total: Math.round((amount + lc) * 100) / 100 };
        } else {
            const bundles = parseInt(form.no_of_bundles) || 0;
            const rate = parseFloat(form.rate_per_bundle) || 0;
            const amount = bundles * rate;
            const lc = form.has_loading_charges ? (parseFloat(form.loading_charges) || 0) : 0;
            return { weight: 0, amount: Math.round(amount * 100) / 100, total: Math.round((amount + lc) * 100) / 100 };
        }
    }, [form]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.client_id || !form.date) {
            showToast('Client and Date are required', 'error');
            return;
        }
        const data = {
            ...form,
            client_id: Number(form.client_id),
            length: parseFloat(form.length) || 0,
            width: parseFloat(form.width) || 0,
            gsm: parseFloat(form.gsm) || 0,
            packaging: parseFloat(form.packaging) || 0,
            no_of_packets: parseInt(form.no_of_packets) || 0,
            rate_per_kg: parseFloat(form.rate_per_kg) || 0,
            no_of_bundles: parseInt(form.no_of_bundles) || 0,
            rate_per_bundle: parseFloat(form.rate_per_bundle) || 0,
            loading_charges: form.has_loading_charges ? (parseFloat(form.loading_charges) || 0) : 0,
        };

        try {
            if (editing) {
                await api.updateEntry(editing.id, data);
                showToast('Entry updated');
            } else {
                await api.createEntry(data);
                showToast('Entry saved');
            }
            setForm({ ...emptyEntry });
            setEditing(null);
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleEdit = (entry) => {
        setEditing(entry);
        setForm({
            client_id: entry.client_id,
            date: entry.date,
            from_location: entry.from_location,
            to_location: entry.to_location,
            has_challan: !!entry.has_challan,
            challan_number: entry.challan_number || '',
            has_vehicle: !!entry.has_vehicle,
            vehicle_number: entry.vehicle_number || '',
            entry_type: entry.entry_type,
            unit: entry.unit || 'cm',
            length: entry.length || '',
            width: entry.width || '',
            gsm: entry.gsm || '',
            packaging: entry.packaging || '',
            no_of_packets: entry.no_of_packets || '',
            rate_per_kg: entry.rate_per_kg || '',
            no_of_bundles: entry.no_of_bundles || '',
            rate_per_bundle: entry.rate_per_bundle || '',
            has_loading_charges: !!entry.has_loading_charges,
            loading_charges: entry.loading_charges || '',
        });
    };

    const handleDelete = async (entry) => {
        if (!confirm('Delete this entry?')) return;
        try {
            await api.deleteEntry(entry.id);
            showToast('Entry deleted');
            load();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const cancelEdit = () => {
        setEditing(null);
        setForm({ ...emptyEntry });
    };

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">📋</span> Daily Entries</h1>
            </div>

            {/* Entry Form */}
            <div className="card mb-lg">
                <h3 style={{ marginBottom: 'var(--space-md)' }}>{editing ? '✏️ Edit Entry' : '➕ New Entry'}</h3>
                <form onSubmit={handleSave}>
                    {/* Common Fields */}
                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="form-group">
                            <label className="form-label required">Client</label>
                            <select className="form-select" value={form.client_id} onChange={e => updateField('client_id', e.target.value)} required>
                                <option value="">Select client…</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Date</label>
                            <input className="form-input" type="date" value={form.date} onChange={e => updateField('date', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Entry Type</label>
                            <select className="form-select" value={form.entry_type} onChange={e => updateField('entry_type', e.target.value)}>
                                <option value="per_kg">Per Kg</option>
                                <option value="per_bundle">Per Bundle</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="form-group">
                            <label className="form-label">From Location</label>
                            <input className="form-input" value={form.from_location} onChange={e => updateField('from_location', e.target.value)} placeholder="Origin" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Location</label>
                            <input className="form-input" value={form.to_location} onChange={e => updateField('to_location', e.target.value)} placeholder="Destination" />
                        </div>
                    </div>

                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="form-group">
                            <div className="form-check mb-md">
                                <input type="checkbox" id="has_challan" checked={form.has_challan} onChange={e => updateField('has_challan', e.target.checked)} />
                                <label htmlFor="has_challan">Challan Number</label>
                            </div>
                            {form.has_challan && (
                                <input className="form-input" value={form.challan_number} onChange={e => updateField('challan_number', e.target.value)} placeholder="Enter challan number" />
                            )}
                        </div>
                        <div className="form-group">
                            <div className="form-check mb-md">
                                <input type="checkbox" id="has_vehicle" checked={form.has_vehicle} onChange={e => updateField('has_vehicle', e.target.checked)} />
                                <label htmlFor="has_vehicle">Vehicle Number</label>
                            </div>
                            {form.has_vehicle && (
                                <input className="form-input" value={form.vehicle_number} onChange={e => updateField('vehicle_number', e.target.value)} placeholder="Enter vehicle number" />
                            )}
                        </div>
                    </div>

                    {/* Per Kg Fields */}
                    {form.entry_type === 'per_kg' && (
                        <>
                            <div className="form-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                                <div className="form-group">
                                    <label className="form-label">Unit</label>
                                    <select className="form-select" value={form.unit} onChange={e => updateField('unit', e.target.value)}>
                                        <option value="cm">CM</option>
                                        <option value="inches">Inches</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Length</label>
                                    <input className="form-input" type="number" step="any" value={form.length} onChange={e => updateField('length', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Width</label>
                                    <input className="form-input" type="number" step="any" value={form.width} onChange={e => updateField('width', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">GSM</label>
                                    <input className="form-input" type="number" step="any" value={form.gsm} onChange={e => updateField('gsm', e.target.value)} placeholder="0" />
                                </div>
                            </div>
                            <div className="form-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                                <div className="form-group">
                                    <label className="form-label">Packaging</label>
                                    <input className="form-input" type="number" step="any" value={form.packaging} onChange={e => updateField('packaging', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">No. of Packets</label>
                                    <input className="form-input" type="number" value={form.no_of_packets} onChange={e => updateField('no_of_packets', e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Weight (auto)</label>
                                    <input className="form-input form-calculated" value={calculations.weight} readOnly />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rate per Kg (₹)</label>
                                    <input className="form-input" type="number" step="any" value={form.rate_per_kg} onChange={e => updateField('rate_per_kg', e.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Per Bundle Fields */}
                    {form.entry_type === 'per_bundle' && (
                        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="form-group">
                                <label className="form-label">No. of Bundles</label>
                                <input className="form-input" type="number" value={form.no_of_bundles} onChange={e => updateField('no_of_bundles', e.target.value)} placeholder="0" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rate per Bundle (₹)</label>
                                <input className="form-input" type="number" step="any" value={form.rate_per_bundle} onChange={e => updateField('rate_per_bundle', e.target.value)} placeholder="0.00" />
                            </div>
                        </div>
                    )}

                    {/* Loading Charges + Totals */}
                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="form-group">
                            <div className="form-check mb-md">
                                <input type="checkbox" id="has_loading" checked={form.has_loading_charges} onChange={e => updateField('has_loading_charges', e.target.checked)} />
                                <label htmlFor="has_loading">Loading / Unloading Charges</label>
                            </div>
                            {form.has_loading_charges && (
                                <input className="form-input" type="number" step="any" value={form.loading_charges} onChange={e => updateField('loading_charges', e.target.value)} placeholder="0.00" />
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Amount (auto)</label>
                            <input className="form-input form-calculated" value={`₹ ${calculations.amount.toFixed(2)}`} readOnly />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--accent-primary)' }}>Total Amount (auto)</label>
                            <input className="form-input form-calculated" style={{ fontSize: '1.05rem', color: 'var(--accent-primary-hover)', fontWeight: 700 }} value={`₹ ${calculations.total.toFixed(2)}`} readOnly />
                        </div>
                    </div>

                    <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
                        <button type="submit" className="btn btn-primary">{editing ? '💾 Update Entry' : '💾 Save Entry'}</button>
                        {editing && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
                    </div>
                </form>
            </div>

            {/* Entries Table */}
            <h3 style={{ marginBottom: 'var(--space-md)' }}>Recent Entries</h3>
            {entries.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p>No entries yet. Create your first delivery entry above.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Client</th>
                                <th>Route</th>
                                <th>Type</th>
                                <th>Challan</th>
                                <th>Vehicle</th>
                                <th className="text-right">Amount</th>
                                <th className="text-right">Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.id}>
                                    <td className="font-mono">{e.date}</td>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.client_name}</td>
                                    <td>{e.from_location && e.to_location ? `${e.from_location} → ${e.to_location}` : '—'}</td>
                                    <td><span className="badge badge-info">{e.entry_type === 'per_kg' ? 'Per Kg' : 'Per Bundle'}</span></td>
                                    <td>{e.has_challan ? e.challan_number : '—'}</td>
                                    <td>{e.has_vehicle ? e.vehicle_number : '—'}</td>
                                    <td className="text-right font-mono">₹{(e.amount || 0).toFixed(2)}</td>
                                    <td className="text-right font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{(e.total_amount || 0).toFixed(2)}</td>
                                    <td>
                                        {e.invoice_id
                                            ? <span className="badge badge-success">Invoiced</span>
                                            : <span className="badge badge-warning">Open</span>
                                        }
                                    </td>
                                    <td>
                                        <div className="actions-group">
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(e)} title="Edit" disabled={!!e.invoice_id}>✏️</button>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(e)} title="Delete" disabled={!!e.invoice_id}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
