// Responsable : Assane
import { Router } from 'express';
import Papa from 'papaparse';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';
import { buildSearch, FROM_SQL, SELECT_SQL, ORDER_SQL } from '../utils/searchQuery.js';

const router = Router();

// GET /api/companies?q=&sector=&sub_sector=&region=&city=&legal_form=&estimated_size=&status=
//   &confidence_level=&has_website=&has_email=&has_phone=&page=&limit=
// Réponse : { data: [...], total, page, limit }
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { whereSql, params, page, limit, offset } = buildSearch(req.query);

    const [list, count] = await Promise.all([
      pool.query(
        `select ${SELECT_SQL} ${FROM_SQL} ${whereSql} ${ORDER_SQL} limit ${limit} offset ${offset}`,
        params
      ),
      pool.query(`select count(*)::int as total ${FROM_SQL} ${whereSql}`, params),
    ]);

    res.json({ data: list.rows, total: count.rows[0].total, page, limit });
  } catch (err) {
    next(err);
  }
});

// Neutralise les formules Excel (=, +, -, @) dans les cellules exportées
const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

// GET /api/companies/export?...mêmes filtres (+ ids=uuid,uuid)
// Réponse : fichier CSV (tous les résultats filtrés, sans pagination, 10 000 lignes max)
router.get('/export', verifyToken, async (req, res, next) => {
  try {
    const { whereSql, params } = buildSearch(req.query);
    const { rows } = await pool.query(
      `select ${SELECT_SQL} ${FROM_SQL} ${whereSql} ${ORDER_SQL} limit 10000`,
      params
    );

    const csv = Papa.unparse(
      rows.map((r) => ({
        Entreprise: safe(r.name),
        'Raison sociale': safe(r.legal_name),
        'Forme juridique': r.legal_form,
        Secteur: r.sector,
        'Sous-secteur': r.sub_sector,
        Région: r.region,
        Ville: r.city,
        Dirigeant: safe(r.primary_contact_name),
        'Fonction du dirigeant': r.primary_contact_role,
        Taille: r.size,
        Téléphone: safe(r.phone),
        Email: safe(r.email),
        'Site web': safe(r.website),
        Statut: r.status,
        'Confiance (%)': r.confidence_score,
        'Mise à jour': r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '',
      })),
      { delimiter: ';' }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="elikia-entreprises-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM : accents corrects dans Excel
  } catch (err) {
    next(err);
  }
});

export default router;
