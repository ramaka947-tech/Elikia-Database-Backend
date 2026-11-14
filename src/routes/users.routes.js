// Responsable : Rama
// Gestion des comptes (ADMIN uniquement)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';
import { sendMailInBackground } from '../utils/mailer.js';
import { adminCreatedEmail } from '../utils/emailTemplates.js';

const router = Router();
router.use(verifyToken, requireAdmin);

const FIELDS = 'id, name, email, role, status, last_login_at, created_at';
const ROLES = ['ADMIN', 'USER']; // utilisé pour le filtre ?role=
const STATUSES = ['actif', 'suspendu'];

// Nombre d'administrateurs actifs (on ne peut jamais tomber à zéro)
async function activeAdmins() {
  const { rows } = await pool.query("select count(*)::int as n from users where role = 'ADMIN' and status = 'actif'");
  return rows[0].n;
}

// GET /api/users            -> tous les comptes, les plus récents d'abord
// GET /api/users?role=ADMIN -> seulement les administrateurs
router.get('/', async (req, res, next) => {
  try {
    const role = ROLES.includes(req.query.role) ? req.query.role : null;
    const { rows } = await pool.query(
      `select ${FIELDS} from users where ($1::text is null or role = $1) order by created_at desc`,
      [role]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/admins  { name, email, password }  -> créer un compte administrateur
// (seul endroit où l'on crée un admin : Mon compte > Accès)
router.post('/admins', async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) return res.status(400).json({ message: 'Nom, email et mot de passe requis' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Email invalide' });
    if (password.length < 8) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });

    const exists = await pool.query('select 1 from users where email = $1', [email]);
    if (exists.rowCount > 0) return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role) values ($1, $2, $3, 'ADMIN') returning ${FIELDS}`,
      [name, email, hash]
    );

    // Email au nouvel administrateur (sans le mot de passe)
    const creator = await pool.query('select name from users where id = $1', [req.user.id]);
    sendMailInBackground(adminCreatedEmail(rows[0], creator.rows[0]?.name));

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/status  { status: 'actif' | 'suspendu' }  -> suspendre ou réactiver un compte
// Interdit : changer son propre statut, ou suspendre le dernier administrateur actif.
// (On ne modifie ni le nom ni le rôle d'un autre compte depuis l'administration.)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Statut invalide' });
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas changer le statut de votre propre compte' });
    }

    const { rows } = await pool.query('select role, status from users where id = $1', [req.params.id]);
    const target = rows[0];
    if (!target) return res.status(404).json({ message: 'Compte introuvable' });

    if (status === 'suspendu' && target.role === 'ADMIN' && target.status === 'actif' && (await activeAdmins()) <= 1) {
      return res.status(400).json({ message: 'Impossible : il doit rester au moins un administrateur actif' });
    }

    const updated = await pool.query(`update users set status = $1 where id = $2 returning ${FIELDS}`, [status, req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ message: 'Compte introuvable' });
    next(err);
  }
});

// DELETE /api/users/:id  -> supprimer un compte
// Interdit : se supprimer soi-même, ou supprimer le dernier administrateur actif
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    const { rows } = await pool.query('select role, status from users where id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Compte introuvable' });

    if (rows[0].role === 'ADMIN' && rows[0].status === 'actif' && (await activeAdmins()) <= 1) {
      return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
    }

    await pool.query('delete from users where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ message: 'Compte introuvable' });
    next(err);
  }
});

export default router;
