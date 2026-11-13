// Responsable : Rama
// Coordonnées du site (pied de page de l'accueil) et chiffres publics de l'accueil.
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Champs modifiables par l'admin (Mon compte > Coordonnées)
const KEYS = ['contact_email', 'contact_phone', 'linkedin_url', 'facebook_url', 'instagram_url'];
const URL_KEYS = ['linkedin_url', 'facebook_url', 'instagram_url'];

async function readSettings() {
  const { rows } = await pool.query('select key, value from site_settings where key = any($1)', [KEYS]);
  const settings = Object.fromEntries(KEYS.map((k) => [k, '']));
  rows.forEach((r) => { settings[r.key] = r.value; });
  return settings;
}

// GET /api/settings  (public) -> coordonnées + vrais chiffres de la base pour l'accueil
router.get('/', async (req, res, next) => {
  try {
    const settings = await readSettings();
    const { rows } = await pool.query(`
      select
        (select count(*)::int from companies where archived = false) as companies,
        (select count(*)::int from sectors where parent_id is null) as sectors
    `);
    res.json({ ...settings, stats: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings  (ADMIN)  { contact_email, contact_phone, linkedin_url, facebook_url, instagram_url }
// Un champ vide n'est pas affiché sur le site.
router.put('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const values = {};
    for (const key of KEYS) values[key] = String(req.body[key] ?? '').trim();

    if (values.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact_email)) {
      return res.status(400).json({ message: "L'adresse email n'est pas valide" });
    }
    if (values.contact_phone && !/^\+?[0-9 ().-]{6,20}$/.test(values.contact_phone)) {
      return res.status(400).json({ message: "Le numéro de téléphone n'est pas valide" });
    }
    for (const key of URL_KEYS) {
      if (values[key] && !/^https:\/\/\S+$/.test(values[key])) {
        return res.status(400).json({ message: 'Les liens des réseaux sociaux doivent commencer par https://' });
      }
    }

    for (const key of KEYS) {
      await pool.query(
        `insert into site_settings (key, value, updated_at) values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, values[key]]
      );
    }
    res.json(await readSettings());
  } catch (err) {
    next(err);
  }
});

export default router;
