// Responsable : Sophiatou
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/stats
// Réponse attendue : { total, topSectors: [{ name, count }], topCities: [{ name, count }], updatedLast30Days }
router.get('/', verifyToken, async (req, res, next) => {
  try {
    res.json({ total: 0, topSectors: [], topCities: [], updatedLast30Days: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
