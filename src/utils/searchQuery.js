// Responsable : Assane
// Construit la clause WHERE (recherche + filtres) partagée par la liste et l'export CSV.
// Le frontend envoie : q, sector, sub_sector, region, city, legal_form, estimated_size (ou size),
// status, confidence_level (high|medium|low) ou min_confidence, has_website, has_email, has_phone,
// ids (sélection), page, limit.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['actif', 'inactif', 'a_verifier'];
const SIZE_ALIASES = { micro: 'micro', tpe: 'TPE', pme: 'PME', grande: 'grande', 'grande entreprise': 'grande' };
const CONFIDENCE_LEVELS = { high: [80, 100], medium: [55, 79], low: [0, 54] };

// FROM commun : secteur + sous-secteur + dirigeant principal
export const FROM_SQL = `
  from companies c
  left join sectors s  on s.id = c.sector_id
  left join sectors ps on ps.id = s.parent_id
  left join lateral (
    select p.full_name, p.title
    from company_people cp join people p on p.id = cp.person_id
    where cp.company_id = c.id
    order by cp.is_primary desc, p.full_name
    limit 1
  ) lead on true`;

// Colonnes renvoyées au frontend
export const SELECT_SQL = `
  c.id, c.name, c.legal_name, c.legal_form, c.region, c.city, c.size, c.status,
  c.confidence_score, c.updated_at, c.phone, c.email, c.website,
  coalesce(ps.name, s.name) as sector,
  case when ps.id is not null then s.name end as sub_sector,
  lead.full_name as primary_contact_name,
  lead.title as primary_contact_role`;

export const ORDER_SQL = 'order by c.updated_at desc, c.name asc, c.id asc';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const isTrue = (v) => v === 'true' || v === '1' || v === true;

export function buildSearch(query = {}) {
  const params = [];
  const where = ['c.archived = false'];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  // Recherche globale : entreprise, raison sociale, NINEA, RCCM, ville, secteur, dirigeant
  const q = clean(query.q);
  if (q) {
    const p = add(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(c.name ilike ${p} or c.legal_name ilike ${p} or c.ninea ilike ${p} or c.rccm ilike ${p}
      or c.city ilike ${p} or s.name ilike ${p} or ps.name ilike ${p}
      or exists (select 1 from company_people cp join people pe on pe.id = cp.person_id
                 where cp.company_id = c.id and pe.full_name ilike ${p}))`);
  }

  // Secteur : un parent inclut ses sous-secteurs
  const sector = clean(query.sector);
  if (sector) where.push(`lower(coalesce(ps.name, s.name)) = lower(${add(sector)})`);
  const subSector = clean(query.sub_sector);
  if (subSector) where.push(`(ps.id is not null and lower(s.name) = lower(${add(subSector)}))`);

  for (const col of ['region', 'city', 'legal_form']) {
    const v = clean(query[col]);
    if (v) where.push(`lower(c.${col}) = lower(${add(v)})`);
  }

  const size = clean(query.estimated_size || query.size).toLowerCase();
  if (size) where.push(`lower(c.size) = lower(${add(SIZE_ALIASES[size] || size)})`);

  const status = clean(query.status);
  if (STATUSES.includes(status)) where.push(`c.status = ${add(status)}`);

  // Niveau de confiance (Élevé / Moyen / Faible) ou seuil minimum
  const level = CONFIDENCE_LEVELS[clean(query.confidence_level)];
  if (level) where.push(`c.confidence_score between ${add(level[0])} and ${add(level[1])}`);
  const min = parseInt(query.min_confidence, 10);
  if (!Number.isNaN(min)) where.push(`c.confidence_score >= ${add(min)}`);

  // Disponibilité des contacts
  if (isTrue(query.has_website)) where.push(`coalesce(trim(c.website), '') <> ''`);
  if (isTrue(query.has_email)) where.push(`coalesce(trim(c.email), '') <> ''`);
  if (isTrue(query.has_phone)) where.push(`coalesce(trim(c.phone), '') <> ''`);

  // Lignes cochées dans le tableau (export)
  const ids = clean(query.ids).split(',').map((i) => i.trim()).filter((i) => UUID_RE.test(i));
  if (clean(query.ids)) where.push(`c.id = any(${add(ids)}::uuid[])`);

  // Pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  return { whereSql: `where ${where.join(' and ')}`, params, page, limit, offset: (page - 1) * limit };
}
