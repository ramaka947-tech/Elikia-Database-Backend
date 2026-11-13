// Crée (ou met à jour) un compte ADMIN de test
// Usage : npm run create-admin
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';

const name = 'Admin Elikia';
const email = 'admin@elikia.sn';
const password = 'Admin123!';

const hash = await bcrypt.hash(password, 10);
await pool.query(
  `insert into users (name, email, password_hash, role)
   values ($1, $2, $3, 'ADMIN')
   on conflict (email) do update set password_hash = excluded.password_hash, role = 'ADMIN'`,
  [name, email, hash]
);

console.log(`Admin prêt : ${email} / ${password}`);
await pool.end();
