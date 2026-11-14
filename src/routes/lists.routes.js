// Responsable : Rama (P1)
// Mes listes : chaque client organise ses entreprises dans ses propres listes.
// Règles : une liste n'est visible que par son propriétaire ; retirer une entreprise
// ou supprimer une liste ne supprime jamais l'entreprise de la base.
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';
import { getListCompaniesForExport, buildWorkbook, fileName } from '../utils/listsExcel.js';

const router = Router();
router.use(verifyToken);

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Vérifie que la liste existe et appartient à l'utilisateur connecté
async function findOwnList(listId, userId) {
  if (!isUuid(listId)) return null;
  const { rows } = await pool.query('select * from lists where id = $1 and user_id = $2', [listId, userId]);
  return rows[0] || null;
}

// Met à jour la date de dernière modification d'une liste
const touch = (listId) => pool.query('update lists set updated_at = now() where id = $1', [listId]);

// Valide nom (obligatoire, 80 max) et description (facultative, 200 max)
function readListBody(body) {
  const name = body.name?.trim();
  const description = body.description?.trim() || null;
  if (!name) return { error: 'Le nom de la liste est obligatoire' };
  if (name.length < 2) return { error: 'Le nom de la liste doit contenir au moins 2 caractères' };
  if (!/\p{L}/u.test(name)) return { error: 'Le nom de la liste doit contenir au moins une lettre' };
  if (name.length > 80) return { error: 'Nom trop long (80 caractères maximum)' };
  if (description && description.length > 200) return { error: 'Description trop longue (200 caractères maximum)' };
  return { name, description };
}

async function sendWorkbook(res, lists, name) {
  const wb = await buildWorkbook(lists);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName(name)}"`);
  await wb.xlsx.write(res);
  res.end();
}

// GET /api/lists  -> mes listes (nom, description, nombre d'entreprises, dates)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select l.id, l.name, l.description, l.created_at, l.updated_at, count(c.id)::int as count
       from lists l
       left join list_companies lc on lc.list_id = l.id
       left join companies c on c.id = lc.company_id and c.archived = false
       where l.user_id = $1
       group by l.id order by l.created_at desc`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/stats  -> indicateurs de la page Mes listes
router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select
         (select count(*)::int from lists where user_id = $1) as lists,
         (select count(distinct lc.company_id)::int from list_companies lc
            join lists l on l.id = lc.list_id where l.user_id = $1) as companies,
         (select count(*)::int from list_exports where user_id = $1) as exports`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/export  -> toutes mes listes dans un classeur Excel (une feuille par liste)
