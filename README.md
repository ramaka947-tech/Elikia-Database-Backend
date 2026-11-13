# Elikia Database : Backend (API)

API de la plateforme Elikia Database : recherche et consultation des entreprises et entrepreneurs du Sénégal.

Le frontend est dans un dépôt séparé : **elikia-frontend**.

Livraison : **lundi**.

---

## Équipe et répartition

Chaque membre développe **sa fonctionnalité de bout en bout** : sa route dans ce dépôt, et sa page dans le dépôt frontend.

| Membre | Fonctionnalité | Fichiers dans ce dépôt |
|---|---|---|
| **Rama KA** (lead) | Socle technique | `server.js`, `db.js`, `middlewares/auth.js`, `routes/auth.routes.js`, `sql/schema.sql`, `scripts/create-admin.js`, déploiement |
| **Assane Ndongue** | Répertoire | `routes/search.routes.js` : recherche globale, filtres combinables, pagination, export CSV |
| **Abdoulaye BA** | Fiche + administration | `routes/companies.routes.js`, `routes/sectors.routes.js` : détail, création, modification, archivage, suppression |
| **Sophiatou Ndiaye** | Import + dashboard | `routes/import.routes.js`, `routes/stats.routes.js`, `sql/seed_sectors.sql`, `sql/modele_import.csv`, données de démo |

**Règle :** chacun ne modifie que ses propres fichiers. Si tu veux séparer ta logique, crée tes fichiers dans `src/utils/` avec un nom clair (ex : `searchQuery.js`, `csvValidator.js`).

**Fichiers partagés (ne pas modifier sans prévenir Rama) :** `server.js`, `db.js`, `middlewares/`, `sql/schema.sql`, `package.json`.

Toutes les routes sont déjà branchées dans `server.js`. Chacun n'a qu'à remplir son fichier.

---

## Technologies

| Besoin | Outil |
|---|---|
| Serveur | Node.js, Express |
| Base de données | PostgreSQL hébergé sur Neon (driver `pg`, requêtes SQL) |
| Authentification | JWT (`jsonwebtoken`) + mots de passe hachés (`bcryptjs`) |
| Upload / CSV | `multer`, `papaparse` |
| Hébergement | Render |

---

## Organisation du code

```
src/
  server.js                       Rama (partagé)
  db.js                           Rama (partagé)
  middlewares/auth.js             Rama (partagé)
  routes/auth.routes.js           Rama
  routes/users.routes.js          Rama
  routes/lists.routes.js          Rama (P1)
  routes/search.routes.js         Assane
  routes/companies.routes.js      Abdoulaye
  routes/sectors.routes.js        Abdoulaye
  routes/import.routes.js         Sophiatou
  routes/stats.routes.js          Sophiatou
  utils/                          fichiers d'aide de chacun
sql/
  schema.sql                      Rama (partagé)
  seed_sectors.sql                Sophiatou
  modele_import.csv               Sophiatou
scripts/
  create-admin.js                 Rama
```

---

## Contrat de l'API

Le frontend se base sur ce tableau. Si tu changes une route ou le format d'une réponse, préviens le groupe.

| Méthode | Route | Accès | Responsable | Rôle |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | Rama | Inscription (toujours en USER), renvoie `{ token, user }` |
| POST | `/api/auth/login` | public | Rama | Connexion, renvoie `{ token, user }`. Avec `adminOnly: true` (page `/admin/login`), refuse les comptes USER |
| GET | `/api/auth/me` | connecté | Rama | Utilisateur courant |
| PATCH | `/api/auth/me` | connecté | Rama | Modifier son nom `{ name }` |
| PATCH | `/api/auth/password` | connecté | Rama | Changer son mot de passe `{ currentPassword, newPassword }` |
| GET | `/api/companies?q=&sector=&region=&city=&legal_form=&size=&status=&has_website=&has_email=&has_phone=&min_confidence=&page=&limit=` | connecté | Assane | Recherche + filtres + pagination, renvoie `{ data, total, page, limit }` |
| GET | `/api/companies/export?...mêmes filtres` | connecté | Assane | Export CSV des résultats filtrés |
| GET | `/api/companies/:id` | connecté | Abdoulaye | Fiche complète (avec dirigeants et secteur) |
| POST | `/api/companies` | ADMIN | Abdoulaye | Créer une entreprise |
| PUT | `/api/companies/:id` | ADMIN | Abdoulaye | Modifier une entreprise |
| PATCH | `/api/companies/:id/archive` | ADMIN | Abdoulaye | Archiver |
| DELETE | `/api/companies/:id` | ADMIN | Abdoulaye | Supprimer |
| GET | `/api/sectors` | connecté | Abdoulaye | Liste des secteurs et sous-secteurs |
| POST | `/api/import` | ADMIN | Sophiatou | Import CSV (champ `file`), renvoie `{ imported, duplicates, errors: [{ line, message }] }` |
| GET | `/api/stats` | connecté | Sophiatou | `{ total, topSectors, topCities, updatedLast30Days }` |
| GET | `/api/users` (`?role=ADMIN` possible) | ADMIN | Rama | Liste des comptes |
| POST | `/api/users/admins` | ADMIN | Rama | Créer un compte administrateur `{ name, email, password }` |
| DELETE | `/api/users/:id` | ADMIN | Rama | Supprimer un compte (pas soi-même, pas le dernier admin) |
| GET | `/api/lists` | connecté | Rama | Mes listes avec le nombre d'entreprises |
| POST | `/api/lists` | connecté | Rama | Créer une liste `{ name }` |
| GET | `/api/lists/:id` | connecté | Rama | Une liste et ses entreprises |
| PATCH | `/api/lists/:id` | connecté | Rama | Renommer `{ name }` |
| DELETE | `/api/lists/:id` | connecté | Rama | Supprimer une liste |
| POST | `/api/lists/:id/companies` | connecté | Rama | Ajouter une entreprise `{ companyId }` |
| DELETE | `/api/lists/:id/companies/:companyId` | connecté | Rama | Retirer une entreprise |
| GET | `/api/lists/company/:companyId` | connecté | Rama | Ids de mes listes qui contiennent cette entreprise |

