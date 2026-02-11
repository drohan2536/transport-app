import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET entries (with optional filters)
router.get('/', (req, res) => {
    let sql = `
    SELECT e.*, c.name as client_name, co.name as company_name
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    JOIN companies co ON c.company_id = co.id
  `;
    const conditions = [];
    const params = [];

    if (req.query.client_id) {
        conditions.push('e.client_id = ?');
        params.push(req.query.client_id);
    }
    if (req.query.from_date) {
        conditions.push('e.date >= ?');
        params.push(req.query.from_date);
    }
    if (req.query.to_date) {
        conditions.push('e.date <= ?');
        params.push(req.query.to_date);
    }
    if (req.query.uninvoiced === '1') {
        conditions.push('e.invoice_id IS NULL');
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY e.date DESC, e.id DESC';

    const entries = db.prepare(sql).all(...params);
    res.json(entries);
});

// GET one entry
router.get('/:id', (req, res) => {
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
});

// POST create entry
router.post('/', (req, res) => {
    const d = req.body;
    if (!d.client_id || !d.date || !d.entry_type) {
        return res.status(400).json({ error: 'Client, Date, and Entry Type are required' });
    }

    // Use client values if provided, otherwise default to 0 (trust client logic for manual overrides)
    const weight = d.weight !== undefined ? d.weight : 0;
    const amount = d.amount !== undefined ? d.amount : 0;
    const loadingCharges = d.has_loading_charges ? (d.loading_charges || 0) : 0;
    const totalAmount = d.total_amount !== undefined ? d.total_amount : (amount + loadingCharges);

    const result = db.prepare(`
    INSERT INTO entries (client_id, date, from_location, to_location,
      has_challan, challan_number, has_vehicle, vehicle_number,
      entry_type, unit, length, width, gsm, packaging, no_of_packets,
      weight, rate_per_kg, no_of_bundles, rate_per_bundle,
      amount, has_loading_charges, loading_charges, total_amount)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
        d.client_id, d.date, d.from_location || '', d.to_location || '',
        d.has_challan ? 1 : 0, d.challan_number || '',
        d.has_vehicle ? 1 : 0, d.vehicle_number || '',
        d.entry_type, d.unit || '', d.length || 0, d.width || 0,
        d.gsm || 0, d.packaging || 0, d.no_of_packets || 0,
        weight, d.rate_per_kg || 0,
        d.no_of_bundles || 0, d.rate_per_bundle || 0,
        amount, d.has_loading_charges ? 1 : 0, loadingCharges, totalAmount
    );

    const entry = db.prepare(`
    SELECT e.*, c.name as client_name, co.name as company_name
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    JOIN companies co ON c.company_id = co.id
    WHERE e.id = ?
  `).get(result.lastInsertRowid);
    res.status(201).json(entry);
});

// PUT update entry
router.put('/:id', (req, res) => {
    const d = req.body;

    const weight = d.weight !== undefined ? d.weight : 0;
    const amount = d.amount !== undefined ? d.amount : 0;
    const loadingCharges = d.has_loading_charges ? (d.loading_charges || 0) : 0;
    const totalAmount = d.total_amount !== undefined ? d.total_amount : (amount + loadingCharges);

    db.prepare(`
    UPDATE entries SET client_id=?, date=?, from_location=?, to_location=?,
      has_challan=?, challan_number=?, has_vehicle=?, vehicle_number=?,
      entry_type=?, unit=?, length=?, width=?, gsm=?, packaging=?, no_of_packets=?,
      weight=?, rate_per_kg=?, no_of_bundles=?, rate_per_bundle=?,
      amount=?, has_loading_charges=?, loading_charges=?, total_amount=?
    WHERE id=?
  `).run(
        d.client_id, d.date, d.from_location || '', d.to_location || '',
        d.has_challan ? 1 : 0, d.challan_number || '',
        d.has_vehicle ? 1 : 0, d.vehicle_number || '',
        d.entry_type, d.unit || '', d.length || 0, d.width || 0,
        d.gsm || 0, d.packaging || 0, d.no_of_packets || 0,
        weight, d.rate_per_kg || 0,
        d.no_of_bundles || 0, d.rate_per_bundle || 0,
        amount, d.has_loading_charges ? 1 : 0, loadingCharges, totalAmount,
        req.params.id
    );

    const entry = db.prepare(`
    SELECT e.*, c.name as client_name, co.name as company_name
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    JOIN companies co ON c.company_id = co.id
    WHERE e.id = ?
  `).get(req.params.id);
    res.json(entry);
});

// DELETE entry
router.delete('/:id', (req, res) => {
    const entry = db.prepare('SELECT invoice_id FROM entries WHERE id = ?').get(req.params.id);
    if (entry && entry.invoice_id) {
        return res.status(400).json({ error: 'Cannot delete entry linked to an invoice' });
    }
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

export default router;
