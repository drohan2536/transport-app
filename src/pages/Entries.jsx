import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';

const today = () => new Date().toISOString().split('T')[0];
const firstDayOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
};

const emptySubEntryKg = { unit: 'cm', length: '', width: '', gsm: '', packaging: '', no_of_packets: '', weight: '' };
const emptySubEntryBundle = { no_of_bundles: '' };

const emptyEntry = {
    client_id: '', date: today(), from_location: '', to_location: '',
    has_challan: false, challan_number: '', has_vehicle: false, vehicle_number: '',
    entry_type: 'per_kg',
    num_entries: 1,
    unit: 'cm', length: '', width: '', gsm: '', packaging: '', no_of_packets: '',
    weight: '',
    rate_per_kg: '',
    no_of_bundles: '', rate_per_bundle: '',
    has_loading_charges: false, loading_charges: '',
    amount: '',
    total_amount: ''
};

export default function Entries() {
    const showToast = useToast();
    const [entries, setEntries] = useState([]);
    const [clients, setClients] = useState([]);
    const [form, setForm] = useState({ ...emptyEntry });
    const [subEntries, setSubEntries] = useState([{ ...emptySubEntryKg }]);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Track which auto-calculated fields have been manually overridden
    const [overrides, setOverrides] = useState({
        subWeights: {},  // { [index]: true } — individual sub-entry weights
        totalWeight: false,
        totalBundles: false,
        amount: false,
        totalAmount: false,
    });

    // Dashboard Filters
    const [filters, setFilters] = useState({
        client_id: '',
        from_date: firstDayOfMonth(),
        to_date: today()
    });

    const loadClients = async () => {
        try {
            const cls = await api.getClients();
            setClients(cls);
        } catch (e) { showToast(e.message, 'error'); }
    };

    const loadEntries = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.client_id) params.client_id = filters.client_id;
            if (filters.from_date) params.from_date = filters.from_date;
            if (filters.to_date) params.to_date = filters.to_date;

            const ents = await api.getEntries(params);
            setEntries(ents);
        } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    useEffect(() => { loadClients(); }, []);
    useEffect(() => { loadEntries(); }, [filters]); // Initial load and re-load on filter change

    // Resize sub-entries when num_entries or entry_type changes
    useEffect(() => {
        const count = Math.max(1, parseInt(form.num_entries) || 1);
        setSubEntries(prev => {
            const template = form.entry_type === 'per_kg' ? emptySubEntryKg : emptySubEntryBundle;
            const newArr = [];
            for (let i = 0; i < count; i++) {
                newArr.push(prev[i] ? { ...template, ...prev[i] } : { ...template });
            }
            return newArr;
        });
    }, [form.num_entries, form.entry_type]);

    // Helper: update a single sub-entry field
    const updateSubEntry = useCallback((index, field, value) => {
        setSubEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }, []);

    // Auto-calculate weight for each per_kg sub-entry (skip if user overrode)
    useEffect(() => {
        if (form.entry_type !== 'per_kg') return;
        setSubEntries(prev => {
            let changed = false;
            const updated = prev.map((se, idx) => {
                if (overrides.subWeights[idx]) return se; // user overrode this weight
                const l = parseFloat(se.length);
                const w = parseFloat(se.width);
                const g = parseFloat(se.gsm);
                const pkg = parseFloat(se.packaging);
                const packets = parseInt(se.no_of_packets);
                if (!isNaN(l) && !isNaN(w) && !isNaN(g) && !isNaN(pkg) && !isNaN(packets)) {
                    const divisor = (se.unit || 'cm') === 'inches' ? 3100 : 20000;
                    const calcWeight = (l * w * g) / divisor / 5 * pkg * packets;
                    const newWeight = (Math.round(calcWeight * 100) / 100).toString();
                    if (se.weight !== newWeight) { changed = true; return { ...se, weight: newWeight }; }
                } else if (se.weight !== '') {
                    changed = true; return { ...se, weight: '' };
                }
                return se;
            });
            return changed ? updated : prev;
        });
    }, [subEntries.map(s => `${s.length}|${s.width}|${s.gsm}|${s.packaging}|${s.no_of_packets}|${s.unit}`).join(','), form.entry_type, overrides.subWeights]);

    // Sum sub-entry weights/bundles into the main form (skip if user overrode)
    useEffect(() => {
        if (form.entry_type === 'per_kg') {
            if (overrides.totalWeight) return;
            const totalWeight = subEntries.reduce((sum, se) => sum + (parseFloat(se.weight) || 0), 0);
            const rounded = (Math.round(totalWeight * 100) / 100).toString();
            setForm(prev => prev.weight !== rounded ? { ...prev, weight: rounded } : prev);
        } else {
            if (overrides.totalBundles) return;
            const totalBundles = subEntries.reduce((sum, se) => sum + (parseInt(se.no_of_bundles) || 0), 0);
            const str = totalBundles.toString();
            setForm(prev => prev.no_of_bundles !== str ? { ...prev, no_of_bundles: str } : prev);
        }
    }, [subEntries, form.entry_type, overrides.totalWeight, overrides.totalBundles]);

    // Amount calculation (skip if user overrode)
    useEffect(() => {
        if (overrides.amount) return;
        let amount = 0;
        if (form.entry_type === 'per_kg') {
            const w = parseFloat(form.weight) || 0;
            const r = parseFloat(form.rate_per_kg) || 0;
            amount = w * r;
        } else {
            const b = parseInt(form.no_of_bundles) || 0;
            const r = parseFloat(form.rate_per_bundle) || 0;
            amount = b * r;
        }
        setForm(prev => ({ ...prev, amount: (Math.round(amount * 100) / 100).toString() }));
    }, [form.weight, form.rate_per_kg, form.no_of_bundles, form.rate_per_bundle, form.entry_type, overrides.amount]);

    useEffect(() => {
        if (overrides.totalAmount) return;
        const amt = parseFloat(form.amount) || 0;
        const lc = form.has_loading_charges ? (parseFloat(form.loading_charges) || 0) : 0;
        setForm(prev => ({ ...prev, total_amount: (Math.round((amt + lc) * 100) / 100).toString() }));
    }, [form.amount, form.loading_charges, form.has_loading_charges, overrides.totalAmount]);


    const resetOverrides = () => setOverrides({ subWeights: {}, totalWeight: false, totalBundles: false, amount: false, totalAmount: false });

    const openAdd = () => {
        setEditing(null);
        setForm({ ...emptyEntry, client_id: filters.client_id || '' });
        setSubEntries([{ ...emptySubEntryKg }]);
        resetOverrides();
        setShowModal(true);
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
            num_entries: 1,
            unit: entry.unit || 'cm',
            length: entry.length || '',
            width: entry.width || '',
            gsm: entry.gsm || '',
            packaging: entry.packaging || '',
            no_of_packets: entry.no_of_packets || '',
            weight: entry.weight || '',
            rate_per_kg: entry.rate_per_kg || '',
            no_of_bundles: entry.no_of_bundles || '',
            rate_per_bundle: entry.rate_per_bundle || '',
            has_loading_charges: !!entry.has_loading_charges,
            loading_charges: entry.loading_charges || '',
            amount: entry.amount || '',
            total_amount: entry.total_amount || ''
        });
        // Populate first sub-entry with saved values
        if (entry.entry_type === 'per_kg') {
            setSubEntries([{
                unit: entry.unit || 'cm',
                length: entry.length ? entry.length.toString() : '',
                width: entry.width ? entry.width.toString() : '',
                gsm: entry.gsm ? entry.gsm.toString() : '',
                packaging: entry.packaging ? entry.packaging.toString() : '',
                no_of_packets: entry.no_of_packets ? entry.no_of_packets.toString() : '',
                weight: entry.weight ? entry.weight.toString() : ''
            }]);
        } else {
            setSubEntries([{
                no_of_bundles: entry.no_of_bundles ? entry.no_of_bundles.toString() : ''
            }]);
        }
        resetOverrides();
        setShowModal(true);
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

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
            weight: parseFloat(form.weight) || 0,
            rate_per_kg: parseFloat(form.rate_per_kg) || 0,
            no_of_bundles: parseInt(form.no_of_bundles) || 0,
            rate_per_bundle: parseFloat(form.rate_per_bundle) || 0,
            loading_charges: form.has_loading_charges ? (parseFloat(form.loading_charges) || 0) : 0,
            amount: parseFloat(form.amount) || 0,
            total_amount: parseFloat(form.total_amount) || 0
        };

        try {
            if (editing) {
                await api.updateEntry(editing.id, data);
                showToast('Entry updated');
            } else {
                await api.createEntry(data);
                showToast('Entry saved');
            }
            setShowModal(false);
            loadEntries();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleDelete = async (entry) => {
        if (!confirm('Delete this entry?')) return;
        try {
            await api.deleteEntry(entry.id);
            showToast('Entry deleted');
            loadEntries();
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">📋</span> Daily Entries</h1>
                <button className="btn btn-primary" onClick={openAdd}>+ Add Entry</button>
            </div>

            {/* Dashboard Filters */}
            <div className="card mb-lg" style={{ padding: '15px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Client</label>
                        <select
                            className="form-select"
                            value={filters.client_id}
                            onChange={e => setFilters(p => ({ ...p, client_id: e.target.value }))}
                        >
                            <option value="">All Clients</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="form-label">From Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={filters.from_date}
                            onChange={e => setFilters(p => ({ ...p, from_date: e.target.value }))}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="form-label">To Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={filters.to_date}
                            onChange={e => setFilters(p => ({ ...p, to_date: e.target.value }))}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={loadEntries} disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {/* Entries Table */}
            {entries.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p>No entries found. Adjust filters or add a new entry.</p>
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
                                <th className="text-right">Weight</th>
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
                                    <td className="text-right font-mono">{e.weight || '-'}</td>
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

            {/* Entry Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Entry' : 'Add New Entry'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
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

                                {/* Number of Entries */}
                                <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="form-group">
                                        <label className="form-label">Number of Entries</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={form.num_entries}
                                            onChange={e => updateField('num_entries', Math.max(1, parseInt(e.target.value) || 1))}
                                            style={{ maxWidth: '120px' }}
                                        />
                                    </div>
                                </div>

                                {/* Per Kg Sub-Entry Rows */}
                                {form.entry_type === 'per_kg' && (
                                    <>
                                        {subEntries.map((se, idx) => (
                                            <div key={idx} style={{ background: idx % 2 === 0 ? 'var(--bg-tertiary, rgba(255,255,255,0.03))' : 'transparent', padding: '10px 8px', borderRadius: '8px', marginBottom: '4px' }}>
                                                {subEntries.length > 1 && (
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Entry #{idx + 1}</div>
                                                )}
                                                <div className="form-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">Unit</label>
                                                        <select className="form-select" value={se.unit || 'cm'} onChange={e => updateSubEntry(idx, 'unit', e.target.value)}>
                                                            <option value="cm">CM</option>
                                                            <option value="inches">Inches</option>
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Length</label>
                                                        <input className="form-input" type="number" step="any" value={se.length} onChange={e => updateSubEntry(idx, 'length', e.target.value)} placeholder="0" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Width</label>
                                                        <input className="form-input" type="number" step="any" value={se.width} onChange={e => updateSubEntry(idx, 'width', e.target.value)} placeholder="0" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">GSM</label>
                                                        <input className="form-input" type="number" step="any" value={se.gsm} onChange={e => updateSubEntry(idx, 'gsm', e.target.value)} placeholder="0" />
                                                    </div>
                                                </div>
                                                <div className="form-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">Packaging</label>
                                                        <input className="form-input" type="number" step="any" value={se.packaging} onChange={e => updateSubEntry(idx, 'packaging', e.target.value)} placeholder="0" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">No. of Packets</label>
                                                        <input className="form-input" type="number" value={se.no_of_packets} onChange={e => updateSubEntry(idx, 'no_of_packets', e.target.value)} placeholder="0" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label text-accent">Weight {overrides.subWeights[idx] ? '(Manual)' : '(Auto)'}</label>
                                                        <input className="form-input" type="number" step="any" value={se.weight} onChange={e => { updateSubEntry(idx, 'weight', e.target.value); setOverrides(p => ({ ...p, subWeights: { ...p.subWeights, [idx]: true } })); }} style={{ borderColor: overrides.subWeights[idx] ? 'var(--warning)' : 'var(--accent-primary)' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Final Weight + Rate */}
                                        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ color: overrides.totalWeight ? 'var(--warning)' : 'var(--accent-primary)', fontWeight: 700, fontSize: '0.95rem' }}>⚖️ Final Weight {overrides.totalWeight ? '(Manual)' : '(Total)'}</label>
                                                <input className="form-input" type="number" step="any" value={form.weight} onChange={e => { updateField('weight', e.target.value); setOverrides(p => ({ ...p, totalWeight: true })); }} style={{ borderColor: overrides.totalWeight ? 'var(--warning)' : 'var(--accent-primary)', fontWeight: 700, fontSize: '1.1rem', background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Rate per Kg (₹)</label>
                                                <input className="form-input" type="number" step="any" value={form.rate_per_kg} onChange={e => updateField('rate_per_kg', e.target.value)} placeholder="0.00" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Per Bundle Sub-Entry Rows */}
                                {form.entry_type === 'per_bundle' && (
                                    <>
                                        {subEntries.map((se, idx) => (
                                            <div key={idx} style={{ background: idx % 2 === 0 ? 'var(--bg-tertiary, rgba(255,255,255,0.03))' : 'transparent', padding: '10px 8px', borderRadius: '8px', marginBottom: '4px' }}>
                                                {subEntries.length > 1 && (
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Entry #{idx + 1}</div>
                                                )}
                                                <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">No. of Bundles</label>
                                                        <input className="form-input" type="number" value={se.no_of_bundles} onChange={e => updateSubEntry(idx, 'no_of_bundles', e.target.value)} placeholder="0" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Final Quantity + Rate */}
                                        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ color: overrides.totalBundles ? 'var(--warning)' : 'var(--accent-primary)', fontWeight: 700, fontSize: '0.95rem' }}>📦 Final Quantity {overrides.totalBundles ? '(Manual)' : '(Total Bundles)'}</label>
                                                <input className="form-input" type="number" value={form.no_of_bundles} onChange={e => { updateField('no_of_bundles', e.target.value); setOverrides(p => ({ ...p, totalBundles: true })); }} style={{ borderColor: overrides.totalBundles ? 'var(--warning)' : 'var(--accent-primary)', fontWeight: 700, fontSize: '1.1rem', background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Rate per Bundle (₹)</label>
                                                <input className="form-input" type="number" step="any" value={form.rate_per_bundle} onChange={e => updateField('rate_per_bundle', e.target.value)} placeholder="0.00" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Loading Charges + Totals */}
                                <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div className="form-group">
                                        <div className="form-check mb-md">
                                            <input type="checkbox" id="has_loading" checked={form.has_loading_charges} onChange={e => updateField('has_loading_charges', e.target.checked)} />
                                            <label htmlFor="has_loading">Loading Charges</label>
                                        </div>
                                        {form.has_loading_charges && (
                                            <input className="form-input" type="number" step="any" value={form.loading_charges} onChange={e => updateField('loading_charges', e.target.value)} placeholder="0.00" />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: overrides.amount ? 'var(--warning)' : 'var(--accent-primary)' }}>Amount {overrides.amount ? '(Manual)' : '(Auto)'}</label>
                                        <input className="form-input" type="number" step="any" value={form.amount} onChange={e => { updateField('amount', e.target.value); setOverrides(p => ({ ...p, amount: true })); }} style={{ borderColor: overrides.amount ? 'var(--warning)' : 'var(--accent-primary)' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: overrides.totalAmount ? 'var(--warning)' : 'var(--accent-primary)' }}>Total Amount {overrides.totalAmount ? '(Manual)' : '(Auto)'}</label>
                                        <input className="form-input" type="number" step="any" value={form.total_amount} onChange={e => { updateField('total_amount', e.target.value); setOverrides(p => ({ ...p, totalAmount: true })); }} style={{ borderColor: overrides.totalAmount ? 'var(--warning)' : 'var(--accent-primary)', fontWeight: 700 }} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editing ? '💾 Update Entry' : '💾 Save Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
