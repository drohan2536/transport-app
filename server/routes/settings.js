import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import multer from 'multer';
import db, { closeDatabase, reopenDatabase, DB_PATH } from '../db.js';
import { restartExpiryScheduler } from '../scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.dirname(DB_PATH);
const dbPath = DB_PATH;

// Configure multer for ZIP upload (store in temp)
const upload = multer({
    dest: path.join(__dirname, '..', 'temp_uploads'),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.toLowerCase().endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are accepted'));
        }
    }
});

const router = Router();

// GET app settings
router.get('/', (req, res) => {
    const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    res.json(settings || { scheduler_interval_minutes: 60 });
});

// PUT update app settings
router.put('/', (req, res) => {
    const { scheduler_interval_minutes } = req.body;

    const interval = Math.max(1, Math.min(1440, parseInt(scheduler_interval_minutes) || 60));

    db.prepare(
        'UPDATE app_settings SET scheduler_interval_minutes = ? WHERE id = 1'
    ).run(interval);

    // Restart the scheduler with the new interval
    restartExpiryScheduler();

    res.json({ message: 'Settings updated', scheduler_interval_minutes: interval });
});

// POST reset invoice number for a company
router.post('/reset-invoice-number', (req, res) => {
    const { company_id, new_number } = req.body;

    if (!company_id || !new_number) {
        return res.status(400).json({ error: 'Company and new number are required' });
    }

    const parts = new_number.trim().split('-');
    if (parts.length !== 3) {
        return res.status(400).json({ error: 'Invalid format. Use FY format like "26-27-010"' });
    }

    const fyPart = `${parts[0]}-${parts[1]}`;
    const seqPart = parseInt(parts[2], 10);

    if (isNaN(seqPart) || seqPart < 1) {
        return res.status(400).json({ error: 'Sequence number must be a positive number' });
    }

    const company = db.prepare('SELECT id, name, abbreviation FROM companies WHERE id = ?').get(company_id);
    if (!company) {
        return res.status(404).json({ error: 'Company not found' });
    }

    const abbreviation = (company.abbreviation || '').toUpperCase();

    try {
        db.prepare(`
            INSERT INTO invoice_seq_overrides (abbreviation, fy_pattern, next_seq)
            VALUES (?, ?, ?)
            ON CONFLICT(abbreviation, fy_pattern) DO UPDATE SET next_seq = ?
        `).run(abbreviation, fyPart, seqPart, seqPart);

        const nextInvoiceNumber = abbreviation
            ? `${abbreviation}/${fyPart}-${String(seqPart).padStart(3, '0')}`
            : `${fyPart}-${String(seqPart).padStart(3, '0')}`;

        res.json({
            message: `Invoice number reset successfully. Next invoice for ${company.name} will start at: ${nextInvoiceNumber}`,
            next_invoice_number: nextInvoiceNumber,
            company_name: company.name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET current invoice overrides
router.get('/invoice-overrides', (req, res) => {
    try {
        const overrides = db.prepare(`
            SELECT o.*, c.name as company_name 
            FROM invoice_seq_overrides o
            LEFT JOIN companies c ON UPPER(c.abbreviation) = o.abbreviation
        `).all();
        res.json(overrides);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== BACKUP & RESTORE ====================

// GET backup — downloads the database as a ZIP file
router.get('/backup', (req, res) => {
    try {
        // First, checkpoint WAL to make sure all data is flushed to the main DB file
        db.pragma('wal_checkpoint(TRUNCATE)');

        // Check if the DB file exists
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ error: 'Database file not found' });
        }

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, 19);
        const zipFilename = `transport-backup-${timestamp}.zip`;

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        // Create ZIP archive and pipe to response
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create backup' });
            }
        });

        archive.pipe(res);

        // Add the database file to the ZIP
        archive.file(dbPath, { name: 'transport.db' });

        // Also add WAL and SHM files if they exist (for completeness)
        const walPath = dbPath + '-wal';
        const shmPath = dbPath + '-shm';
        if (fs.existsSync(walPath)) {
            archive.file(walPath, { name: 'transport.db-wal' });
        }
        if (fs.existsSync(shmPath)) {
            archive.file(shmPath, { name: 'transport.db-shm' });
        }

        archive.finalize();
    } catch (err) {
        console.error('Backup error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: `Backup failed: ${err.message}` });
        }
    }
});

// POST restore — accepts ZIP file, extracts and replaces the database
router.post('/restore', upload.single('backup'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please upload a ZIP file.' });
    }

    const uploadedPath = req.file.path;

    try {
        // Open and validate the ZIP
        const zip = new AdmZip(uploadedPath);
        const zipEntries = zip.getEntries();

        // Check that the ZIP contains transport.db
        const dbEntry = zipEntries.find(e => e.entryName === 'transport.db');
        if (!dbEntry) {
            fs.unlinkSync(uploadedPath);
            return res.status(400).json({ error: 'Invalid backup file. ZIP must contain "transport.db".' });
        }

        // Create a safety backup of the current DB before overwriting
        const safetyBackupPath = dbPath + '.pre-restore-backup';
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, safetyBackupPath);
        }

        try {
            // Extract transport.db from the ZIP to a temp location first
            const tempExtractDir = path.join(dataDir, '_restore_temp');
            if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir, { recursive: true });

            zip.extractEntryTo(dbEntry, tempExtractDir, false, true);

            const extractedDbPath = path.join(tempExtractDir, 'transport.db');

            // CLOSE the database FIRST to release file locks (WAL/SHM)
            closeDatabase();

            // Now it's safe to do file operations
            // Overwrite the live DB file with the extracted one
            fs.copyFileSync(extractedDbPath, dbPath);

            // Clean up WAL/SHM files from the current DB
            const walPath = dbPath + '-wal';
            const shmPath = dbPath + '-shm';
            if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch (e) { /* ignore */ }
            if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch (e) { /* ignore */ }

            // Also extract WAL and SHM from backup if present
            const walEntry = zipEntries.find(e => e.entryName === 'transport.db-wal');
            const shmEntry = zipEntries.find(e => e.entryName === 'transport.db-shm');
            if (walEntry) {
                zip.extractEntryTo(walEntry, dataDir, false, true);
            }
            if (shmEntry) {
                zip.extractEntryTo(shmEntry, dataDir, false, true);
            }

            // Clean up temp files
            fs.unlinkSync(extractedDbPath);
            try { fs.rmdirSync(tempExtractDir); } catch (e) { /* ignore */ }
            fs.unlinkSync(uploadedPath);

            // Remove safety backup on success
            if (fs.existsSync(safetyBackupPath)) {
                fs.unlinkSync(safetyBackupPath);
            }

            // Reopen the database connection with the restored file
            reopenDatabase();

            res.json({
                message: 'Database restored successfully! All data has been updated.',
                restart_required: false
            });

        } catch (extractErr) {
            // Restore the safety backup if extraction fails
            if (fs.existsSync(safetyBackupPath)) {
                fs.copyFileSync(safetyBackupPath, dbPath);
                fs.unlinkSync(safetyBackupPath);
            }
            throw extractErr;
        }

    } catch (err) {
        // Clean up uploaded file on error
        if (fs.existsSync(uploadedPath)) {
            fs.unlinkSync(uploadedPath);
        }
        console.error('Restore error:', err);
        res.status(500).json({ error: `Restore failed: ${err.message}` });
    }
});

// GET backup info (DB file size, last modified)
router.get('/backup-info', (req, res) => {
    try {
        if (!fs.existsSync(dbPath)) {
            return res.json({ exists: false });
        }
        const stats = fs.statSync(dbPath);
        res.json({
            exists: true,
            size_bytes: stats.size,
            size_readable: formatBytes(stats.size),
            last_modified: stats.mtime.toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
