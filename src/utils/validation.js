// Règles de validation communes (fichier partagé, géré par Rama)
// Les mêmes règles existent côté frontend (src/utils/validation.js) : garder les deux identiques.
// Chaque fonction renvoie un message d'erreur, ou null si la valeur est correcte.

export const LIMITS = { name: 60, email: 100, passwordMin: 8, passwordMax: 64 };

// Nom de personne : lettres (accents compris), espaces, tirets et apostrophes. 2 à 60 caractères.
export function checkName(value, label = 'Le nom') {
  const v = String(value ?? '').trim();
  if (!v) return `${label} est obligatoire.`;
  if (v.length < 2) return `${label} doit contenir au moins 2 lettres.`;
  if (v.length > LIMITS.name) return `${label} ne doit pas dépasser ${LIMITS.name} caractères.`;
  if (!/^[\p{L}]+([ '’-][\p{L}]+)*$/u.test(v)) {
    return `${label} ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.`;
  }
  return null;
}

export function checkEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return "L'adresse email est obligatoire.";
  if (v.length > LIMITS.email) return `L'adresse email ne doit pas dépasser ${LIMITS.email} caractères.`;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return "L'adresse email n'est pas valide (exemple : nom@domaine.sn).";
  return null;
}

// Mot de passe : 8 à 64 caractères, avec une majuscule, une minuscule et un chiffre
export function checkPassword(value) {
  const v = String(value ?? '');
  if (!v) return 'Le mot de passe est obligatoire.';
  if (v.length < LIMITS.passwordMin) return `Le mot de passe doit contenir au moins ${LIMITS.passwordMin} caractères.`;
  if (v.length > LIMITS.passwordMax) return `Le mot de passe ne doit pas dépasser ${LIMITS.passwordMax} caractères.`;
  if (!/[A-Z]/.test(v)) return 'Le mot de passe doit contenir au moins une majuscule.';
  if (!/[a-z]/.test(v)) return 'Le mot de passe doit contenir au moins une minuscule.';
  if (!/[0-9]/.test(v)) return 'Le mot de passe doit contenir au moins un chiffre.';
  return null;
}

// Numéro sénégalais : 9 chiffres commençant par 70, 75, 76, 77, 78 (mobile) ou 30, 33 (fixe).
// Accepte « +221 77 123 45 67 », « 00221771234567 » ou « 771234567 ». Renvoie aussi la forme normalisée.
export function normalizeSenegalPhone(value) {
  let digits = String(value ?? '').replace(/[\s.-]/g, '');
  if (digits.startsWith('+221')) digits = digits.slice(4);
  else if (digits.startsWith('00221')) digits = digits.slice(5);
  return digits;
}

export function checkSenegalPhone(value) {
  const digits = normalizeSenegalPhone(value);
  if (!/^\d+$/.test(digits)) return 'Le numéro ne doit contenir que des chiffres.';
  if (digits.length !== 9) return 'Le numéro doit contenir exactement 9 chiffres (sans le +221).';
  if (!/^(70|75|76|77|78|30|33)/.test(digits)) return 'Le numéro doit commencer par 70, 75, 76, 77, 78, 30 ou 33.';
  return null;
}

// Affichage : +221 77 123 45 67
export function formatSenegalPhone(digits) {
  const d = normalizeSenegalPhone(digits);
  return `+221 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`.trim();
}

const SOCIAL_DOMAINS = { linkedin_url: 'linkedin.com', facebook_url: 'facebook.com', instagram_url: 'instagram.com' };

export function checkSocialUrl(key, value) {
  const v = String(value ?? '').trim();
  if (!v) return null; // champ facultatif
  const domain = SOCIAL_DOMAINS[key];
  let url;
  try { url = new URL(v); } catch { return `Le lien ${domain} n'est pas valide.`; }
  if (url.protocol !== 'https:') return `Le lien doit commencer par https://`;
  if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return `Le lien doit être une adresse ${domain}.`;
  return null;
}
