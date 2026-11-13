-- Migration du module « Mes listes » (à exécuter UNE SEULE FOIS sur la base existante)
-- Usage : npm run migrate-listes
-- Sans danger si relancée : chaque instruction vérifie si la modification existe déjà.

alter table lists add column if not exists description text;
alter table lists add column if not exists created_at timestamptz not null default now();
alter table lists add column if not exists updated_at timestamptz not null default now();

alter table list_companies add column if not exists added_at timestamptz not null default now();

-- Historique des exports Excel (sert à l'indicateur « Exports réalisés »)
create table if not exists list_exports (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  list_id uuid references lists(id) on delete set null,  -- null = export de toutes les listes
  created_at timestamptz not null default now()
);

create index if not exists lists_user_idx on lists (user_id);
create index if not exists list_exports_user_idx on list_exports (user_id);
