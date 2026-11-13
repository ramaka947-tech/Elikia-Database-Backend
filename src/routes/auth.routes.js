// Responsable : Rama
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const { rows } = await pool.query('select * from users where email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query('select id, name, email, role from users where id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
