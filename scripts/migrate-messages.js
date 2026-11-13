// Applique la migration de la messagerie (Rama uniquement, une seule fois)
// Usage : npm run migrate-messages
import fs from 'fs';
import pool from '../src/db.js';

await pool.query(fs.readFileSync('sql/migration_messages.sql', 'utf8'));
console.log('OK : migration de la messagerie appliquée');
await pool.end();
