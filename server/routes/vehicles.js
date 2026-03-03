import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET all vehicles
router.get('/', (req, res) => {
    const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY vehicle_number ASC').all();
    res.json(vehicles);
});

// GET single vehicle
router.get('/:id', (req, res) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
});

// POST create vehicle
router.post('/', (req, res) => {
    const { vehicle_number, chassis_number, engine_number, model, registration_date, owner_name, owner_address, owner_email } = req.body;
    if (!vehicle_number) return res.status(400).json({ error: 'Vehicle number is required' });

    // Check if vehicle_number already exists
    const existing = db.prepare('SELECT id FROM vehicles WHERE vehicle_number = ?').get(vehicle_number.trim().toUpperCase());
    if (existing) return res.status(400).json({ error: 'Vehicle with this number already exists' });

    const result = db.prepare(
        'INSERT INTO vehicles (vehicle_number, chassis_number, engine_number, model, registration_date, owner_name, owner_address, owner_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
        vehicle_number.trim().toUpperCase(),
        chassis_number || '', engine_number || '', model || '',
        registration_date || '', owner_name || '', owner_address || '', owner_email || ''
    );

    res.status(201).json({
        id: result.lastInsertRowid,
        vehicle_number: vehicle_number.trim().toUpperCase(),
        chassis_number: chassis_number || '',
        engine_number: engine_number || '',
        model: model || '',
        registration_date: registration_date || '',
        owner_name: owner_name || '',
        owner_address: owner_address || '',
        owner_email: owner_email || ''
    });
});

// PUT update vehicle
router.put('/:id', (req, res) => {
    const { vehicle_number, chassis_number, engine_number, model, registration_date, owner_name, owner_address, owner_email } = req.body;
    if (!vehicle_number) return res.status(400).json({ error: 'Vehicle number is required' });

    db.prepare(
        'UPDATE vehicles SET vehicle_number=?, chassis_number=?, engine_number=?, model=?, registration_date=?, owner_name=?, owner_address=?, owner_email=? WHERE id=?'
    ).run(
        vehicle_number.trim().toUpperCase(),
        chassis_number || '', engine_number || '', model || '',
        registration_date || '', owner_name || '', owner_address || '', owner_email || '',
        req.params.id
    );

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    res.json(vehicle);
});

// DELETE vehicle
router.delete('/:id', (req, res) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

export default router;
