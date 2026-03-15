import { Router } from 'express';
import db from '../db.js';

const router = Router();

// ==================== WORKERS CRUD ====================

// GET all workers
router.get('/', (req, res) => {
    const workers = db.prepare('SELECT * FROM workers ORDER BY name ASC').all();
    res.json(workers);
});

// Helper: calculate total calendar days between two dates (inclusive)
function calcTotalDays(from_date, to_date) {
    const from = new Date(from_date);
    const to = new Date(to_date);
    return Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

// Helper: build full salary data for a worker
function buildSalaryData(worker, from_date, to_date) {
    const totalDays = calcTotalDays(from_date, to_date);

    // Present days count (regular working days, NOT Sunday/holiday extra)
    const attendanceData = db.prepare(`
        SELECT COUNT(*) as present_days
        FROM attendance
        WHERE worker_id = ? AND date >= ? AND date <= ? AND status = 'present'
    `).get(worker.id, from_date, to_date);

    // Absent days with dates and remarks
    const absentDays = db.prepare(`
        SELECT date, remark
        FROM attendance
        WHERE worker_id = ? AND date >= ? AND date <= ? AND status = 'absent'
        ORDER BY date ASC
    `).all(worker.id, from_date, to_date);

    // Extra pay records (Sunday/holiday work)
    const extraPayRecords = db.prepare(`
        SELECT date, extra_pay, work_description, vehicle_number
        FROM attendance
        WHERE worker_id = ? AND date >= ? AND date <= ? AND extra_pay > 0
        ORDER BY date ASC
    `).all(worker.id, from_date, to_date);

    const totalExtraPay = extraPayRecords.reduce((s, r) => s + r.extra_pay, 0);

    // Advance details
    const advances = db.prepare(`
        SELECT date, amount, mode_of_payment, paid_by, remark
        FROM worker_advances
        WHERE worker_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(worker.id, from_date, to_date);

    const totalAdvances = advances.reduce((s, a) => s + a.amount, 0);

    // Pending details
    const pendings = db.prepare(`
        SELECT date, amount, remark
        FROM worker_pending
        WHERE worker_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
    `).all(worker.id, from_date, to_date);

    const totalPending = pendings.reduce((s, p) => s + p.amount, 0);

    const presentDays = attendanceData.present_days;
    const grossSalary = presentDays * worker.per_day;
    const netSalary = grossSalary - totalAdvances + totalPending + totalExtraPay;

    return {
        worker,
        from_date,
        to_date,
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        absent_count: absentDays.length,
        per_day: worker.per_day,
        gross_salary: grossSalary,
        extra_pay_records: extraPayRecords,
        total_extra_pay: totalExtraPay,
        advances,
        total_advances: totalAdvances,
        pendings,
        total_pending: totalPending,
        net_salary: netSalary
    };
}

// ==================== HOLIDAYS ====================

// GET all holidays
router.get('/holidays/all', (req, res) => {
    const { from_date, to_date } = req.query;
    let sql = 'SELECT * FROM holidays';
    const params = [];
    if (from_date && to_date) {
        sql += ' WHERE date >= ? AND date <= ?';
        params.push(from_date, to_date);
    }
    sql += ' ORDER BY date ASC';
    res.json(db.prepare(sql).all(...params));
});

// POST create holiday
router.post('/holidays', (req, res) => {
    const { date, name } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    try {
        const result = db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run(date, name || 'Holiday');
        const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(holiday);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Holiday already exists for this date' });
        res.status(500).json({ error: err.message });
    }
});

// DELETE holiday
router.delete('/holidays/:holId', (req, res) => {
    db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.holId);
    res.status(204).end();
});

// GET salary calculation for ALL workers within date range
// MUST be before /:id to prevent 'salary' matching as an id
router.get('/salary/all', (req, res) => {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
        const workers = db.prepare('SELECT * FROM workers ORDER BY name ASC').all();
        const results = workers.map(worker => buildSalaryData(worker, from_date, to_date));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single worker
router.get('/:id', (req, res) => {
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json(worker);
});

// POST create worker
router.post('/', (req, res) => {
    const { name, position, salary_type, per_day, contact_no, bank_name, account_no, ifsc_code } = req.body;
    if (!name || !position || !salary_type) {
        return res.status(400).json({ error: 'Name, position, and salary type are required' });
    }

    const result = db.prepare(`
        INSERT INTO workers (name, position, salary_type, per_day, contact_no, bank_name, account_no, ifsc_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, position, salary_type, per_day || 0, contact_no || '', bank_name || '', account_no || '', ifsc_code || '');

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(worker);
});

// PUT update worker
router.put('/:id', (req, res) => {
    const { name, position, salary_type, per_day, contact_no, bank_name, account_no, ifsc_code } = req.body;
    if (!name || !position || !salary_type) {
        return res.status(400).json({ error: 'Name, position, and salary type are required' });
    }

    db.prepare(`
        UPDATE workers SET name=?, position=?, salary_type=?, per_day=?, contact_no=?, bank_name=?, account_no=?, ifsc_code=?
        WHERE id=?
    `).run(name, position, salary_type, per_day || 0, contact_no || '', bank_name || '', account_no || '', ifsc_code || '', req.params.id);

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    res.json(worker);
});

// DELETE worker
router.delete('/:id', (req, res) => {
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    db.prepare('DELETE FROM workers WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

// ==================== ATTENDANCE ====================

// GET attendance for a worker within date range
router.get('/:id/attendance', (req, res) => {
    const { from_date, to_date } = req.query;
    let sql = 'SELECT * FROM attendance WHERE worker_id = ?';
    const params = [req.params.id];

    if (from_date) { sql += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND date <= ?'; params.push(to_date); }
    sql += ' ORDER BY date ASC';

    res.json(db.prepare(sql).all(...params));
});

// POST/PUT mark attendance (upsert for a specific date)
router.post('/:id/attendance', (req, res) => {
    const { date, status, vehicle_number, remark, extra_pay, work_description } = req.body;
    if (!date || !status) {
        return res.status(400).json({ error: 'Date and status are required' });
    }

    // Upsert: insert or replace for this worker+date
    db.prepare(`
        INSERT INTO attendance (worker_id, date, status, vehicle_number, remark, extra_pay, work_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(worker_id, date) DO UPDATE SET
            status = excluded.status,
            vehicle_number = excluded.vehicle_number,
            remark = excluded.remark,
            extra_pay = excluded.extra_pay,
            work_description = excluded.work_description
    `).run(req.params.id, date, status, vehicle_number || '', remark || '', extra_pay || 0, work_description || '');

    const record = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(req.params.id, date);
    res.json(record);
});

// POST bulk attendance (mark multiple dates at once)
router.post('/:id/attendance/bulk', (req, res) => {
    const { records } = req.body; // array of { date, status, vehicle_number, remark }
    if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'records array is required' });
    }

    const stmt = db.prepare(`
        INSERT INTO attendance (worker_id, date, status, vehicle_number, remark)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(worker_id, date) DO UPDATE SET
            status = excluded.status,
            vehicle_number = excluded.vehicle_number,
            remark = excluded.remark
    `);

    const txn = db.transaction(() => {
        for (const rec of records) {
            stmt.run(req.params.id, rec.date, rec.status, rec.vehicle_number || '', rec.remark || '');
        }
    });
    txn();

    res.json({ message: `${records.length} attendance records saved` });
});

// DELETE attendance record
router.delete('/attendance/:attId', (req, res) => {
    db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.attId);
    res.status(204).end();
});

// ==================== ADVANCES ====================

// GET advances for a worker
router.get('/:id/advances', (req, res) => {
    const { from_date, to_date } = req.query;
    let sql = 'SELECT * FROM worker_advances WHERE worker_id = ?';
    const params = [req.params.id];

    if (from_date) { sql += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND date <= ?'; params.push(to_date); }
    sql += ' ORDER BY date DESC';

    res.json(db.prepare(sql).all(...params));
});

// POST create advance
router.post('/:id/advances', (req, res) => {
    const { date, amount, mode_of_payment, paid_by, remark } = req.body;
    if (!date || !amount) {
        return res.status(400).json({ error: 'Date and amount are required' });
    }

    const result = db.prepare(`
        INSERT INTO worker_advances (worker_id, date, amount, mode_of_payment, paid_by, remark)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, date, amount, mode_of_payment || '', paid_by || '', remark || '');

    const advance = db.prepare('SELECT * FROM worker_advances WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(advance);
});

// DELETE advance
router.delete('/advances/:advId', (req, res) => {
    db.prepare('DELETE FROM worker_advances WHERE id = ?').run(req.params.advId);
    res.status(204).end();
});

// ==================== PENDING ====================

// GET pending amounts for a worker
router.get('/:id/pending', (req, res) => {
    const { from_date, to_date } = req.query;
    let sql = 'SELECT * FROM worker_pending WHERE worker_id = ?';
    const params = [req.params.id];

    if (from_date) { sql += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND date <= ?'; params.push(to_date); }
    sql += ' ORDER BY date DESC';

    res.json(db.prepare(sql).all(...params));
});

// POST create pending entry
router.post('/:id/pending', (req, res) => {
    const { date, amount, remark } = req.body;
    if (!date || !amount) {
        return res.status(400).json({ error: 'Date and amount are required' });
    }

    const result = db.prepare(`
        INSERT INTO worker_pending (worker_id, date, amount, remark)
        VALUES (?, ?, ?, ?)
    `).run(req.params.id, date, amount, remark || '');

    const pending = db.prepare('SELECT * FROM worker_pending WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(pending);
});

// DELETE pending
router.delete('/pending/:penId', (req, res) => {
    db.prepare('DELETE FROM worker_pending WHERE id = ?').run(req.params.penId);
    res.status(204).end();
});

// ==================== SALARY CALCULATION ====================

// GET salary calculation for a single worker within date range
router.get('/:id/salary', (req, res) => {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
        const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        res.json(buildSalaryData(worker, from_date, to_date));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
