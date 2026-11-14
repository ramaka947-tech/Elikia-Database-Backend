// Modèles des emails envoyés par la plateforme (fichier partagé, géré par Rama)
// Couleurs Elikia : bleu nuit #131b2b, vert émeraude #10a074, doré #d9a531

const siteUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

// Évite qu'un nom saisi par quelqu'un puisse injecter du HTML dans l'email
const escape = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ title, paragraphs, buttonLabel, buttonUrl }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">${p}</p>`).join('');
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#faf8f4;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e0">
    <tr><td style="background:#131b2b;padding:24px 32px">
      <span style="font-size:20px;font-weight:bold;color:#ffffff">Elikia <span style="color:#d9a531">Database</span></span><br>
      <span style="font-size:12px;color:rgba(255,255,255,0.6)">Les entreprises du Sénégal</span>
    </td></tr>
    <tr><td style="padding:32px">
      <h1 style="margin:0 0 20px;font-size:22px;color:#131b2b">${title}</h1>
      ${body}
      <a href="${buttonUrl}" style="display:inline-block;margin-top:8px;padding:12px 24px;border-radius:999px;background:#10a074;color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none">${buttonLabel}</a>
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid #e7e5e0;font-size:12px;color:#94a3b8">
      Vous recevez cet email car un compte a été créé avec cette adresse sur Elikia Database.
      Si ce n'est pas vous, ignorez simplement ce message.
    </td></tr>
  </table>
</body>
</html>`;
}

// Inscription d'un utilisateur (client)
export function welcomeEmail(user) {
  const url = `${siteUrl()}/login`;
  const name = escape(user.name);
  return {
    to: user.email,
    toName: user.name,
    subject: 'Bienvenue sur Elikia Database',
    html: layout({
      title: `Bienvenue, ${name} !`,
      paragraphs: [
        'Votre compte Elikia Database est prêt.',
        "Vous pouvez dès maintenant rechercher les entreprises du Sénégal, consulter leurs fiches, les regrouper dans vos listes et les exporter.",
        `Pour vous connecter, utilisez votre adresse <strong>${escape(user.email)}</strong> et le mot de passe choisi à l'inscription.`,
      ],
      buttonLabel: 'Se connecter',
      buttonUrl: url,
    }),
    text: `Bienvenue ${user.name} ! Votre compte Elikia Database est prêt. Connectez-vous ici : ${url}`,
  };
}

// Création d'un compte administrateur (Mon compte > Accès). Le mot de passe n'est jamais envoyé.
export function adminCreatedEmail(user, createdByName) {
  const url = `${siteUrl()}/admin/login`;
  const by = createdByName ? ` par <strong>${escape(createdByName)}</strong>` : '';
  return {
    to: user.email,
    toName: user.name,
    subject: 'Votre compte administrateur Elikia Database',
    html: layout({
      title: `Bonjour ${escape(user.name)},`,
      paragraphs: [
        `Un compte <strong>administrateur</strong> a été créé pour vous${by} sur Elikia Database.`,
        `Votre identifiant est <strong>${escape(user.email)}</strong>. Le mot de passe vous sera communiqué par la personne qui a créé votre compte. Pensez à le changer dès votre première connexion (Mon compte > Sécurité).`,
      ],
      buttonLabel: "Accéder à l'espace administrateur",
      buttonUrl: url,
    }),
    text: `Bonjour ${user.name}, un compte administrateur Elikia Database a été créé pour vous. Identifiant : ${user.email}. Le mot de passe vous sera communiqué par la personne qui a créé votre compte. Connexion : ${url}`,
  };
}
