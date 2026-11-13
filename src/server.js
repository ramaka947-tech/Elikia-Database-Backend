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

dotenv.config();
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);              // Rama
app.use('/api/companies', searchRoutes);       // Assane (doit rester AVANT companiesRoutes)
app.use('/api/companies', companiesRoutes);    // Abdoulaye
app.use('/api/sectors', sectorsRoutes);        // Abdoulaye
app.use('/api/import', importRoutes);          // Sophiatou
app.use('/api/stats', statsRoutes);            // Sophiatou

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API Elikia sur http://localhost:${PORT}`));
