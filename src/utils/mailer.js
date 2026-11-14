// Envoi d'emails via l'API Brevo (fichier partagé, géré par Rama)
// Variables du .env : BREVO_API_KEY, MAIL_FROM (adresse vérifiée dans Brevo), MAIL_FROM_NAME
// Si la clé n'est pas configurée, rien n'est envoyé (un message s'affiche dans la console) :
// la création de compte n'est jamais bloquée par un email.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendMail({ to, toName, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.info(`[email] non envoyé (BREVO_API_KEY ou MAIL_FROM manquant) : « ${subject} » à ${to}`);
    return false;
  }

  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: process.env.MAIL_FROM_NAME || 'Elikia Database' },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error(`[email] échec ${res.status} pour ${to} :`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] erreur pour ${to} :`, err.message);
    return false;
  }
}

// Envoi « en arrière-plan » : la réponse au navigateur n'attend pas l'email
export function sendMailInBackground(message) {
  sendMail(message).catch(() => {});
}
