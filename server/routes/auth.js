import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'transport-app-secret-key-2026';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// In-memory OTP store: { phone: { otp, expiresAt, name, username, password } }
const otpStore = new Map();

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// Middleware: verify token and attach user to req
function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
}

// POST /api/auth/login — Username + Password login
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const hashed = hashPassword(password);
        if (hashed !== user.password_hash) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user.id, name: user.name, username: user.username, phone: user.phone, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/send-otp — Send OTP to phone number (for signup)
router.post('/send-otp', (req, res) => {
    try {
        const { phone, name, username, password } = req.body;
        if (!phone || !name || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if username already exists
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const otp = generateOTP();
        otpStore.set(phone.trim(), {
            otp,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
            name: name.trim(),
            username: username.trim().toLowerCase(),
            password: password
        });

        // In production, send OTP via SMS gateway here
        console.log(`📱 OTP for ${phone}: ${otp}`);

        res.json({
            message: 'OTP sent successfully',
            otp_dev: otp
        });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// POST /api/auth/verify-otp — Verify OTP and complete signup
router.post('/verify-otp', (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const stored = otpStore.get(phone.trim());
        if (!stored) {
            return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
        }

        if (Date.now() > stored.expiresAt) {
            otpStore.delete(phone.trim());
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (stored.otp !== otp.trim()) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // OTP verified — create user
        const passwordHash = hashPassword(stored.password);
        const result = db.prepare(
            'INSERT INTO users (name, username, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)'
        ).run(stored.name, stored.username, passwordHash, phone.trim(), 'user');

        otpStore.delete(phone.trim());

        const user = { id: result.lastInsertRowid, name: stored.name, username: stored.username, phone: phone.trim(), role: 'user' };
        const token = generateToken(user);

        res.json({
            message: 'Account created successfully',
            token,
            user
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        if (err.message?.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Username or phone already exists' });
        }
        res.status(500).json({ error: 'Verification failed' });
    }
});

// GET /api/auth/me — Get current user from token
router.get('/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = db.prepare('SELECT id, name, username, phone, role FROM users WHERE id = ?').get(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: 'Auth check failed' });
    }
});

// ============== USER MANAGEMENT (Admin only) ==============

// GET /api/auth/users — List all users (admin only)
router.get('/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT id, name, username, phone, role, created_at FROM users ORDER BY created_at ASC').all();
        res.json(users);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// PUT /api/auth/users/:id/reset-password — Reset a user's password (admin only)
router.put('/users/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const passwordHash = hashPassword(new_password);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, parseInt(id));

        res.json({ message: `Password reset successfully for @${user.username}` });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// DELETE /api/auth/users/:id — Delete a user (admin only, cannot delete sa)
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(parseInt(id));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.username === 'sa') {
            return res.status(403).json({ error: 'Cannot delete the system admin account' });
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(parseInt(id));
        res.json({ message: `User @${user.username} deleted successfully` });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
