import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import companiesRouter from './routes/companies.js';
import clientsRouter from './routes/clients.js';
import entriesRouter from './routes/entries.js';
import invoicesRouter from './routes/invoices.js';
import smtpRouter from './routes/smtp.js';
import vehicleDocsRouter from './routes/vehicleDocs.js';
import vehiclesRouter from './routes/vehicles.js';
import settingsRouter from './routes/settings.js';
import outstandingRouter from './routes/outstanding.js';
import workersRouter from './routes/workers.js';
import scheduledEmailsRouter from './routes/scheduledEmails.js';
import { startExpiryScheduler } from './scheduler.js';
import { startEmailScheduler } from './emailScheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 9090;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/companies', companiesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/smtp', smtpRouter);
app.use('/api/vehicle-docs', vehicleDocsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/outstanding', outstandingRouter);
app.use('/api/workers', workersRouter);
app.use('/api/scheduled-emails', scheduledEmailsRouter);

// Serve built frontend (for production / IIS)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    const errorLog = `[${new Date().toISOString()}] ${err.stack}\n`;
    fs.appendFileSync(path.join(__dirname, 'server_errors.log'), errorLog);
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    startExpiryScheduler();    // Document expiry reminders (hourly)
    startEmailScheduler();     // Scheduled invoice emails (every 1 minute)
});
