// Responsable : Rama
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';
import { sendMailInBackground } from '../utils/mailer.js';
import { welcomeEmail } from '../utils/emailTemplates.js';
import { checkName, checkEmail, checkPassword } from '../utils/validation.js';

const router = Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

// POST /api/auth/register  { name, email, password }
// Crée toujours un compte USER (jamais ADMIN), puis connecte directement l'utilisateur
router.post('/register', async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password || '';

    const problem = checkName(name) || checkEmail(email) || checkPassword(password);
    if (problem) return res.status(400).json({ message: problem });

    const exists = await pool.query('select 1 from users where email = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cette adresse email. Connectez-vous.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, 'USER')
       returning id, name, email, role`,
      [name, email, hash]
    );

    sendMailInBackground(welcomeEmail(rows[0])); // email de bienvenue (n'empêche jamais l'inscription)
    res.status(201).json({ token: makeToken(rows[0]), user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  { email, password, space }
// space = 'admin'  (page /admin/login) : seuls les administrateurs peuvent se connecter
// space = 'client' (page /login)       : seuls les utilisateurs (clients) peuvent se connecter
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "L'email et le mot de passe sont obligatoires." });
    }

    // Messages précis : compte inexistant (ou supprimé) / mot de passe faux
    const { rows } = await pool.query('select * from users where email = $1', [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: "Aucun compte n'est associé à cette adresse email." });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Mot de passe incorrect.' });
    }

    // Chaque espace n'accepte que son type de compte
    const adminSpace = req.body.space === 'admin' || req.body.adminOnly === true;
    if (adminSpace && user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
    }
    if (!adminSpace && user.role === 'ADMIN') {
      return res.status(403).json({ message: "Ce compte est un compte administrateur : connectez-vous depuis l'espace administrateur." });
    }
    if (user.status === 'suspendu') {
      return res.status(403).json({ message: 'Votre compte est suspendu. Contactez un administrateur.' });
    }

    // Date de dernière connexion (affichée sur la page Utilisateurs)
    await pool.query('update users set last_login_at = now() where id = $1', [user.id]);

    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const { rows } = await pool.query('select id, name, email, role, status, created_at from users where id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable' });
    // Un compte suspendu pendant qu'il était connecté est déconnecté au prochain chargement
    if (rows[0].status === 'suspendu') return res.status(403).json({ message: 'Votre compte est suspendu' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me  { name }  -> modifier son nom
router.patch('/me', verifyToken, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const problem = checkName(name);
    if (problem) return res.status(400).json({ message: problem });
    const { rows } = await pool.query(
      'update users set name = $1 where id = $2 returning id, name, email, role, created_at',
      [name, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/password  { currentPassword, newPassword }  -> changer son mot de passe
router.patch('/password', verifyToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Ancien et nouveau mot de passe requis' });
    }
    const problem = checkPassword(newPassword);
    if (problem) return res.status(400).json({ message: problem });
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit être différent de l'actuel." });
    }

    const { rows } = await pool.query('select password_hash from users where id = $1', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('update users set password_hash = $1 where id = $2', [hash, req.user.id]);
    res.json({ message: 'Mot de passe modifié' });
  } catch (err) {
    next(err);
  }
});

export default router;
