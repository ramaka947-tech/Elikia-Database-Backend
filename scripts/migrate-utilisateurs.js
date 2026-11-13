// Applique la migration de la page « Utilisateurs » (Rama uniquement, une seule fois)
// Usage : npm run migrate-utilisateurs
import fs from 'fs';
import pool from '../src/db.js';

await pool.query(fs.readFileSync('sql/migration_utilisateurs.sql', 'utf8'));
console.log('OK : migration des utilisateurs appliquée');
await pool.end();
