// Applique la migration des coordonnées du site (Rama uniquement, une seule fois)
// Usage : npm run migrate-parametres
import fs from 'fs';
import pool from '../src/db.js';

await pool.query(fs.readFileSync('sql/migration_parametres.sql', 'utf8'));
console.log('OK : migration des paramètres appliquée');
await pool.end();
