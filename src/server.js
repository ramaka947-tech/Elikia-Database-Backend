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

// Sites autorisés à appeler l'API :
// - le site local et l'adresse principale (CLIENT_URL, plusieurs possibles séparées par des virgules)
// - les adresses de test Vercel de CE projet et de CETTE équipe uniquement
//   (ex : elikia-database-frontend-git-main-ramaka947-techs-projects.vercel.app)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173', // npm run preview (test de l'installation PWA)
  ...(process.env.CLIENT_URL || '').split(',').map((u) => u.trim().replace(/\/$/, '')),
].filter(Boolean);
const vercelPreview = /^https:\/\/elikia-database-frontend(-[a-z0-9-]+-ramaka947-techs-projects)?\.vercel\.app$/;
const isAllowed = (origin) => !origin || allowedOrigins.includes(origin) || vercelPreview.test(origin);
// exposedHeaders : permet au frontend de lire le nom des fichiers Excel exportés
app.use(cors({ origin: (origin, done) => done(null, isAllowed(origin)), exposedHeaders: ['Content-Disposition'] }));
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