Le token JWT est envoyé dans l'en-tête : `Authorization: Bearer <token>`.

Pour tester une route sans le frontend : Postman ou Thunder Client (extension VS Code). Se connecter d'abord avec `/api/auth/login` pour récupérer le token.

---

## Base de données partagée

Toute l'équipe utilise **une seule base PostgreSQL en ligne (Neon)**. Personne n'a besoin d'installer PostgreSQL.

- La connection string est envoyée par Rama **en privé**. Elle ne doit **jamais** apparaître sur GitHub.
- **Personne ne supprime ni ne modifie les tables.** Besoin d'une colonne en plus : demander à Rama, qui met à jour `schema.sql` et la base.
- Pour tester une suppression, créer une fausse entreprise et supprimer celle-là, pas les données des autres.

---

## Installation

```bash
git clone <URL_DU_DEPOT_BACKEND>
cd elikia-backend
git checkout develop
git checkout -b feat/ma-branche
npm install
cp .env.example .env      # puis coller la connection string Neon dans DATABASE_URL
npm run dev               # http://localhost:5000
```

Vérification : http://localhost:5000/api/health doit afficher `{"status":"ok"}`.

**Uniquement Rama, une seule fois :** `npm run init-db` (crée les tables et les secteurs) puis `npm run create-admin`.

### Variables d'environnement (`.env`)

| Variable | Valeur |
|---|---|
| `PORT` | `5000` |
| `DATABASE_URL` | connection string Neon (envoyée par Rama) |
| `JWT_SECRET` | une longue chaîne aléatoire |
| `JWT_EXPIRES_IN` | `1d` |
| `CLIENT_URL` | `http://localhost:5173` |

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| ADMIN | admin@elikia.sn | Admin123! |
| USER | user@elikia.sn | User123! (créé par `npm run create-user`) |

---

## Branches Git

```
main        version stable, déployée. Personne ne pousse dessus directement.
develop     branche d'intégration. Toutes les pull requests arrivent ici.
feat/...    une branche par personne, créée depuis develop.
```

Branches : `feat/socle` (Rama), `feat/repertoire` (Assane), `feat/fiche-admin` (Abdoulaye), `feat/import-dashboard` (Sophiatou). Mêmes noms dans les deux dépôts.

### Workflow quotidien

```bash
git checkout develop
git pull origin develop
git checkout feat/ma-branche
git merge develop

# travailler, puis :
git add .
git commit -m "feat(repertoire): ajout du filtre par région"
git push origin feat/ma-branche
```

Ensuite, sur GitHub : **Pull Request de `feat/ma-branche` vers `develop`** (jamais vers `main`). Une autre personne relit, puis on merge. Rama merge `develop` vers `main` quand une version est stable.

Besoin d'une nouvelle librairie npm : prévenir Rama avant (conflits sur `package.json`).

---

## Planning

| Jour | Objectif |
|---|---|
| Vendredi | Chacun développe sa fonctionnalité (backend + frontend) et pousse une première version le soir |
| Samedi | Intégration sur `develop`, import des vraies données |
| Dimanche | Corrections, déploiement, vidéo de démo, P1 si temps |
| Lundi | Démo |

Si on est en retard, on abandonne les fonctions P1 (listes/favoris, profil, journal) avant de bâcler les fonctions P0.

---

## Bugs connus / améliorations

À compléter avant la livraison.
