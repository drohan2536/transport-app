import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET client-wise total amounts based on entry dates within a date range
router.get('/', (req, res) => {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
        // Get all entries in date range, group by client, with paid/unpaid breakdown
        // An entry is "paid" if it has an invoice with status='paid'
        const results = db.prepare(`
            SELECT 
                c.id   AS client_id,
                c.name AS client_name,
                co.name AS company_name,
                COUNT(e.id) AS entry_count,
                SUM(e.total_amount) AS total_amount,
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN e.total_amount ELSE 0 END), 0) AS paid_amount,
                COALESCE(SUM(CASE WHEN i.status IS NULL OR i.status != 'paid' THEN e.total_amount ELSE 0 END), 0) AS unpaid_amount,
                MIN(e.date) AS earliest_date,
                MAX(e.date) AS latest_date
            FROM entries e
            JOIN clients c  ON e.client_id = c.id
            JOIN companies co ON c.company_id = co.id
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE e.date >= ?
              AND e.date <= ?
            GROUP BY c.id
            ORDER BY total_amount DESC
        `).all(from_date, to_date);

        // Overall totals with paid/unpaid breakdown
        const summary = db.prepare(`
            SELECT 
                COUNT(DISTINCT e.client_id) AS total_clients,
                COUNT(e.id) AS total_entries,
                COALESCE(SUM(e.total_amount), 0) AS total_outstanding,
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN e.total_amount ELSE 0 END), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN i.status IS NULL OR i.status != 'paid' THEN e.total_amount ELSE 0 END), 0) AS total_unpaid
            FROM entries e
            LEFT JOIN invoices i ON e.invoice_id = i.id
            WHERE e.date >= ?
              AND e.date <= ?
        `).get(from_date, to_date);

        res.json({ results, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET individual entries for a specific client within the date range
router.get('/client/:clientId', (req, res) => {
    const { from_date, to_date } = req.query;
    const { clientId } = req.params;

    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    try {
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
            ORDER BY e.date DESC, e.id DESC
        `).all(clientId, from_date, to_date);

        res.json(entries);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
