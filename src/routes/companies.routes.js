// Responsable : Abdoulaye
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Colonnes modifiables envoyées par le formulaire (liste blanche : sert aussi à
// générer les requêtes INSERT / UPDATE sans risque d'injection).
// verified_at et updated_by sont gérés à part.
const FIELDS = [
  'name', 'legal_name', 'legal_form', 'creation_year', 'ninea', 'rccm',
  'sector_id', 'sub_sector', 'business_type', 'description',
  'region', 'city', 'address',
  'employee_range', 'revenue_range', 'size_category',
  'primary_contact_name', 'primary_contact_role', 'primary_contact_email',
  'phone', 'email', 'website', 'linkedin_url',
  'status', 'source', 'confidence_score',
  'is_legal_verified', 'is_contacts_verified', 'is_size_verified',
  'notes',
];

// Colonnes qui existaient déjà dans l'ancien code (repli si la détection échoue)
const BASE_COLUMNS = [
  'name', 'legal_name', 'ninea', 'rccm', 'sector_id', 'city', 'region', 'address',
  'status', 'website', 'email', 'phone', 'confidence_score', 'source',
  'employee_range', 'revenue_range', 'business_type', 'description',
];

// On lit une fois les colonnes réelles de la table : les champs du formulaire
// qui n'existent pas (encore) en base sont ignorés au lieu de faire planter l'API.
// Dès que le responsable de la base ajoute une colonne, redémarrer l'API suffit.
let existingColumns = null;
async function getExistingColumns() {
  if (existingColumns) return existingColumns;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'companies'`
    );
    existingColumns = new Set(rows.map((r) => r.column_name));
    return existingColumns;
  } catch (err) {
    console.error('Lecture des colonnes impossible, utilisation des colonnes de base :', err.message);
    return new Set(BASE_COLUMNS);
  }
}

const pickFields = async (body) => {
  const existing = await getExistingColumns();
  return FIELDS.filter((f) => existing.has(f) && body[f] !== undefined);
};

// Transforme les erreurs PostgreSQL courantes en réponses claires pour le front
function handleDbError(err, res, next) {
  // 23505 : contrainte UNIQUE (doublon)
  if (err.code === '23505') {
    const c = err.constraint || '';
    let error = 'Cette entreprise existe déjà';
    if (c.includes('ninea')) error = 'Ce NINEA existe déjà';
    else if (c.includes('rccm')) error = 'Ce RCCM existe déjà';
    return res.status(409).json({ error });
  }
  // 23503 : clé étrangère (ex. secteur inexistant)
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Référence invalide (secteur introuvable ?)' });
  }
  // 23514 : contrainte CHECK (valeur non autorisée)
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Valeur non autorisée pour un champ (contrainte de la base)' });
  }
  // 23502 : champ obligatoire manquant
  if (err.code === '23502') {
    return res.status(400).json({ error: `Champ obligatoire manquant : ${err.column || 'inconnu'}` });
  }
  return next(err);
}

// GET /api/companies/columns  -> champs du formulaire réellement présents en base
// (le formulaire masque ceux qui ne sont pas encore enregistrables)
// IMPORTANT : à garder avant "/:id", sinon "columns" serait pris pour un id.
router.get('/columns', verifyToken, async (req, res, next) => {
  try {
    const existing = await getExistingColumns();
    res.json(FIELDS.filter((f) => existing.has(f)));
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/check?ninea=...&legal_name=...&exclude=ID  -> détection de doublon
router.get('/check', verifyToken, async (req, res, next) => {
  const { ninea, legal_name, exclude } = req.query;
  const conditions = [];
  const values = [];

  if (ninea) {
    values.push(String(ninea).trim());
    conditions.push(`ninea = $${values.length}`);
  }
  if (legal_name) {
    values.push(String(legal_name).trim());
    conditions.push(`LOWER(legal_name) = LOWER($${values.length})`);
  }
  if (conditions.length === 0) return res.json({ duplicate: null });

  let sql = `SELECT id, name FROM companies WHERE (${conditions.join(' OR ')})`;
  if (exclude) {
    values.push(exclude);
    sql += ` AND id <> $${values.length}`;
  }

  try {
    const { rows } = await pool.query(`${sql} LIMIT 1`, values);
    res.json({ duplicate: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:id  -> fiche complète (avec secteur et dirigeants)
router.get('/:id', verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const companyResult = await pool.query(
      `SELECT c.*, s.name AS sector_name
       FROM companies c
       LEFT JOIN sectors s ON c.sector_id = s.id
       WHERE c.id = $1`,
      [id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    const company = companyResult.rows[0];

    const peopleResult = await pool.query(
      `SELECT p.*, cp.role, cp.is_primary
       FROM people p
       JOIN company_people cp ON p.id = cp.person_id
       WHERE cp.company_id = $1`,
      [id]
    );

    company.people = peopleResult.rows;
    res.json(company);
  } catch (err) {
    next(err);
  }
});

// POST /api/companies  -> créer (ADMIN)
router.post('/', verifyToken, requireAdmin, async (req, res, next) => {
  const data = {
    status: 'actif',
    source: 'Saisie manuelle',
    confidence_score: 3,
    ...req.body,
  };

  if (!data.name) {
    return res.status(400).json({ error: 'Le nom commercial est obligatoire' });
  }

  try {
    const cols = await pickFields(data);
    const values = cols.map((f) => data[f]);
    values.push(data.verified_at ?? null); // NOW() si non fourni

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO companies (${cols.join(', ')}, verified_at)
       VALUES (${placeholders}, COALESCE($${cols.length + 1}, NOW()))
       RETURNING *`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleDbError(err, res, next);
  }
});

// PUT /api/companies/:id  -> modifier (ADMIN), enregistre updated_by
router.put('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const updatedBy = req.user ? req.user.id : null;

  try {
    const cols = await pickFields(req.body);
    const values = cols.map((f) => req.body[f]);
    const sets = cols.map((f, i) => `${f} = $${i + 1}`);

    values.push(req.body.verified_at ?? null, updatedBy, id);
    const n = cols.length;

    const result = await pool.query(
      `UPDATE companies SET
         ${sets.join(', ')},
         verified_at = COALESCE($${n + 1}, NOW()),
         updated_by = $${n + 2}
       WHERE id = $${n + 3}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleDbError(err, res, next);
  }
});

// PATCH /api/companies/:id/archive  -> archiver (ADMIN)
router.patch('/:id/archive', verifyToken, requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const updatedBy = req.user ? req.user.id : null;

  try {
    const result = await pool.query(
      `UPDATE companies SET status = 'inactif', verified_at = NOW(), updated_by = $1 WHERE id = $2 RETURNING *`,
      [updatedBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    res.json({ message: 'Entreprise archivée avec succès', company: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:id  -> supprimer (ADMIN)
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM company_people WHERE company_id = $1', [id]);

    const result = await pool.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    res.json({ message: 'Entreprise supprimée avec succès' });
  } catch (err) {
    next(err);
  }
});

export default router;
