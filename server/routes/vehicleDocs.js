import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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

// GET all vehicle documents
router.get('/', (req, res) => {
    const docs = db.prepare('SELECT * FROM vehicle_documents ORDER BY created_at DESC').all();
    res.json(docs);
});

// POST upload new vehicle document
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { vehicle_number, doc_name, start_date, expiry_date } = req.body;
    if (!vehicle_number || !doc_name || !start_date || !expiry_date) {
        // Clean up uploaded file on validation failure
        try { fs.unlinkSync(req.file.path); } catch (_) { }
        return res.status(400).json({ error: 'vehicle_number, doc_name, start_date and expiry_date are required' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const result = db.prepare(
        'INSERT INTO vehicle_documents (vehicle_number, doc_name, file_path, file_name, start_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(vehicle_number, doc_name, filePath, req.file.originalname, start_date, expiry_date);

    res.status(201).json({
        id: result.lastInsertRowid,
        vehicle_number,
        doc_name,
        file_path: filePath,
        file_name: req.file.originalname,
        start_date,
        expiry_date
    });
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
