// Applique TOUTES les migrations (sql/migration_*.sql), dans l'ordre alphabétique.
// Usage : npm run migrate
// Sans danger si relancé : chaque migration vérifie si la modification existe déjà.
import fs from 'fs';
import pool from '../src/db.js';

const files = fs.readdirSync('sql').filter((f) => /^migration_.*\.sql$/.test(f)).sort();
for (const file of files) {
  await pool.query(fs.readFileSync(`sql/${file}`, 'utf8'));
  console.log(`OK : ${file}`);
}
await pool.end();
