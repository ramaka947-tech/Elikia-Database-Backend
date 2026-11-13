// Responsable : Abdoulaye
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/sectors  -> liste des secteurs et sous-secteurs
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from sectors order by name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
