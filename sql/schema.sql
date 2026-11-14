-- Elikia Database : schéma MVP (PostgreSQL)
-- Exécution : psql -d elikia -f backend/sql/schema.sql

create extension if not exists pgcrypto;  -- pour gen_random_uuid()
create extension if not exists pg_trgm;   -- pour la recherche rapide sur le texte

-- Utilisateurs
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  status text not null default 'actif' constraint users_status_check check (status in ('actif', 'suspendu')),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Secteurs et sous-secteurs
create table sectors (
  id serial primary key,
  name text not null,
  parent_id int references sectors(id) on delete set null
);

-- Entreprises
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  legal_form text,
  ninea text unique,
  rccm text,
  created_on date,
  sector_id int references sectors(id),
  description text,
  business_type text check (business_type in ('B2B', 'B2C', 'B2G')),
  region text,
  city text,
  address text,
  employee_range text,
  revenue_range text,
  size text check (size in ('micro', 'TPE', 'PME', 'grande')),
  phone text,
  email text,
  website text,
  linkedin_url text,
  facebook_url text,
  status text not null default 'a_verifier' check (status in ('actif', 'inactif', 'a_verifier')),
  source text,
  verified_at date,
  confidence_score int check (confidence_score between 0 and 100),
  internal_notes text,
  creation_year integer,
  sub_sector text,
  size_category text,
  primary_contact_name text,
  primary_contact_role text,
  primary_contact_email text,
  notes text,
  is_legal_verified boolean default false,
  is_contacts_verified boolean default false,
  is_size_verified boolean default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);

-- Personnes (dirigeants, fondateurs)
create table people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text
);

-- Lien entreprises / personnes
create table company_people (
  company_id uuid references companies(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  role text,
  is_primary boolean not null default false,
  primary key (company_id, person_id)
);

-- Listes / favoris (P1)
create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table list_companies (
  list_id uuid references lists(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, company_id)
);

-- Historique des exports Excel (indicateur « Exports réalisés »)
create table list_exports (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  list_id uuid references lists(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Coordonnées du site modifiables par l'admin (contact_email, contact_phone, liens réseaux sociaux)
create table site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- Messagerie : une discussion = un utilisateur + l'équipe des administrateurs
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_read_at timestamptz not null default now(),
  admin_read_at timestamptz not null default 'epoch'
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  sender_role text not null check (sender_role in ('ADMIN', 'USER')),
  body text not null,
  created_at timestamptz not null default now()
);

create index conversations_user_idx on conversations (user_id);
create index conversations_updated_idx on conversations (updated_at desc);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- Mise à jour automatique de updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_updated_at
before update on companies
for each row execute function set_updated_at();

-- Index pour la recherche et les filtres
create index companies_name_trgm on companies using gin (name gin_trgm_ops);
create index companies_legal_name_trgm on companies using gin (legal_name gin_trgm_ops);
create index people_full_name_trgm on people using gin (full_name gin_trgm_ops);
create index companies_sector_idx on companies (sector_id);
create index companies_region_idx on companies (region);
create index companies_city_idx on companies (city);
create index companies_status_idx on companies (status);
create index companies_legal_name_lower_idx on companies (lower(legal_name));  -- détection des doublons
