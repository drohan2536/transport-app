import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `cert_${req.params.id}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// GET all companies
router.get('/', (req, res) => {
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
    res.json(companies);
});

// GET one company
router.get('/:id', (req, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
});

// POST create company
router.post('/', (req, res) => {
    const { name, address, email, phone, owner_name, pan_id } = req.body;
    if (!name || !email || !pan_id) {
        return res.status(400).json({ error: 'Company Name, Email, and PAN ID are required' });
    }
    const result = db.prepare(
        'INSERT INTO companies (name, address, email, phone, owner_name, pan_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, address || '', email, phone || '', owner_name || '', pan_id);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
});

// PUT update company
router.put('/:id', (req, res) => {
    const { name, address, email, phone, owner_name, pan_id } = req.body;
    if (!name || !email || !pan_id) {
        return res.status(400).json({ error: 'Company Name, Email, and PAN ID are required' });
    }
    db.prepare(
        'UPDATE companies SET name=?, address=?, email=?, phone=?, owner_name=?, pan_id=? WHERE id=?'
    ).run(name, address || '', email, phone || '', owner_name || '', pan_id, req.params.id);
    res.json({ id: Number(req.params.id), ...req.body });
});

// DELETE company
router.delete('/:id', (req, res) => {
    const clients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE company_id = ?').get(req.params.id);
    if (clients.count > 0) {
        return res.status(400).json({ error: 'Cannot delete company with existing clients' });
    }
    db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

// POST upload certificate
router.post('/:id/upload', upload.single('certificate'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE companies SET udyam_certificate_path = ? WHERE id = ?').run(filePath, req.params.id);
    res.json({ path: filePath });
});

export default router;
