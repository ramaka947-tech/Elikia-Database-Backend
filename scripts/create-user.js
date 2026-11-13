// Crée (ou met à jour) un compte USER de test
// Usage : npm run create-user
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';

const name = 'Utilisateur Test';
const email = 'user@elikia.sn';
const password = 'User123!';

const hash = await bcrypt.hash(password, 10);
await pool.query(
  `insert into users (name, email, password_hash, role)
   values ($1, $2, $3, 'USER')
   on conflict (email) do update set password_hash = excluded.password_hash, role = 'USER'`,
  [name, email, hash]
);

console.log(`Utilisateur prêt : ${email} / ${password}`);
await pool.end();