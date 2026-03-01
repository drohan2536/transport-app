import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all clients (with contacts and company name)
router.get('/', (req, res) => {
    const clients = db.prepare(`
    SELECT c.*, co.name as company_name, co.address as company_address, co.phone as company_phone, co.owner_name, co.pan_id 
    FROM clients c 
    JOIN companies co ON c.company_id = co.id 
    ORDER BY c.name
  `).all();

    const contacts = db.prepare('SELECT * FROM contact_persons ORDER BY id').all();
    const contactMap = {};
    for (const cp of contacts) {
        if (!contactMap[cp.client_id]) contactMap[cp.client_id] = [];
        contactMap[cp.client_id].push(cp);
    }

    for (const client of clients) {
        client.contacts = contactMap[client.id] || [];
    }
    res.json(clients);
});

// GET one client
router.get('/:id', (req, res) => {
    const client = db.prepare(`
    SELECT c.*, co.name as company_name 
    FROM clients c 
    JOIN companies co ON c.company_id = co.id 
    WHERE c.id = ?
  `).get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    client.contacts = db.prepare('SELECT * FROM contact_persons WHERE client_id = ?').all(req.params.id);
    res.json(client);
});

// POST create client
router.post('/', (req, res) => {
    const { name, address, company_id, invoice_visible_columns, contacts } = req.body;
    if (!name || !company_id) {
        return res.status(400).json({ error: 'Client Name and Company are required' });
    }

    const txn = db.transaction(() => {
        const result = db.prepare(
            'INSERT INTO clients (name, address, company_id, invoice_visible_columns) VALUES (?, ?, ?, ?)'
        ).run(name, address || '', company_id, invoice_visible_columns ? JSON.stringify(invoice_visible_columns) : '[]');

        const clientId = result.lastInsertRowid;

        if (contacts && contacts.length > 0) {
            const insert = db.prepare(
                'INSERT INTO contact_persons (client_id, name, phone, email) VALUES (?, ?, ?, ?)'
            );
            for (const cp of contacts) {
                insert.run(clientId, cp.name || '', cp.phone || '', cp.email || '');
            }
        }

        return clientId;
    });

    try {
        const clientId = txn();
        const client = db.prepare('SELECT c.*, co.name as company_name FROM clients c JOIN companies co ON c.company_id = co.id WHERE c.id = ?').get(clientId);
        client.contacts = db.prepare('SELECT * FROM contact_persons WHERE client_id = ?').all(clientId);
        res.status(201).json(client);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update client
router.put('/:id', (req, res) => {
    const { name, address, company_id, invoice_visible_columns, contacts } = req.body;
    if (!name || !company_id) {
        return res.status(400).json({ error: 'Client Name and Company are required' });
    }

    const txn = db.transaction(() => {
        db.prepare('UPDATE clients SET name=?, address=?, company_id=?, invoice_visible_columns=? WHERE id=?')
            .run(name, address || '', company_id, invoice_visible_columns ? JSON.stringify(invoice_visible_columns) : '[]', req.params.id);

        // Replace contacts
        db.prepare('DELETE FROM contact_persons WHERE client_id = ?').run(req.params.id);
        if (contacts && contacts.length > 0) {
            const insert = db.prepare(
                'INSERT INTO contact_persons (client_id, name, phone, email) VALUES (?, ?, ?, ?)'
            );
            for (const cp of contacts) {
                insert.run(req.params.id, cp.name || '', cp.phone || '', cp.email || '');
            }
        }
    });

    try {
        txn();
        const client = db.prepare('SELECT c.*, co.name as company_name FROM clients c JOIN companies co ON c.company_id = co.id WHERE c.id = ?').get(req.params.id);
        client.contacts = db.prepare('SELECT * FROM contact_persons WHERE client_id = ?').all(req.params.id);
        res.json(client);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE client
router.delete('/:id', (req, res) => {
    const entries = db.prepare('SELECT COUNT(*) as count FROM entries WHERE client_id = ?').get(req.params.id);
    if (entries.count > 0) {
        return res.status(400).json({ error: 'Cannot delete client with existing entries' });
    }
    db.prepare('DELETE FROM contact_persons WHERE client_id = ?').run(req.params.id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

export default router;
