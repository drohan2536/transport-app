import { Router } from 'express';
import db from '../db.js';
import { restartExpiryScheduler } from '../scheduler.js';

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

export default router;
