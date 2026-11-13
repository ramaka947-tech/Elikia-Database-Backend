// Responsable : Sophiatou
import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/import  (champ du fichier : "file")
// Réponse attendue : { imported, duplicates, errors: [{ line, message }] }
router.post('/', verifyToken, requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    // TODO Sophiatou : lire req.file.buffer avec Papa.parse, valider chaque ligne,
    // détecter les doublons (ninea ou raison sociale), insérer les lignes valides
    res.status(501).json({ message: 'À implémenter' });
  } catch (err) {
    next(err);
  }
});

export default router;
