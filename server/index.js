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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/companies', companiesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/smtp', smtpRouter);

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
