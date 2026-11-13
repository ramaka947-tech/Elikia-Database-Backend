// Point d'entrée de l'API (fichier partagé, géré par Rama)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import searchRoutes from './routes/search.routes.js';
import companiesRoutes from './routes/companies.routes.js';
import sectorsRoutes from './routes/sectors.routes.js';
import importRoutes from './routes/import.routes.js';
import statsRoutes from './routes/stats.routes.js';
import listsRoutes from './routes/lists.routes.js';
import usersRoutes from './routes/users.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import messagesRoutes from './routes/messages.routes.js';

dotenv.config();
const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean);
// exposedHeaders : permet au frontend de lire le nom des fichiers Excel exportés
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);              // Rama
app.use('/api/companies', searchRoutes);       // Assane (doit rester AVANT companiesRoutes)
app.use('/api/companies', companiesRoutes);    // Abdoulaye
app.use('/api/sectors', sectorsRoutes);        // Abdoulaye
app.use('/api/import', importRoutes);          // Sophiatou
app.use('/api/stats', statsRoutes);            // Sophiatou
app.use('/api/lists', listsRoutes);            // Rama (P1)
app.use('/api/users', usersRoutes);            // Rama
app.use('/api/settings', settingsRoutes);      // Rama (coordonnées du site)
app.use('/api/messages', messagesRoutes);      // Rama (messagerie)

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API Elikia sur http://localhost:${PORT}`));
