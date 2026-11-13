-- Migration des coordonnées du site (à exécuter UNE SEULE FOIS sur la base existante)
-- Usage : npm run migrate-parametres
-- Sans danger si relancée.

-- Paramètres du site modifiables par l'admin (Mon compte > Coordonnées) :
-- contact_email, contact_phone, linkedin_url, facebook_url, instagram_url
create table if not exists site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
