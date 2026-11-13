// Responsable : Sophiatou
// Validation d'UNE ligne du CSV d'import.
// Ce fichier ne parle pas à la base de données : il reçoit une ligne brute
// et renvoie { problems, data } :
//   - problems : liste des problèmes trouvés (vide = ligne valide)
//   - data     : la ligne nettoyée, prête à être insérée

export const EXPECTED_COLUMNS = [
  'name', 'legal_name', 'ninea', 'rccm', 'legal_form', 'sector', 'sub_sector',
  'description', 'city', 'region', 'address', 'employee_range', 'revenue_range',
  'business_type', 'primary_contact_name', 'primary_contact_role', 'phone', 'email',
  'website', 'linkedin_url', 'status', 'source', 'verified_at', 'confidence_score',
];

const BUSINESS_TYPES = ['B2B', 'B2C', 'B2G'];
const STATUSES = ['actif', 'inactif', 'a_verifier'];

// "  Éducation  et Formation " -> "education et formation"
// Sert à comparer deux textes sans se soucier des accents, majuscules et espaces.
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// "0012345 2G3" -> "00123452G3" (même nettoyage à l'import et pour comparer avec la base)
export function cleanNinea(text) {
  const t = String(text ?? '').replace(/[\s.-]/g, '').toUpperCase();
  return t === '' ? null : t;
}

// Texte vide ou espaces -> null
const clean = (value) => {
  const t = String(value ?? '').trim();
  return t === '' ? null : t;
};

// Accepte 2024-05-31 ou 31/05/2024 ; renvoie "2024-05-31" ou null si la date n'existe pas
function parseDate(text) {
  let y, mo, d;
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) [, y, mo, d] = m;
  else if ((m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, mo, y] = m;
  else return null;

  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  const real = date.getUTCFullYear() === +y && date.getUTCMonth() === +mo - 1 && date.getUTCDate() === +d;
  return real ? date.toISOString().slice(0, 10) : null;
}

// Accepte "https://site.sn" ou "site.sn" (on ajoute alors https://)
function parseUrl(text) {
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    return new URL(withScheme).hostname.includes('.') ? withScheme : null;
  } catch {
    return null;
  }
}

// sectors = { parents: Map(nom normalisé -> id), children: Map("idParent|nom normalisé" -> id) }
export function validateRow(raw, sectors) {
  const problems = [];
  const d = {};
  for (const col of EXPECTED_COLUMNS) d[col] = clean(raw[col]);

  // --- Nom (seul champ obligatoire) ---
  if (!d.name) problems.push('name est obligatoire');
  else if (d.name.length > 200) problems.push('name trop long (200 caractères max)');

  // --- NINEA : lettres et chiffres, 7 à 12 caractères (format souple, à resserrer si besoin) ---
  d.ninea = cleanNinea(d.ninea);
  if (d.ninea && !/^[0-9A-Z]{7,12}$/.test(d.ninea)) problems.push(`ninea invalide : « ${d.ninea} »`);

  // --- Type d'activité ---
  if (d.business_type) {
    d.business_type = d.business_type.toUpperCase();
    if (!BUSINESS_TYPES.includes(d.business_type)) problems.push('business_type doit être B2B, B2C ou B2G');
  }

  // --- Statut (par défaut : à vérifier) ---
  if (d.status) {
    d.status = normalize(d.status).replace(/ /g, '_');
    if (!STATUSES.includes(d.status)) problems.push('status doit être actif, inactif ou a_verifier');
  } else {
    d.status = 'a_verifier';
  }

  // --- Contacts ---
  if (d.email) {
    d.email = d.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) problems.push(`email invalide : « ${d.email} »`);
  }
  if (d.phone) {
    const digits = d.phone.replace(/\D/g, '');
    if (!/^[+\d\s().-]+$/.test(d.phone) || digits.length < 8 || digits.length > 15) {
      problems.push(`phone invalide : « ${d.phone} »`);
    }
  }
  for (const col of ['website', 'linkedin_url']) {
    if (d[col]) {
      const url = parseUrl(d[col]);
      if (url) d[col] = url;
      else problems.push(`${col} invalide : « ${d[col]} »`);
    }
  }

  // --- Date de vérification ---
  if (d.verified_at) {
    const iso = parseDate(d.verified_at);
    if (iso) d.verified_at = iso;
    else problems.push('verified_at invalide (format AAAA-MM-JJ ou JJ/MM/AAAA)');
  }

  // --- Score de confiance : entier de 0 à 100 ---
  if (d.confidence_score) {
    if (/^\d{1,3}$/.test(d.confidence_score) && +d.confidence_score <= 100) {
      d.confidence_score = Number(d.confidence_score);
    } else {
      problems.push('confidence_score doit être un entier entre 0 et 100');
    }
  }

  // --- Secteur : doit exister dans la table sectors ---
  d.sector_id = null;
  if (d.sector) {
    const parentId = sectors.parents.get(normalize(d.sector));
    if (!parentId) {
      problems.push(`secteur inconnu : « ${d.sector} »`);
    } else {
      // Sous-secteur inconnu : on garde le secteur principal (pas d'erreur)
      d.sector_id = (d.sub_sector && sectors.children.get(`${parentId}|${normalize(d.sub_sector)}`)) || parentId;
    }
  } else if (d.sub_sector) {
    problems.push('sub_sector renseigné sans sector');
  }

  // --- Contact principal (créé dans la table people) ---
  d.contact_name = d.primary_contact_name;
  d.contact_role = d.primary_contact_role;

  return { problems, data: d };
}