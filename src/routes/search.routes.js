// Responsable : Assane
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/companies?q=&sector=&region=&city=&legal_form=&size=&status=
//   &has_website=&has_email=&has_phone=&min_confidence=&page=&limit=
// Réponse attendue : { data: [...], total, page, limit }
router.get('/', verifyToken, async (req, res, next) => {
  try {
    // TODO Assane : construire la requête avec recherche + filtres + pagination
    res.json({ data: [], total: 0, page: 1, limit: 20 });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/export?...mêmes filtres
// Réponse attendue : fichier CSV
router.get('/export', verifyToken, async (req, res, next) => {
  try {
    // TODO Assane : mêmes filtres que ci-dessus, puis Papa.unparse(rows)
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

export default router;
