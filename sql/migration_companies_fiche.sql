-- Migration : champs supplémentaires de la fiche entreprise (demandés pour la fiche + le formulaire)
-- Usage : npm run migrate   (sans danger si relancée)
-- legal_form, linkedin_url et updated_at existaient déjà : « if not exists » les laisse intacts.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS creation_year integer,
  ADD COLUMN IF NOT EXISTS sub_sector text,
  ADD COLUMN IF NOT EXISTS size_category text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_role text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_legal_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_contacts_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_size_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