router.get('/export', async (req, res, next) => {
  try {
    const { rows: lists } = await pool.query('select id, name from lists where user_id = $1 order by name', [req.user.id]);
    const data = [];
    for (const l of lists) data.push({ name: l.name, companies: await getListCompaniesForExport(l.id) });
    await pool.query('insert into list_exports (user_id) values ($1)', [req.user.id]);
    await sendWorkbook(res, data, 'mes-listes');
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/company/:companyId  -> ids de mes listes qui contiennent cette entreprise
router.get('/company/:companyId', async (req, res, next) => {
  try {
    if (!isUuid(req.params.companyId)) return res.json([]);
    const { rows } = await pool.query(
      `select lc.list_id from list_companies lc join lists l on l.id = lc.list_id
       where l.user_id = $1 and lc.company_id = $2`,
      [req.user.id, req.params.companyId]
    );
    res.json(rows.map((r) => r.list_id));
  } catch (err) {
    next(err);
  }
});

// POST /api/lists  { name, description }  -> créer une liste (sans entreprises)
router.post('/', async (req, res, next) => {
  try {
    const body = readListBody(req.body);
    if (body.error) return res.status(400).json({ message: body.error });
    const { rows } = await pool.query(
      `insert into lists (user_id, name, description) values ($1, $2, $3)
       returning id, name, description, created_at, updated_at`,
      [req.user.id, body.name, body.description]
    );
    res.status(201).json({ ...rows[0], count: 0 });
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:id  -> une liste et ses entreprises
router.get('/:id', async (req, res, next) => {
  try {
    const list = await findOwnList(req.params.id, req.user.id);
    if (!list) return res.status(404).json({ message: 'Liste introuvable' });

    const { rows } = await pool.query(
      `select c.id, c.name, c.legal_name, c.city, c.region, c.phone, c.email, c.website,
              c.size, c.confidence_score, coalesce(parent.name, s.name) as sector, lc.added_at
       from list_companies lc
       join companies c on c.id = lc.company_id
       left join sectors s on s.id = c.sector_id
       left join sectors parent on parent.id = s.parent_id
       where lc.list_id = $1 and c.archived = false
       order by lc.added_at desc`,
      [list.id]
    );
    res.json({
      id: list.id,
      name: list.name,
      description: list.description,
      created_at: list.created_at,
      updated_at: list.updated_at,
      companies: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:id/export  -> une liste en fichier Excel
router.get('/:id/export', async (req, res, next) => {
  try {
    const list = await findOwnList(req.params.id, req.user.id);
    if (!list) return res.status(404).json({ message: 'Liste introuvable' });
    const companies = await getListCompaniesForExport(list.id);
    await pool.query('insert into list_exports (user_id, list_id) values ($1, $2)', [req.user.id, list.id]);
    await sendWorkbook(res, [{ name: list.name, companies }], list.name);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lists/:id  { name, description }  -> modifier (les entreprises ne changent pas)
router.patch('/:id', async (req, res, next) => {
  try {
    if (!(await findOwnList(req.params.id, req.user.id))) return res.status(404).json({ message: 'Liste introuvable' });
    const body = readListBody(req.body);
    if (body.error) return res.status(400).json({ message: body.error });
    const { rows } = await pool.query(
      `update lists set name = $1, description = $2, updated_at = now() where id = $3
       returning id, name, description, created_at, updated_at`,
      [body.name, body.description, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:id  -> supprimer une liste (les entreprises restent dans la base)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!(await findOwnList(req.params.id, req.user.id))) return res.status(404).json({ message: 'Liste introuvable' });
    await pool.query('delete from lists where id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/:id/companies  { companyIds: [...] }  (ou { companyId })
// -> ajoute une ou plusieurs entreprises, sans doublon. Réponse : { added, alreadyInList }
router.post('/:id/companies', async (req, res, next) => {
  try {
    if (!(await findOwnList(req.params.id, req.user.id))) return res.status(404).json({ message: 'Liste introuvable' });

    const ids = [...new Set(req.body.companyIds || (req.body.companyId ? [req.body.companyId] : []))];
    if (ids.length === 0 || !ids.every(isUuid)) return res.status(400).json({ message: 'Entreprises invalides' });

    const found = await pool.query('select id from companies where id = any($1::uuid[]) and archived = false', [ids]);
    if (found.rowCount !== ids.length) return res.status(404).json({ message: 'Une ou plusieurs entreprises sont introuvables' });

    const { rowCount } = await pool.query(
      `insert into list_companies (list_id, company_id)
       select $1, unnest($2::uuid[]) on conflict do nothing`,
      [req.params.id, ids]
    );
    if (rowCount > 0) await touch(req.params.id);
    res.status(201).json({ added: rowCount, alreadyInList: ids.length - rowCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/:id/companies/remove  { companyIds: [...] }  -> retirer plusieurs entreprises
router.post('/:id/companies/remove', async (req, res, next) => {
  try {
    if (!(await findOwnList(req.params.id, req.user.id))) return res.status(404).json({ message: 'Liste introuvable' });
    const ids = req.body.companyIds || [];
    if (ids.length === 0 || !ids.every(isUuid)) return res.status(400).json({ message: 'Entreprises invalides' });

    const { rowCount } = await pool.query(
      'delete from list_companies where list_id = $1 and company_id = any($2::uuid[])',
      [req.params.id, ids]
    );
    if (rowCount > 0) await touch(req.params.id);
    res.json({ removed: rowCount });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:id/companies/:companyId  -> retirer une entreprise
router.delete('/:id/companies/:companyId', async (req, res, next) => {
  try {
    if (!(await findOwnList(req.params.id, req.user.id))) return res.status(404).json({ message: 'Liste introuvable' });
    if (!isUuid(req.params.companyId)) return res.status(404).json({ message: 'Entreprise introuvable' });
    const { rowCount } = await pool.query('delete from list_companies where list_id = $1 and company_id = $2', [req.params.id, req.params.companyId]);
    if (rowCount > 0) await touch(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
