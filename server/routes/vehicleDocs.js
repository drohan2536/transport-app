import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `vdoc_${base}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET all vehicle documents (joined with vehicles for owner info)
router.get('/', (req, res) => {
    const docs = db.prepare(`
        SELECT vd.*,
            COALESCE(v.owner_name, vd.owner_name) as owner_name,
            COALESCE(v.owner_email, vd.owner_email) as owner_email,
            v.owner_address, v.chassis_number, v.engine_number, v.model
        FROM vehicle_documents vd
        LEFT JOIN vehicles v ON v.vehicle_number = vd.vehicle_number
        ORDER BY vd.created_at DESC
    `).all();
    res.json(docs);
});

// POST upload new vehicle document
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { vehicle_number, doc_name, start_date, expiry_date, owner_name, owner_email } = req.body;
    if (!vehicle_number || !doc_name || !start_date || !expiry_date) {
        // Clean up uploaded file on validation failure
        try { fs.unlinkSync(req.file.path); } catch (_) { }
        return res.status(400).json({ error: 'vehicle_number, doc_name, start_date and expiry_date are required' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const result = db.prepare(
        'INSERT INTO vehicle_documents (vehicle_number, doc_name, file_path, file_name, start_date, expiry_date, owner_name, owner_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(vehicle_number, doc_name, filePath, req.file.originalname, start_date, expiry_date, owner_name || '', owner_email || '');

    res.status(201).json({
        id: result.lastInsertRowid,
        vehicle_number,
        doc_name,
        file_path: filePath,
        file_name: req.file.originalname,
        start_date,
        expiry_date,
        owner_name: owner_name || '',
        owner_email: owner_email || ''
    });
});

// POST send expiry reminder email for a document
router.post('/:id/send-reminder', async (req, res) => {
    try {
        const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
        if (!smtp || !smtp.host || !smtp.username) {
            return res.status(400).json({ error: 'SMTP not configured. Please set up email settings first.' });
        }

        const doc = db.prepare('SELECT * FROM vehicle_documents WHERE id = ?').get(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        const recipientEmail = doc.owner_email || smtp.username;
        const ownerName = doc.owner_name || 'Vehicle Owner';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(doc.expiry_date);
        expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        const isExpired = diffDays < 0;
        const statusText = isExpired
            ? `EXPIRED ${Math.abs(diffDays)} days ago (${doc.expiry_date})`
            : `expiring in ${diffDays} days (${doc.expiry_date})`;

        const subject = isExpired
            ? `🔴 EXPIRED: Vehicle Document - ${doc.vehicle_number} / ${doc.doc_name}`
            : `⚠️ EXPIRING SOON: Vehicle Document - ${doc.vehicle_number} / ${doc.doc_name}`;

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.port === 465,
            auth: { user: smtp.username, pass: smtp.password },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: `"MorMukut Transport" <${smtp.username}>`,
            to: recipientEmail,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: ${isExpired ? '#dc2626' : '#d97706'}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0;">${isExpired ? '🔴 Document Expired' : '⚠️ Document Expiring Soon'}</h2>
                    </div>
                    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0 0 16px 0; color: #374151;">Dear <strong>${ownerName}</strong>,</p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 140px;">Vehicle Number:</td>
                                <td style="padding: 8px 0; color: #111; font-family: monospace; font-size: 1.1em;">${doc.vehicle_number}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Document:</td>
                                <td style="padding: 8px 0; color: #111;">${doc.doc_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Owner:</td>
                                <td style="padding: 8px 0; color: #111;">${ownerName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Start Date:</td>
                                <td style="padding: 8px 0; color: #111;">${doc.start_date}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Expiry Date:</td>
                                <td style="padding: 8px 0; color: ${isExpired ? '#dc2626' : '#d97706'}; font-weight: bold;">${doc.expiry_date}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Status:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${isExpired ? '#fef2f2' : '#fffbeb'}; color: ${isExpired ? '#dc2626' : '#d97706'}; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 0.9em;">
                                        ${statusText}
                                    </span>
                                </td>
                            </tr>
                        </table>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                        <p style="color: #6b7280; font-size: 0.85em; margin: 0;">
                            This is an automated reminder from MorMukut Transport Billing System.<br/>
                            Please renew the document at the earliest to avoid any issues.
                        </p>
                    </div>
                </div>
            `
        });

        const sentTo = recipientEmail === smtp.username ? 'self' : recipientEmail;
        res.json({ message: `Reminder sent to ${sentTo} for ${doc.vehicle_number} - ${doc.doc_name}` });
    } catch (err) {
        res.status(500).json({ error: `Failed to send email: ${err.message}` });
    }
});

// DELETE vehicle document
router.delete('/:id', (req, res) => {
    const doc = db.prepare('SELECT * FROM vehicle_documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Remove file from disk
    try {
        const fullPath = path.join(__dirname, '..', doc.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (e) {
        console.error('Error deleting vehicle doc file:', e);
    }

    db.prepare('DELETE FROM vehicle_documents WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

export default router;
