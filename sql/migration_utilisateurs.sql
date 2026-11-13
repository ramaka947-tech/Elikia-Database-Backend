-- Migration de la page « Utilisateurs » (à exécuter UNE SEULE FOIS sur la base existante)
-- Usage : npm run migrate-utilisateurs
-- Sans danger si relancée : chaque instruction vérifie si la modification existe déjà.

-- Statut du compte : 'actif' ou 'suspendu' (un compte suspendu ne peut plus se connecter)
alter table users add column if not exists status text not null default 'actif';
alter table users drop constraint if exists users_status_check;
alter table users add constraint users_status_check check (status in ('actif', 'suspendu'));

-- Date de la dernière connexion (mise à jour à chaque connexion réussie)
alter table users add column if not exists last_login_at timestamptz;
