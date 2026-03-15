import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Layout.jsx';
import { viewPayslip, downloadPayslip } from '../utils/payslipGenerator.js';

const TABS = ['Workers', 'Attendance', 'Advances', 'Pending', 'Salary'];

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount || 0);
}
function formatDate(d) { return d.toISOString().split('T')[0]; }
function today() { return formatDate(new Date()); }

export default function Workers() {
    const showToast = useToast();
    const [activeTab, setActiveTab] = useState(0);
    const [workers, setWorkers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Workers form
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const emptyWorker = { name: '', position: 'driver', salary_type: 'monthly', per_day: '', contact_no: '', bank_name: '', account_no: '', ifsc_code: '' };
    const [form, setForm] = useState({ ...emptyWorker });

    // Attendance state
    const [attWorkerId, setAttWorkerId] = useState('');
    const now = new Date();
    const [attMonth, setAttMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const [attStatus, setAttStatus] = useState('present');
    const [attVehicle, setAttVehicle] = useState('');
    const [attRemark, setAttRemark] = useState('');
    const [attExtraPay, setAttExtraPay] = useState('');
    const [attWorkDesc, setAttWorkDesc] = useState('');
    const [attRecords, setAttRecords] = useState([]);
    const [attLoading, setAttLoading] = useState(false);
    // Attendance modal
    const [showAttModal, setShowAttModal] = useState(false);
    const [attModalDate, setAttModalDate] = useState('');
    const [attModalExisting, setAttModalExisting] = useState(null);
    const [attModalIsSundayOrHoliday, setAttModalIsSundayOrHoliday] = useState(false);
    // Holidays
    const [holidays, setHolidays] = useState([]);
    const [showHolidayForm, setShowHolidayForm] = useState(false);
    const [holDate, setHolDate] = useState('');
    const [holName, setHolName] = useState('');

    // Advance state
    const [advWorkerId, setAdvWorkerId] = useState('');
    const [advDate, setAdvDate] = useState(today());
    const [advAmount, setAdvAmount] = useState('');
    const [advMode, setAdvMode] = useState('');
    const [advPaidBy, setAdvPaidBy] = useState('');
    const [advRemark, setAdvRemark] = useState('');
    const [advFromDate, setAdvFromDate] = useState('');
    const [advToDate, setAdvToDate] = useState('');
    const [advRecords, setAdvRecords] = useState([]);
    const [advLoading, setAdvLoading] = useState(false);

    // Pending state
    const [penWorkerId, setPenWorkerId] = useState('');
    const [penDate, setPenDate] = useState(today());
    const [penAmount, setPenAmount] = useState('');
    const [penRemark, setPenRemark] = useState('');
    const [penFromDate, setPenFromDate] = useState('');
    const [penToDate, setPenToDate] = useState('');
    const [penRecords, setPenRecords] = useState([]);
    const [penLoading, setPenLoading] = useState(false);

    // Salary state
    const [salFromDate, setSalFromDate] = useState('');
    const [salToDate, setSalToDate] = useState('');
    const [salResults, setSalResults] = useState([]);
    const [salLoading, setSalLoading] = useState(false);

    useEffect(() => { loadWorkers(); loadVehicles(); }, []);

    const loadWorkers = async () => {
        setLoading(true);
        try { setWorkers(await api.getWorkers()); } catch (e) { showToast(e.message, 'error'); }
        setLoading(false);
    };

    const loadVehicles = async () => {
        try { setVehicles(await api.getVehicles()); } catch (e) { /* silent */ }
    };

    // ==================== WORKERS ====================
    const openAddForm = () => { setEditId(null); setForm({ ...emptyWorker }); setShowForm(true); };
    const openEditForm = (w) => { setEditId(w.id); setForm({ name: w.name, position: w.position, salary_type: w.salary_type, per_day: w.per_day, contact_no: w.contact_no, bank_name: w.bank_name, account_no: w.account_no, ifsc_code: w.ifsc_code }); setShowForm(true); };

    const saveWorker = async (e) => {
        e.preventDefault();
        try {
            if (editId) { await api.updateWorker(editId, form); showToast('Worker updated'); }
            else { await api.createWorker(form); showToast('Worker added'); }
            setShowForm(false);
            loadWorkers();
        } catch (err) { showToast(err.message, 'error'); }
    };

    const deleteWorker = async (w) => {
        if (!confirm(`Delete worker "${w.name}"? This will also delete their attendance, advances, and pending records.`)) return;
        try { await api.deleteWorker(w.id); showToast('Worker deleted'); loadWorkers(); } catch (e) { showToast(e.message, 'error'); }
    };

    // ==================== ATTENDANCE ====================
    const fetchMonthAttendance = async () => {
        if (!attWorkerId || !attMonth) { showToast('Select worker and month', 'error'); return; }
        setAttLoading(true);
        try {
            const [y, m] = attMonth.split('-').map(Number);
            const from = `${y}-${String(m).padStart(2, '0')}-01`;
            const last = new Date(y, m, 0).getDate();
            const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
            const [records, hols] = await Promise.all([
                api.getAttendance(attWorkerId, from, to),
                api.getHolidays(from, to)
            ]);
            setAttRecords(records);
            setHolidays(hols);
        } catch (e) { showToast(e.message, 'error'); }
        setAttLoading(false);
    };

    // Auto-reload when month changes (if worker already selected)
    useEffect(() => {
        if (attWorkerId && attMonth) fetchMonthAttendance();
    }, [attMonth]);

    // Check if a date is Sunday or holiday
    const isSunday = (dateStr) => new Date(dateStr).getDay() === 0;
    const isHoliday = (dateStr) => holidays.some(h => h.date === dateStr);
    const getHolidayName = (dateStr) => holidays.find(h => h.date === dateStr)?.name || '';

    const openAttModal = (dateStr, existingRecord) => {
        const sundayOrHoliday = isSunday(dateStr) || isHoliday(dateStr);
        setAttModalDate(dateStr);
        setAttModalExisting(existingRecord || null);
        setAttModalIsSundayOrHoliday(sundayOrHoliday);
        setAttStatus(existingRecord?.status || 'present');
        setAttVehicle(existingRecord?.vehicle_number || '');
        setAttRemark(existingRecord?.remark || '');
        setAttExtraPay(existingRecord?.extra_pay > 0 ? String(existingRecord.extra_pay) : '');
        setAttWorkDesc(existingRecord?.work_description || '');
        setShowAttModal(true);
    };

    const addHoliday = async () => {
        if (!holDate) { showToast('Select date', 'error'); return; }
        try {
            await api.createHoliday({ date: holDate, name: holName || 'Holiday' });
            showToast('Holiday added ✓');
            setHolDate(''); setHolName(''); setShowHolidayForm(false);
            if (attWorkerId && attMonth) fetchMonthAttendance();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deleteHoliday = async (id) => {
        if (!confirm('Remove this holiday?')) return;
        try { await api.deleteHoliday(id); showToast('Holiday removed'); fetchMonthAttendance(); } catch (e) { showToast(e.message, 'error'); }
    };

    // ==================== ADVANCES ====================
    const fetchAdvances = async () => {
        if (!advWorkerId || !advFromDate || !advToDate) { showToast('Select worker and date range', 'error'); return; }
        setAdvLoading(true);
        try { setAdvRecords(await api.getAdvances(advWorkerId, advFromDate, advToDate)); } catch (e) { showToast(e.message, 'error'); }
        setAdvLoading(false);
    };

    const addAdvance = async () => {
        if (!advWorkerId || !advDate || !advAmount) { showToast('Worker, date, and amount required', 'error'); return; }
        try {
            await api.createAdvance(advWorkerId, { date: advDate, amount: parseFloat(advAmount), mode_of_payment: advMode, paid_by: advPaidBy, remark: advRemark });
            showToast('Advance recorded ✓');
            setAdvAmount(''); setAdvMode(''); setAdvPaidBy(''); setAdvRemark('');
            if (advFromDate && advToDate) fetchAdvances();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deleteAdvRecord = async (id) => {
        if (!confirm('Delete this advance record?')) return;
        try { await api.deleteAdvance(id); showToast('Deleted'); fetchAdvances(); } catch (e) { showToast(e.message, 'error'); }
    };

    // ==================== PENDING ====================
    const fetchPending = async () => {
        if (!penWorkerId || !penFromDate || !penToDate) { showToast('Select worker and date range', 'error'); return; }
        setPenLoading(true);
        try { setPenRecords(await api.getPending(penWorkerId, penFromDate, penToDate)); } catch (e) { showToast(e.message, 'error'); }
        setPenLoading(false);
    };

    const addPending = async () => {
        if (!penWorkerId || !penDate || !penAmount) { showToast('Worker, date, and amount required', 'error'); return; }
        try {
            await api.createPending(penWorkerId, { date: penDate, amount: parseFloat(penAmount), remark: penRemark });
            showToast('Pending amount recorded ✓');
            setPenAmount(''); setPenRemark('');
            if (penFromDate && penToDate) fetchPending();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deletePenRecord = async (id) => {
        if (!confirm('Delete this pending record?')) return;
        try { await api.deletePending(id); showToast('Deleted'); fetchPending(); } catch (e) { showToast(e.message, 'error'); }
    };

    // ==================== SALARY ====================
    const fetchSalary = async () => {
        if (!salFromDate || !salToDate) { showToast('Select date range', 'error'); return; }
        setSalLoading(true);
        try { setSalResults(await api.getAllSalaries(salFromDate, salToDate)); } catch (e) { showToast(e.message, 'error'); }
        setSalLoading(false);
    };

    const workerName = (id) => workers.find(w => w.id === Number(id))?.name || '';

    // ==================== RENDER ====================
    return (
        <div>
            <div className="page-header">
                <h1><span className="page-header-icon">👷</span> Workers & Salary</h1>
            </div>

            {/* Tabs */}
            <div className="worker-tabs">
                {TABS.map((tab, i) => (
                    <button key={i} className={`worker-tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
                        {['👷', '📅', '💸', '📌', '💰'][i]} {tab}
                    </button>
                ))}
            </div>

            {/* ==================== TAB 0: Workers List ==================== */}
            {activeTab === 0 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={openAddForm}>+ Add Worker</button>
                    </div>

                    {loading ? (
                        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                    ) : workers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">👷</div>
                            <p>No workers added yet.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Position</th>
                                        <th>Salary Type</th>
                                        <th className="text-right">Per Day</th>
                                        <th>Contact</th>
                                        <th>Bank</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workers.map(w => (
                                        <tr key={w.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                                            <td><span className={`badge ${w.position === 'driver' ? 'badge-info' : 'badge-warning'}`}>{w.position}</span></td>
                                            <td><span className="badge badge-success">{w.salary_type}</span></td>
                                            <td className="text-right font-mono" style={{ fontWeight: 600 }}>₹{w.per_day}</td>
                                            <td>{w.contact_no || '—'}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {w.bank_name ? `${w.bank_name} ${w.account_no ? '·· ' + w.account_no.slice(-4) : ''}` : '—'}
                                            </td>
                                            <td>
                                                <div className="actions-group">
                                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(w)} title="Edit">✏️</button>
                                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteWorker(w)} title="Delete">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Worker Form Modal */}
                    {showForm && (
                        <div className="modal-overlay" onClick={() => setShowForm(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()}>
                                <form onSubmit={saveWorker}>
                                    <div className="modal-header">
                                        <h2>{editId ? 'Edit Worker' : 'Add Worker'}</h2>
                                        <button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button>
                                    </div>
                                    <div className="modal-body">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label required">Name</label>
                                                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label required">Position</label>
                                                <select className="form-select" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                                                    <option value="driver">Driver</option>
                                                    <option value="loader">Loader</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label required">Salary Type</label>
                                                <select className="form-select" value={form.salary_type} onChange={e => setForm({ ...form, salary_type: e.target.value })}>
                                                    <option value="weekly">Weekly</option>
                                                    <option value="monthly">Monthly</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label required">Per Day (₹)</label>
                                                <input type="number" className="form-input" value={form.per_day} onChange={e => setForm({ ...form, per_day: e.target.value })} required min="0" step="any" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Contact No.</label>
                                            <input className="form-input" value={form.contact_no} onChange={e => setForm({ ...form, contact_no: e.target.value })} />
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Bank Name</label>
                                                <input className="form-input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Account No.</label>
                                                <input className="form-input" value={form.account_no} onChange={e => setForm({ ...form, account_no: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">IFSC Code</label>
                                                <input className="form-input" value={form.ifsc_code} onChange={e => setForm({ ...form, ifsc_code: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                        <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add'} Worker</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB 1: Attendance ==================== */}
            {activeTab === 1 && (
                <div>
                    {/* Worker + Month Selection */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="form-row" style={{ marginBottom: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                                <label className="form-label required">Worker</label>
                                <select className="form-select" value={attWorkerId} onChange={e => { setAttWorkerId(e.target.value); }}>
                                    <option value="">Select Worker</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label">Month</label>
                                <input type="month" className="form-input" value={attMonth} onChange={e => setAttMonth(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={fetchMonthAttendance} style={{ width: '100%' }}>📅 Load</button>
                            </div>
                        </div>

                        {/* Month navigation */}
                        {attMonth && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    const [y, m] = attMonth.split('-').map(Number);
                                    const prev = new Date(y, m - 2, 1);
                                    setAttMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                                }}>◀ Prev</button>
                                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-heading)' }}>
                                    {new Date(attMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                </span>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    const [y, m] = attMonth.split('-').map(Number);
                                    const next = new Date(y, m, 1);
                                    setAttMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                                }}>Next ▶</button>
                            </div>
                        )}
                    </div>

                    {/* Holidays Management */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHolidayForm || holidays.length > 0 ? '0.75rem' : 0 }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>🎉 Holidays</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowHolidayForm(!showHolidayForm)}>
                                {showHolidayForm ? '✕ Cancel' : '+ Add Holiday'}
                            </button>
                        </div>
                        {showHolidayForm && (
                            <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input type="date" className="form-input" value={holDate} onChange={e => setHolDate(e.target.value)} placeholder="Date" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <input className="form-input" value={holName} onChange={e => setHolName(e.target.value)} placeholder="Holiday name (e.g. Holi)" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                    <button className="btn btn-primary btn-sm" onClick={addHoliday} style={{ width: '100%' }}>+ Add</button>
                                </div>
                            </div>
                        )}
                        {holidays.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {holidays.map(h => (
                                    <span key={h.id} className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}>
                                        🎉 {h.date} — {h.name}
                                        <button onClick={() => deleteHoliday(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem', lineHeight: 1 }}>✕</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats Bar */}
                    {attWorkerId && attMonth && (() => {
                        const present = attRecords.filter(r => r.status === 'present').length;
                        const absent = attRecords.filter(r => r.status === 'absent').length;
                        const [y, m] = attMonth.split('-').map(Number);
                        const daysInMonth = new Date(y, m, 0).getDate();
                        // Count sundays + holidays
                        let sundayCount = 0;
                        const holidaySet = new Set(holidays.map(h => h.date));
                        let holidayCount = 0;
                        for (let d = 1; d <= daysInMonth; d++) {
                            const dt = new Date(y, m - 1, d);
                            const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            if (dt.getDay() === 0) sundayCount++;
                            if (holidaySet.has(ds) && dt.getDay() !== 0) holidayCount++; // don't double count
                        }
                        const workingDays = daysInMonth - sundayCount - holidayCount;
                        const unmarked = workingDays - present - absent;
                        return (
                            <div className="stats-row" style={{ marginBottom: '1rem' }}>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'var(--info-bg)' }}>📅</div>
                                    <div>
                                        <div className="stat-value" style={{ color: 'var(--info)' }}>{workingDays}</div>
                                        <div className="stat-label">Working Days</div>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'var(--success-bg)' }}>✅</div>
                                    <div>
                                        <div className="stat-value" style={{ color: 'var(--success)' }}>{present}</div>
                                        <div className="stat-label">Present</div>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'var(--danger-bg)' }}>❌</div>
                                    <div>
                                        <div className="stat-value" style={{ color: 'var(--danger)' }}>{absent}</div>
                                        <div className="stat-label">Absent</div>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: 'var(--warning-bg)' }}>🟠</div>
                                    <div>
                                        <div className="stat-value" style={{ color: 'var(--warning)' }}>{sundayCount + holidayCount}</div>
                                        <div className="stat-label">Off Days</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Calendar Grid */}
                    {attWorkerId && attMonth && (
                        <div className="card">
                            {attLoading ? (
                                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                            ) : (() => {
                                const [y, m] = attMonth.split('-').map(Number);
                                const daysInMonth = new Date(y, m, 0).getDate();
                                const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
                                const recordMap = {};
                                attRecords.forEach(r => { recordMap[r.date] = r; });
                                const holidaySet = new Set(holidays.map(h => h.date));

                                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                const cells = [];

                                for (let i = 0; i < firstDayOfWeek; i++) {
                                    cells.push(<div key={`empty-${i}`} className="att-cal-cell att-cal-empty"></div>);
                                }

                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const rec = recordMap[dateStr];
                                    const dayOfWeek = new Date(y, m - 1, d).getDay();
                                    const isSun = dayOfWeek === 0;
                                    const isHol = holidaySet.has(dateStr);
                                    const isOff = isSun || isHol;
                                    const isToday2 = dateStr === today();

                                    let cellClass = 'att-cal-cell';
                                    if (rec?.status === 'present') {
                                        cellClass += isOff ? ' att-extra-work' : ' att-present';
                                    } else if (rec?.status === 'absent') {
                                        cellClass += ' att-absent';
                                    } else if (isHol) {
                                        cellClass += ' att-holiday';
                                    } else if (isSun) {
                                        cellClass += ' att-weekoff';
                                    } else {
                                        cellClass += ' att-unmarked';
                                    }
                                    if (isToday2) cellClass += ' att-today';

                                    const holName2 = holidays.find(h => h.date === dateStr)?.name;
                                    let label = '';
                                    if (rec?.status === 'present' && isOff) label = rec.extra_pay > 0 ? `₹${rec.extra_pay}` : '✅';
                                    else if (rec?.status === 'present') label = '✅';
                                    else if (rec?.status === 'absent') label = '❌';
                                    else if (isHol) label = '🎉';
                                    else if (isSun) label = '🅂';
                                    else label = '·';

                                    cells.push(
                                        <div key={d} className={cellClass} onClick={() => openAttModal(dateStr, rec)}
                                            title={isOff && !rec ? (isSun ? 'Sunday (Week Off)' : holName2) : rec ? `${rec.status}${rec.vehicle_number ? ' - ' + rec.vehicle_number : ''}` : 'Click to mark'}>
                                            <div className="att-cal-day">{d}</div>
                                            <div className="att-cal-status">{label}</div>
                                            {rec?.vehicle_number && <div className="att-cal-vehicle">{rec.vehicle_number}</div>}
                                            {!rec && isHol && <div className="att-cal-vehicle">{holName2}</div>}
                                        </div>
                                    );
                                }

                                return (
                                    <div>
                                        <div className="att-cal-header">
                                            {dayNames.map(d => <div key={d} className={`att-cal-header-cell${d === 'Sun' ? ' att-sun-header' : ''}`}>{d}</div>)}
                                        </div>
                                        <div className="att-cal-grid">
                                            {cells}
                                        </div>
                                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span><span className="att-legend att-legend-present"></span> Present</span>
                                            <span><span className="att-legend att-legend-absent"></span> Absent</span>
                                            <span><span className="att-legend att-legend-weekoff"></span> Week Off</span>
                                            <span><span className="att-legend att-legend-holiday"></span> Holiday</span>
                                            <span><span className="att-legend att-legend-extra"></span> Extra Work</span>
                                            <span><span className="att-legend att-legend-unmarked"></span> Unmarked</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Mark Attendance Modal */}
                    {showAttModal && (
                        <div className="modal-overlay" onClick={() => setShowAttModal(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                                <div className="modal-header">
                                    <div>
                                        <h2 style={{ margin: 0 }}>📅 {attModalDate}</h2>
                                        {attModalIsSundayOrHoliday && (
                                            <span className="badge badge-warning" style={{ marginTop: '4px', display: 'inline-block' }}>
                                                {isSunday(attModalDate) ? '🅂 Sunday — Week Off' : `🎉 ${getHolidayName(attModalDate)} — Holiday`}
                                            </span>
                                        )}
                                    </div>
                                    <button type="button" className="modal-close" onClick={() => setShowAttModal(false)}>×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label required">Status</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className={`btn ${attStatus === 'present' ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ flex: 1, fontSize: '1rem' }}
                                                onClick={() => { setAttStatus('present'); }}
                                            >✅ Present</button>
                                            <button
                                                className={`btn ${attStatus === 'absent' ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ flex: 1, fontSize: '1rem' }}
                                                onClick={() => { setAttStatus('absent'); setAttVehicle(''); setAttExtraPay(''); setAttWorkDesc(''); }}
                                            >❌ Absent</button>
                                        </div>
                                    </div>
                                    {attStatus === 'present' && (
                                        <div className="form-group">
                                            <label className="form-label required">Vehicle</label>
                                            <select className="form-select" value={attVehicle} onChange={e => setAttVehicle(e.target.value)}>
                                                <option value="">Select Vehicle</option>
                                                {vehicles.map(v => <option key={v.id} value={v.vehicle_number}>{v.vehicle_number}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label">Remark</label>
                                        <input className="form-input" value={attRemark} onChange={e => setAttRemark(e.target.value)} placeholder="Optional" />
                                    </div>

                                    {/* Extra Pay section — shown on Sunday/Holiday when present */}
                                    {attModalIsSundayOrHoliday && attStatus === 'present' && (
                                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
                                            <p style={{ fontSize: '0.82rem', color: 'var(--warning)', fontWeight: 600, marginBottom: '8px' }}>
                                                ⚡ Working on {isSunday(attModalDate) ? 'Sunday (Week Off)' : 'Holiday'} — Extra Pay
                                            </p>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">Extra Pay (₹)</label>
                                                    <input type="number" className="form-input" value={attExtraPay} onChange={e => setAttExtraPay(e.target.value)} min="0" step="any" placeholder="e.g. 500" />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Work Done</label>
                                                    <input className="form-input" value={attWorkDesc} onChange={e => setAttWorkDesc(e.target.value)} placeholder="e.g. Delivery to XYZ" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    {attModalExisting && (
                                        <button className="btn btn-ghost text-danger" onClick={async () => {
                                            await api.deleteAttendance(attModalExisting.id);
                                            showToast('Attendance removed');
                                            setShowAttModal(false);
                                            fetchMonthAttendance();
                                        }} style={{ marginRight: 'auto' }}>🗑️ Remove</button>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => setShowAttModal(false)}>Cancel</button>
                                    <button className="btn btn-primary" onClick={async () => {
                                        if (!attStatus) { showToast('Select status', 'error'); return; }
                                        if (attStatus === 'present' && !attVehicle) { showToast('Select vehicle', 'error'); return; }
                                        const payload = {
                                            date: attModalDate,
                                            status: attStatus,
                                            vehicle_number: attVehicle,
                                            remark: attRemark,
                                            extra_pay: attModalIsSundayOrHoliday && attStatus === 'present' ? parseFloat(attExtraPay) || 0 : 0,
                                            work_description: attModalIsSundayOrHoliday && attStatus === 'present' ? attWorkDesc : ''
                                        };
                                        await api.markAttendance(attWorkerId, payload);
                                        showToast('Attendance saved ✓');
                                        setShowAttModal(false);
                                        fetchMonthAttendance();
                                    }}>✓ Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB 2: Advances ==================== */}
            {activeTab === 2 && (
                <div>
                    {/* Add Advance */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>💸 Give Advance</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Worker</label>
                                <select className="form-select" value={advWorkerId} onChange={e => setAdvWorkerId(e.target.value)}>
                                    <option value="">Select Worker</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Date</label>
                                <input type="date" className="form-input" value={advDate} onChange={e => setAdvDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Amount (₹)</label>
                                <input type="number" className="form-input" value={advAmount} onChange={e => setAdvAmount(e.target.value)} min="0" step="any" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Mode of Payment</label>
                                <select className="form-select" value={advMode} onChange={e => setAdvMode(e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="cash">Cash</option>
                                    <option value="upi">UPI</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Paid By</label>
                                <input className="form-input" value={advPaidBy} onChange={e => setAdvPaidBy(e.target.value)} placeholder="Who gave the advance" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Remark</label>
                                <input className="form-input" value={advRemark} onChange={e => setAdvRemark(e.target.value)} placeholder="Optional" />
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={addAdvance} style={{ marginTop: '0.5rem' }}>+ Add Advance</button>
                    </div>

                    {/* View Advances */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>📋 Advance Records</h3>
                        <div className="form-row" style={{ marginBottom: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Worker</label>
                                <select className="form-select" value={advWorkerId} onChange={e => setAdvWorkerId(e.target.value)}>
                                    <option value="">Select Worker</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">From</label>
                                <input type="date" className="form-input" value={advFromDate} onChange={e => setAdvFromDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">To</label>
                                <input type="date" className="form-input" value={advToDate} onChange={e => setAdvToDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={fetchAdvances} style={{ width: '100%' }}>🔍 Fetch</button>
                            </div>
                        </div>
                        {advLoading ? (
                            <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                        ) : advRecords.length > 0 && (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th className="text-right">Amount</th>
                                            <th>Mode</th>
                                            <th>Paid By</th>
                                            <th>Remark</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advRecords.map(r => (
                                            <tr key={r.id}>
                                                <td className="font-mono">{r.date}</td>
                                                <td className="text-right font-mono" style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(r.amount)}</td>
                                                <td><span className="badge badge-info">{r.mode_of_payment || '—'}</span></td>
                                                <td>{r.paid_by || '—'}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{r.remark || '—'}</td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteAdvRecord(r.id)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                            <td style={{ fontWeight: 700 }}>Total</td>
                                            <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                                {formatCurrency(advRecords.reduce((s, r) => s + r.amount, 0))}
                                            </td>
                                            <td colSpan={4}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== TAB 3: Pending ==================== */}
            {activeTab === 3 && (
                <div>
                    {/* Add Pending */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>📌 Add Pending Amount</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Record amounts borrowed from worker or previously pending amounts that should be added to their salary.
                        </p>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label required">Worker</label>
                                <select className="form-select" value={penWorkerId} onChange={e => setPenWorkerId(e.target.value)}>
                                    <option value="">Select Worker</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Date</label>
                                <input type="date" className="form-input" value={penDate} onChange={e => setPenDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Amount (₹)</label>
                                <input type="number" className="form-input" value={penAmount} onChange={e => setPenAmount(e.target.value)} min="0" step="any" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Remark</label>
                            <input className="form-input" value={penRemark} onChange={e => setPenRemark(e.target.value)} placeholder="e.g. Borrowed ₹500 for fuel" />
                        </div>
                        <button className="btn btn-primary" onClick={addPending} style={{ marginTop: '0.5rem' }}>+ Add Pending</button>
                    </div>

                    {/* View Pending */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>📋 Pending Records</h3>
                        <div className="form-row" style={{ marginBottom: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Worker</label>
                                <select className="form-select" value={penWorkerId} onChange={e => setPenWorkerId(e.target.value)}>
                                    <option value="">Select Worker</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">From</label>
                                <input type="date" className="form-input" value={penFromDate} onChange={e => setPenFromDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">To</label>
                                <input type="date" className="form-input" value={penToDate} onChange={e => setPenToDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={fetchPending} style={{ width: '100%' }}>🔍 Fetch</button>
                            </div>
                        </div>
                        {penLoading ? (
                            <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                        ) : penRecords.length > 0 && (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th className="text-right">Amount</th>
                                            <th>Remark</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {penRecords.map(r => (
                                            <tr key={r.id}>
                                                <td className="font-mono">{r.date}</td>
                                                <td className="text-right font-mono" style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(r.amount)}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{r.remark || '—'}</td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm text-danger" onClick={() => deletePenRecord(r.id)}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                            <td style={{ fontWeight: 700 }}>Total</td>
                                            <td className="text-right font-mono" style={{ fontWeight: 700, color: 'var(--success)' }}>
                                                {formatCurrency(penRecords.reduce((s, r) => s + r.amount, 0))}
                                            </td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== TAB 4: Salary Calculation ==================== */}
            {activeTab === 4 && (
                <div>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>💰 Calculate Salary</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Select a date range to calculate salary for all workers. Formula: <strong>(Present Days × Per Day) − Advances + Pending + Extra Pay</strong>
                        </p>

                        {/* Quick Presets */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Quick Select</label>
                            <div className="outstanding-presets">
                                <button className="outstanding-preset-btn" onClick={() => {
                                    const now = new Date();
                                    const dayOfWeek = now.getDay();
                                    const monday = new Date(now);
                                    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                                    const sunday = new Date(monday);
                                    sunday.setDate(monday.getDate() + 6);
                                    setSalFromDate(formatDate(monday));
                                    setSalToDate(formatDate(sunday));
                                }}>📅 This Week</button>
                                <button className="outstanding-preset-btn" onClick={() => {
                                    const now = new Date();
                                    const dayOfWeek = now.getDay();
                                    const monday = new Date(now);
                                    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
                                    const sunday = new Date(monday);
                                    sunday.setDate(monday.getDate() + 6);
                                    setSalFromDate(formatDate(monday));
                                    setSalToDate(formatDate(sunday));
                                }}>⏪ Last Week</button>
                                <button className="outstanding-preset-btn" onClick={() => {
                                    const now = new Date();
                                    const first = new Date(now.getFullYear(), now.getMonth(), 1);
                                    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                                    setSalFromDate(formatDate(first));
                                    setSalToDate(formatDate(last));
                                }}>📆 This Month</button>
                                <button className="outstanding-preset-btn" onClick={() => {
                                    const now = new Date();
                                    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                    const last = new Date(now.getFullYear(), now.getMonth(), 0);
                                    setSalFromDate(formatDate(first));
                                    setSalToDate(formatDate(last));
                                }}>⏪ Last Month</button>
                            </div>
                        </div>

                        <div className="form-row" style={{ marginBottom: 0 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label required">From Date</label>
                                <input type="date" className="form-input" value={salFromDate} onChange={e => setSalFromDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label required">To Date</label>
                                <input type="date" className="form-input" value={salToDate} onChange={e => setSalToDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={fetchSalary} style={{ width: '100%' }}>💰 Calculate</button>
                            </div>
                        </div>
                    </div>

                    {salLoading ? (
                        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                    ) : salResults.length > 0 && (
                        <div className="salary-results">
                            {salResults.map(s => (
                                <div key={s.worker.id} className="salary-card">
                                    <div className="salary-card-header">
                                        <div>
                                            <div className="salary-worker-name">{s.worker.name}</div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <span className={`badge ${s.worker.position === 'driver' ? 'badge-info' : 'badge-warning'}`}>{s.worker.position}</span>
                                                <span className="badge badge-success">{s.worker.salary_type}</span>
                                            </div>
                                        </div>
                                        <div className="salary-net">
                                            <div className="salary-net-label">Net Salary</div>
                                            <div className={`salary-net-amount ${s.net_salary >= 0 ? 'positive' : 'negative'}`}>
                                                {formatCurrency(s.net_salary)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="salary-card-body">
                                        <div className="salary-row">
                                            <span className="salary-row-label">📅 Total Days in Period</span>
                                            <span className="salary-row-value font-mono">{s.total_days} days</span>
                                        </div>
                                        <div className="salary-row">
                                            <span className="salary-row-label">✅ Present Days</span>
                                            <span className="salary-row-value font-mono" style={{ color: 'var(--success)' }}>{s.present_days} days</span>
                                        </div>
                                        <div className="salary-row">
                                            <span className="salary-row-label">❌ Absent Days</span>
                                            <span className="salary-row-value font-mono" style={{ color: 'var(--danger)' }}>{s.absent_count} days</span>
                                        </div>
                                        <div className="salary-row">
                                            <span className="salary-row-label">💵 Per Day Rate</span>
                                            <span className="salary-row-value font-mono">{formatCurrency(s.per_day)}</span>
                                        </div>
                                        <div className="salary-row salary-row-highlight">
                                            <span className="salary-row-label">💼 Gross Salary</span>
                                            <span className="salary-row-value font-mono" style={{ fontWeight: 700 }}>{formatCurrency(s.gross_salary)}</span>
                                        </div>
                                        <div className="salary-row">
                                            <span className="salary-row-label" style={{ color: 'var(--danger)' }}>➖ Total Advances ({s.advances ? s.advances.length : 0})</span>
                                            <span className="salary-row-value font-mono" style={{ color: 'var(--danger)' }}>− {formatCurrency(s.total_advances)}</span>
                                        </div>
                                        <div className="salary-row">
                                            <span className="salary-row-label" style={{ color: 'var(--success)' }}>➕ Pending Amounts ({s.pendings ? s.pendings.length : 0})</span>
                                            <span className="salary-row-value font-mono" style={{ color: 'var(--success)' }}>+ {formatCurrency(s.total_pending)}</span>
                                        </div>
                                        {s.total_extra_pay > 0 && (
                                            <div className="salary-row">
                                                <span className="salary-row-label" style={{ color: 'var(--warning)' }}>⚡ Extra Pay ({s.extra_pay_records ? s.extra_pay_records.length : 0} days)</span>
                                                <span className="salary-row-value font-mono" style={{ color: 'var(--warning)' }}>+ {formatCurrency(s.total_extra_pay)}</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Payslip Actions */}
                                    <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => viewPayslip(s)} style={{ flex: 1 }}>
                                            👁️ View Payslip
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => downloadPayslip(s)} style={{ flex: 1 }}>
                                            📥 Download PDF
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
