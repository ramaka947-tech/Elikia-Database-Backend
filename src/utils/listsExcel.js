// Génération des fichiers Excel des listes (Rama, P1)
import ExcelJS from 'exceljs';
import pool from '../db.js';

// Colonnes exportées : uniquement les informations réellement enregistrées sur l'entreprise
// (les notes internes réservées à l'admin ne sont jamais exportées)
const COLUMNS = [
  { header: 'Nom commercial', key: 'name', width: 30 },
  { header: 'Raison sociale', key: 'legal_name', width: 30 },
  { header: 'Forme juridique', key: 'legal_form', width: 16 },
  { header: 'NINEA', key: 'ninea', width: 16 },
  { header: 'RCCM', key: 'rccm', width: 20 },
  { header: 'Secteur', key: 'sector', width: 24 },
  { header: 'Sous-secteur', key: 'sub_sector', width: 24 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Type', key: 'business_type', width: 8 },
  { header: 'Région', key: 'region', width: 14 },
  { header: 'Ville', key: 'city', width: 14 },
  { header: 'Adresse', key: 'address', width: 30 },
  { header: 'Taille', key: 'size', width: 10 },
  { header: 'Effectif', key: 'employee_range', width: 12 },
  { header: "Chiffre d'affaires", key: 'revenue_range', width: 16 },
  { header: 'Dirigeant principal', key: 'contact_name', width: 24 },
  { header: 'Fonction', key: 'contact_role', width: 18 },
  { header: 'Téléphone', key: 'phone', width: 16 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Site web', key: 'website', width: 28 },
  { header: 'LinkedIn', key: 'linkedin_url', width: 28 },
  { header: 'Statut', key: 'status', width: 12 },
  { header: 'Source', key: 'source', width: 20 },
  { header: 'Vérifiée le', key: 'verified_at', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
  { header: 'Score de confiance', key: 'confidence_score', width: 12 },
  { header: 'Ajoutée à la liste le', key: 'added_at', width: 16, style: { numFmt: 'dd/mm/yyyy' } },
];

const STATUS = { actif: 'Actif', inactif: 'Inactif', a_verifier: 'À vérifier' };

// Entreprises d'une liste, avec le secteur parent et le dirigeant principal
export async function getListCompaniesForExport(listId) {
  const { rows } = await pool.query(
    `select c.*, lc.added_at,
            coalesce(parent.name, s.name) as sector,
            case when parent.id is not null then s.name end as sub_sector,
            p.full_name as contact_name, cp.role as contact_role
     from list_companies lc
     join companies c on c.id = lc.company_id
     left join sectors s on s.id = c.sector_id
     left join sectors parent on parent.id = s.parent_id
     left join company_people cp on cp.company_id = c.id and cp.is_primary
     left join people p on p.id = cp.person_id
     where lc.list_id = $1 and c.archived = false
     order by c.name`,
    [listId]
  );
  return rows.map((r) => ({ ...r, status: STATUS[r.status] || r.status }));
}

// Nom de feuille valide pour Excel : 31 caractères max, sans [ ] : * ? / \, et unique
function sheetName(name, used) {
  let base = (name || 'Liste').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Liste';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 26)} ${i++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// lists : [{ name, companies: [...] }]  ->  classeur avec une feuille par liste
export async function buildWorkbook(lists) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Elikia Database';
  wb.created = new Date();
  const used = new Set();

  for (const list of lists) {
    const ws = wb.addWorksheet(sheetName(list.name, used), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = COLUMNS;
    ws.addRows(list.companies);

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A6B47' } };
    header.alignment = { vertical: 'middle' };
    header.height = 22;
    if (list.companies.length > 0) ws.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };
  }

  if (lists.length === 0) wb.addWorksheet('Aucune liste').addRow(['Vous n\'avez encore aucune liste.']);
  return wb;
}

// Nom de fichier sans accents ni caractères spéciaux
export function fileName(name) {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `elikia-${slug || 'liste'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
