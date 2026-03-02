import { Router } from 'express';
import nodemailer from 'nodemailer';
import db from '../db.js';

const router = Router();

// Generate invoice number: ABBR/FY-XXX (e.g. KGTS/25-26-001)
function generateInvoiceNumber(abbreviation) {
    const prefix = abbreviation ? `${abbreviation.toUpperCase()}/` : '';
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const year = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = `${String(year % 100).padStart(2, '0')}-${String((year + 1) % 100).padStart(2, '0')}`;

    const searchPattern = `${prefix}${fy}-%`;

    const last = db.prepare(
        "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1"
    ).get(searchPattern);

    let seq = 1;
    if (last) {
        const parts = last.invoice_number.split('-');
        // Example: KGTS/25-26-001
        // Parts: ['KGTS/25', '26', '001']
        const lastPart = parts[parts.length - 1];
        seq = parseInt(lastPart, 10) + 1;
    }
    return `${prefix}${fy}-${String(seq).padStart(3, '0')}`;
}

// GET all invoices
router.get('/', (req, res) => {
    const invoices = db.prepare(`
    SELECT i.*, c.name as client_name, co.name as company_name
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    JOIN companies co ON i.company_id = co.id
    ORDER BY i.created_at DESC
  `).all();
    res.json(invoices);
});

// GET single invoice with entries
router.get('/:id', (req, res, next) => {
    try {
        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, c.address as client_address, c.invoice_visible_columns,
        co.name as company_name, co.address as company_address,
        co.phone as company_phone, co.email as company_email,
        co.owner_name, co.pan_id
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN companies co ON i.company_id = co.id
      WHERE i.id = ?
    `).get(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        invoice.entries = db.prepare('SELECT * FROM entries WHERE invoice_id = ? ORDER BY date').all(req.params.id);

        // Get client email (first contact with email)
        const contact = db.prepare("SELECT email FROM contact_persons WHERE client_id = ? AND email != '' LIMIT 1").get(invoice.client_id);
        invoice.client_email = contact ? contact.email : '';

        res.json(invoice);
    } catch (err) {
        next(err);
    }
});

// POST create invoice
router.post('/', (req, res) => {
    const { client_id, from_date, to_date, invoice_date, entry_ids } = req.body;
    if (!client_id || !from_date || !to_date || !entry_ids || entry_ids.length === 0) {
        return res.status(400).json({ error: 'Client, date range, and entries are required' });
    }

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const company = db.prepare('SELECT abbreviation FROM companies WHERE id = ?').get(client.company_id);

    const txn = db.transaction(() => {
        const invoiceNumber = generateInvoiceNumber(company?.abbreviation);

        // Calculate total
        const entries = db.prepare(
            `SELECT * FROM entries WHERE id IN (${entry_ids.map(() => '?').join(',')}) AND invoice_id IS NULL`
        ).all(...entry_ids);

        if (entries.length === 0) {
            throw new Error('No valid uninvoiced entries found');
        }

        const finalAmount = entries.reduce((sum, e) => sum + (e.total_amount || 0), 0);

        const result = db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, company_id, invoice_date, from_date, to_date, final_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNumber, client_id, client.company_id, invoice_date || new Date().toISOString().split('T')[0], from_date, to_date, finalAmount);

        // Link entries to invoice
        const update = db.prepare('UPDATE entries SET invoice_id = ? WHERE id = ?');
        for (const eid of entry_ids) {
            update.run(result.lastInsertRowid, eid);
        }

        return result.lastInsertRowid;
    });

    try {
        const invoiceId = txn();
        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, c.address as client_address, c.invoice_visible_columns,
        co.name as company_name, co.address as company_address,
        co.phone as company_phone, co.email as company_email,
        co.owner_name, co.pan_id
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN companies co ON i.company_id = co.id
      WHERE i.id = ?
    `).get(invoiceId);
        invoice.entries = db.prepare('SELECT * FROM entries WHERE invoice_id = ? ORDER BY date').all(invoiceId);
        res.status(201).json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update invoice
router.put('/:id', (req, res) => {
    const { invoice_date, entry_ids } = req.body;

    const txn = db.transaction(() => {
        // Unlink old entries
        db.prepare('UPDATE entries SET invoice_id = NULL WHERE invoice_id = ?').run(req.params.id);

        if (entry_ids && entry_ids.length > 0) {
            const entries = db.prepare(
                `SELECT * FROM entries WHERE id IN (${entry_ids.map(() => '?').join(',')})`
            ).all(...entry_ids);

            const finalAmount = entries.reduce((sum, e) => sum + (e.total_amount || 0), 0);

            db.prepare('UPDATE invoices SET invoice_date=?, final_amount=? WHERE id=?')
                .run(invoice_date, finalAmount, req.params.id);

            const update = db.prepare('UPDATE entries SET invoice_id = ? WHERE id = ?');
            for (const eid of entry_ids) {
                update.run(req.params.id, eid);
            }
        }
    });

    txn();
    const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, co.name as company_name
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    JOIN companies co ON i.company_id = co.id
    WHERE i.id = ?
  `).get(req.params.id);
    res.json(invoice);
});

// PUT mark paid
router.put('/:id/paid', (req, res) => {
    const invoice = db.prepare('SELECT status FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const newStatus = invoice.status === 'paid' ? 'unpaid' : 'paid';
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, req.params.id);
    res.json({ status: newStatus });
});

// DELETE invoice
router.delete('/:id', (req, res) => {
    db.prepare('UPDATE entries SET invoice_id = NULL WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

// POST send email
router.post('/:id/email', async (req, res) => {
    try {
        const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
        if (!smtp || !smtp.host || !smtp.username) {
            return res.status(400).json({ error: 'SMTP not configured. Please set up email settings first.' });
        }

        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, co.name as company_name, co.email as company_email
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN companies co ON i.company_id = co.id
      WHERE i.id = ?
    `).get(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const contact = db.prepare("SELECT email FROM contact_persons WHERE client_id = ? AND email != '' LIMIT 1").get(invoice.client_id);
        if (!contact || !contact.email) {
            return res.status(400).json({ error: 'No email found for this client' });
        }

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure === 1,
            auth: { user: smtp.username, pass: smtp.password }
        });

        const { pdfBase64 } = req.body;

        await transporter.sendMail({
            from: `"${invoice.company_name}" <${smtp.username}>`,
            to: contact.email,
            subject: `Invoice ${invoice.invoice_number} - ${invoice.company_name}`,
            text: `Dear ${invoice.client_name},\n\nPlease find attached invoice ${invoice.invoice_number} dated ${invoice.invoice_date}.\n\nTotal Amount: ₹${invoice.final_amount.toFixed(2)}\n\nRegards,\n${invoice.company_name}`,
            attachments: pdfBase64 ? [{
                filename: `Invoice_${invoice.invoice_number}.pdf`,
                content: pdfBase64,
                encoding: 'base64'
            }] : []
        });

        res.json({ message: 'Email sent successfully' });
    } catch (err) {
        res.status(500).json({ error: `Failed to send email: ${err.message}` });
    }
});

export default router;
