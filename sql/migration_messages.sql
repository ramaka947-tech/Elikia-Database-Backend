-- Migration de la messagerie (à exécuter UNE SEULE FOIS sur la base existante)
-- Usage : npm run migrate   (ou npm run migrate-messages)
-- Sans danger si relancée.

-- Une discussion = un utilisateur (client) + l'équipe des administrateurs
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),        -- date du dernier message
  user_read_at timestamptz not null default now(),       -- dernière lecture par le client
  admin_read_at timestamptz not null default 'epoch'     -- dernière lecture par un administrateur
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  sender_role text not null check (sender_role in ('ADMIN', 'USER')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_idx on conversations (user_id);
create index if not exists conversations_updated_idx on conversations (updated_at desc);
create index if not exists messages_conversation_idx on messages (conversation_id, created_at);
