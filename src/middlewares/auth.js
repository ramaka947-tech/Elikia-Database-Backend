// Middlewares d'authentification (fichier partagé, géré par Rama)
import jwt from 'jsonwebtoken';

// Vérifie que l'utilisateur est connecté. Ajoute req.user = { id, email, role }
export function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Non authentifié' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

// À utiliser après verifyToken, pour les routes réservées à l'admin
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
}
