// Applique la migration du module « Mes listes » (Rama uniquement, une seule fois)
// Usage : npm run migrate-listes
import fs from 'fs';
import pool from '../src/db.js';

await pool.query(fs.readFileSync('sql/migration_listes.sql', 'utf8'));
console.log('OK : migration des listes appliquée');
await pool.end();
