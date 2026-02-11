import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET smtp config
router.get('/', (req, res) => {
    const config = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
    // Don't send password to client
    if (config) config.password = config.password ? '••••••••' : '';
    res.json(config || {});
});

// PUT update smtp config
router.put('/', (req, res) => {
    const { host, port, secure, username, password } = req.body;

    // If password is masked, keep existing
    const existing = db.prepare('SELECT password FROM smtp_config WHERE id = 1').get();
    const actualPassword = password === '••••••••' ? existing.password : password;

    db.prepare(
        'UPDATE smtp_config SET host=?, port=?, secure=?, username=?, password=? WHERE id=1'
    ).run(host || '', port || 587, secure ? 1 : 0, username || '', actualPassword || '');

    res.json({ message: 'SMTP configuration updated' });
});

export default router;
