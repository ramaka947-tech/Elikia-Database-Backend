// Responsable : Abdoulaye
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// GET /api/companies/:id  -> fiche complète (avec secteur et dirigeants)
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies  -> créer (ADMIN)
router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/companies/:id  -> modifier (ADMIN). Penser à updated_by = req.user.id
router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:id/archive  -> archiver (ADMIN)
router.patch('/:id/archive', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:id  -> supprimer (ADMIN)
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

export default router;
