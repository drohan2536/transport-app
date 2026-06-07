import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET oldest unpaid entry date (for default from-date)
router.get('/oldest-unpaid-date', (req, res) => {
    try {
        const row = db.prepare(`
            SELECT MIN(e.date) AS oldest_date
            FROM entries e
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE (i.status IS NULL OR i.status != 'paid') AND e.is_paid = 0
        `).get();
        res.json({ oldest_date: row?.oldest_date || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Build SQL condition for paid/unpaid filter
function buildPaymentCondition(payment_filter) {
    if (payment_filter === 'unpaid') {
        return "AND (i.status IS NULL OR i.status != 'paid') AND e.is_paid = 0";
    } else if (payment_filter === 'paid') {
        return "AND (i.status = 'paid' OR e.is_paid = 1)";
    }
    return '';
}

// GET client-wise total amounts based on entry dates within a date range
router.get('/', (req, res) => {
    const { from_date, to_date, payment_filter } = req.query;

    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
        const paymentCondition = buildPaymentCondition(payment_filter);

        // Get all entries in date range, group by client, with paid/unpaid breakdown
        const results = db.prepare(`
            SELECT 
                c.id   AS client_id,
                c.name AS client_name,
                co.name AS company_name,
                COUNT(e.id) AS entry_count,
                SUM(e.total_amount) AS total_amount,
                COALESCE(SUM(CASE WHEN i.status = 'paid' OR e.is_paid = 1 THEN e.total_amount ELSE 0 END), 0) AS paid_amount,
                COALESCE(SUM(CASE WHEN (i.status IS NULL OR i.status != 'paid') AND e.is_paid = 0 THEN e.total_amount ELSE 0 END), 0) AS unpaid_amount,
                MIN(e.date) AS earliest_date,
                MAX(e.date) AS latest_date
            FROM entries e
            JOIN clients c  ON e.client_id = c.id
            JOIN companies co ON c.company_id = co.id
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE e.date >= ?
              AND e.date <= ?
              ${paymentCondition}
            GROUP BY c.id
            ORDER BY total_amount DESC
        `).all(from_date, to_date);

        // Overall totals with paid/unpaid breakdown
        const summary = db.prepare(`
            SELECT 
                COUNT(DISTINCT e.client_id) AS total_clients,
                COUNT(e.id) AS total_entries,
                COALESCE(SUM(e.total_amount), 0) AS total_outstanding,
                COALESCE(SUM(CASE WHEN i.status = 'paid' OR e.is_paid = 1 THEN e.total_amount ELSE 0 END), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN (i.status IS NULL OR i.status != 'paid') AND e.is_paid = 0 THEN e.total_amount ELSE 0 END), 0) AS total_unpaid
            FROM entries e
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE e.date >= ?
              AND e.date <= ?
              ${paymentCondition}
        `).get(from_date, to_date);

        res.json({ results, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET individual entries for a specific client within the date range
router.get('/client/:clientId', (req, res) => {
    const { from_date, to_date, payment_filter } = req.query;
    const { clientId } = req.params;

    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
        const paymentCondition = buildPaymentCondition(payment_filter);

        const entries = db.prepare(`
            SELECT e.*, 
                   c.name AS client_name, 
                   co.name AS company_name,
                   i.invoice_number,
                   i.status AS invoice_status
            FROM entries e
            JOIN clients c  ON e.client_id = c.id
            JOIN companies co ON c.company_id = co.id
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE e.client_id = ?
              AND e.date >= ?
              AND e.date <= ?
              ${paymentCondition}
            ORDER BY e.date ASC, e.id ASC
        `).all(clientId, from_date, to_date);

        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT bulk mark entries as paid
router.put('/bulk-paid', (req, res) => {
    const { entry_ids } = req.body;
    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
        return res.status(400).json({ error: 'entry_ids array is required' });
    }

    try {
        const txn = db.transaction(() => {
            const stmt = db.prepare('UPDATE entries SET is_paid = 1 WHERE id = ?');
            for (const id of entry_ids) {
                stmt.run(id);
            }
        });
        txn();
        res.json({ updated: entry_ids.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
