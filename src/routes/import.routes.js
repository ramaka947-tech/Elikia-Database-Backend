// Responsable : Sophiatou
import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';
import { normalize, cleanNinea, validateRow } from '../utils/csvValidator.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const MAX_ROWS = 2000;

// Colonnes de la table companies remplies par l'import (updated_by est ajouté à part)
const COMPANY_COLUMNS = [
  'name', 'legal_name', 'legal_form', 'ninea', 'rccm', 'sector_id', 'description',
  'business_type', 'region', 'city', 'address', 'employee_range', 'revenue_range',
  'phone', 'email', 'website', 'linkedin_url', 'status', 'source', 'verified_at',
  'confidence_score',
];

// Multer renvoie ses erreurs (fichier trop gros...) : on les transforme en réponse 400 claire
function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (5 Mo maximum)' : 'Fichier invalide';
    res.status(400).json({ message });
  });
}

// Lit les secteurs une fois pour toutes : nom -> id
async function loadSectors(db) {
  const { rows } = await db.query('select id, name, parent_id from sectors');
  const parents = new Map();
  const children = new Map();
  for (const s of rows) {
    if (s.parent_id === null) parents.set(normalize(s.name), s.id);
    else children.set(`${s.parent_id}|${normalize(s.name)}`, s.id);
  }
  return { parents, children };
}

// NINEA et raisons sociales déjà présents en base (archivés compris)
async function loadExisting(db) {
  const { rows } = await db.query('select ninea, legal_name, name from companies');
  const nineas = new Set();
  const raisons = new Set();
  for (const c of rows) {
    if (c.ninea) nineas.add(cleanNinea(c.ninea));
    raisons.add(normalize(c.legal_name || c.name));
  }
  return { nineas, raisons };
}

// Insère une entreprise (+ son contact principal). Renvoie false si le NINEA existait déjà.
async function insertCompany(db, d, userId) {
  const columns = [...COMPANY_COLUMNS, 'updated_by'];
  const values = [...COMPANY_COLUMNS.map((c) => d[c]), userId];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await db.query(
    `insert into companies (${columns.join(', ')}) values (${placeholders})
     on conflict (ninea) do nothing
     returning id`,
    values
  );
  const companyId = rows[0]?.id;
  if (!companyId) return false;

  if (d.contact_name) {
    const person = await db.query(
      'insert into people (full_name, title) values ($1, $2) returning id',
      [d.contact_name, d.contact_role]
    );
    await db.query(
      'insert into company_people (company_id, person_id, role, is_primary) values ($1, $2, $3, true)',
      [companyId, person.rows[0].id, d.contact_role]
    );
  }
  return true;
}

// POST /api/import  (champ du fichier : "file")
// Réponse : { imported, duplicates, errors: [{ line, message }] }
router.post('/', verifyToken, requireAdmin, receiveFile, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu (champ « file » attendu)' });

    // 1. Lire le fichier. UTF-8 d'abord ; si des caractères sont cassés (Excel en ANSI), on relit en latin1.
    let text = req.file.buffer.toString('utf8');
    if (text.includes('\uFFFD')) text = req.file.buffer.toString('latin1');
    text = text.replace(/^\uFEFF/, '');

    // 2. Transformer le texte en lignes (le séparateur , ou ; est détecté tout seul)
    const parsed = Papa.parse(text, {
      header: true,
      delimitersToGuess: [',', ';', '\t'],
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (!parsed.meta.fields?.includes('name')) {
      return res.status(400).json({ message: 'Colonne « name » introuvable : utilisez le modèle modele_import.csv' });
    }

    // Lignes dont le nombre de colonnes est faux (repérées par Papaparse)
    const badShape = new Set(
      parsed.errors
        .filter((e) => e.row !== undefined && (e.code === 'TooFewFields' || e.code === 'TooManyFields'))
        .map((e) => e.row + 2)
    );

    // Numéro de ligne = position dans le fichier (ligne 1 = en-têtes). Les lignes vides sont ignorées.
    const rows = parsed.data
      .map((raw, i) => ({ raw, line: i + 2 }))
      .filter(({ raw }) => Object.values(raw).some((v) => String(v ?? '').trim() !== ''));

    if (rows.length === 0) return res.status(400).json({ message: 'Le fichier ne contient aucune ligne de données' });
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ message: `Trop de lignes (${rows.length}). Maximum : ${MAX_ROWS} par fichier` });
    }

    // 3. Valider et insérer, dans une seule transaction
    const client = await pool.connect();
    const errors = [];
    let imported = 0;
    let duplicates = 0;
    try {
      await client.query('begin');
      const sectors = await loadSectors(client);
      const seen = await loadExisting(client);

      for (const { raw, line } of rows) {
        if (badShape.has(line)) {
          errors.push({ line, message: 'Nombre de colonnes incorrect' });
          continue;
        }
        const { problems, data } = validateRow(raw, sectors);
        if (problems.length > 0) {
          errors.push({ line, message: problems.join(' ; ') });
          continue;
        }

        const raison = normalize(data.legal_name || data.name);
        const isDuplicate = (data.ninea && seen.nineas.has(data.ninea)) || seen.raisons.has(raison);
        if (isDuplicate || !(await insertCompany(client, data, req.user.id))) {
          duplicates++;
          continue;
        }

        // On mémorise la ligne pour détecter aussi les doublons à l'intérieur du fichier
        if (data.ninea) seen.nineas.add(data.ninea);
        seen.raisons.add(raison);
        imported++;
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    res.json({ imported, duplicates, errors });
  } catch (err) {
    next(err);
  }
});

export default router;