import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all scheduled emails (with invoice info)
router.get('/', (req, res) => {
    const scheduled = db.prepare(`
        SELECT se.*, i.invoice_number, c.name as client_name, co.name as company_name
        FROM scheduled_emails se
        JOIN invoices i ON se.invoice_id = i.id
        JOIN clients c ON i.client_id = c.id
        JOIN companies co ON i.company_id = co.id
        ORDER BY se.scheduled_at ASC
    `).all();
    // Don't send the huge pdf_base64 in list queries
    res.json(scheduled.map(s => ({ ...s, pdf_base64: undefined })));
});

// GET scheduled emails for a specific invoice
router.get('/invoice/:invoiceId', (req, res) => {
    const scheduled = db.prepare(`
        SELECT id, invoice_id, scheduled_at, status, error_message, created_at, sent_at
        FROM scheduled_emails
        WHERE invoice_id = ?
        ORDER BY scheduled_at ASC
    `).all(req.params.invoiceId);
    res.json(scheduled);
});

// POST schedule a new email
router.post('/', (req, res) => {
    const { invoice_id, scheduled_at, pdfBase64 } = req.body;

    if (!invoice_id || !scheduled_at || !pdfBase64) {
        return res.status(400).json({ error: 'invoice_id, scheduled_at, and pdfBase64 are required' });
    }

    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduled_at);
    if (isNaN(scheduledTime.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled_at datetime' });
    }
    if (scheduledTime <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Validate invoice exists
    const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
    }

    // Validate SMTP is configured
    const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
    if (!smtp || !smtp.host || !smtp.username) {
        return res.status(400).json({ error: 'SMTP not configured. Please set up email settings first.' });
    }

    // Validate client has email
    const inv = db.prepare(`
        SELECT i.client_id FROM invoices i WHERE i.id = ?
    `).get(invoice_id);
    const contact = db.prepare("SELECT email FROM contact_persons WHERE client_id = ? AND email != '' LIMIT 1").get(inv.client_id);
    if (!contact || !contact.email) {
        return res.status(400).json({ error: 'No email found for this client' });
    }

    const result = db.prepare(`
        INSERT INTO scheduled_emails (invoice_id, scheduled_at, pdf_base64, status)
        VALUES (?, ?, ?, 'pending')
    `).run(invoice_id, scheduledTime.toISOString(), pdfBase64);

    res.status(201).json({
        id: result.lastInsertRowid,
        invoice_id,
        scheduled_at: scheduledTime.toISOString(),
        status: 'pending',
        message: `Email scheduled for ${scheduledTime.toLocaleString()}`
    });
});

// DELETE cancel a scheduled email
router.delete('/:id', (req, res) => {
    const scheduled = db.prepare('SELECT * FROM scheduled_emails WHERE id = ?').get(req.params.id);
    if (!scheduled) {
        return res.status(404).json({ error: 'Scheduled email not found' });
    }
    if (scheduled.status !== 'pending') {
        return res.status(400).json({ error: `Cannot cancel a ${scheduled.status} email` });
    }

    db.prepare("UPDATE scheduled_emails SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Scheduled email cancelled' });
});

export default router;
