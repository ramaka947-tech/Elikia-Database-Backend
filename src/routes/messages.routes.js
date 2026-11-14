// Responsable : Rama
// Messagerie entre les utilisateurs (clients) et l'équipe des administrateurs.
// - Un client voit et crée ses propres discussions.
// - Les administrateurs voient toutes les discussions et y répondent.
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();
router.use(verifyToken);

const MAX_LENGTH = 2000;
const isAdmin = (req) => req.user.role === 'ADMIN';

function cleanBody(text) {
  const body = String(text ?? '').trim();
  if (!body) return { error: 'Le message est vide' };
  if (body.length > MAX_LENGTH) return { error: `Le message ne doit pas dépasser ${MAX_LENGTH} caractères` };
  return { body };
}

// Discussion accessible ? (le client : seulement la sienne ; l'admin : toutes)
async function findConversation(req) {
  const { rows } = await pool.query(
    `select c.*, u.name as user_name, u.email as user_email
     from conversations c join users u on u.id = c.user_id
     where c.id = $1`,
    [req.params.id]
  );
  const conv = rows[0];
  if (!conv || (!isAdmin(req) && conv.user_id !== req.user.id)) return null;
  return conv;
}

// GET /api/messages/unread  -> { count } : nombre de messages non lus (pastille de l'icône)
router.get('/unread', async (req, res, next) => {
  try {
    const { rows } = isAdmin(req)
      ? await pool.query(
          `select count(*)::int as count from messages m join conversations c on c.id = m.conversation_id
           where m.sender_role = 'USER' and m.created_at > c.admin_read_at`
        )
      : await pool.query(
          `select count(*)::int as count from messages m join conversations c on c.id = m.conversation_id
           where c.user_id = $1 and m.sender_role = 'ADMIN' and m.created_at > c.user_read_at`,
          [req.user.id]
        );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/conversations  -> liste des discussions, la plus récente d'abord
router.get('/conversations', async (req, res, next) => {
  try {
    const admin = isAdmin(req);
    const { rows } = await pool.query(
      `select c.id, c.subject, c.created_at, c.updated_at, c.user_id,
              u.name as user_name, u.email as user_email,
              last.body as last_body, last.sender_role as last_sender_role,
              (select count(*)::int from messages m
                where m.conversation_id = c.id
                  and m.sender_role = $2
                  and m.created_at > (case when $3::boolean then c.admin_read_at else c.user_read_at end)) as unread
       from conversations c
       join users u on u.id = c.user_id
       left join lateral (
         select body, sender_role from messages where conversation_id = c.id order by created_at desc limit 1
       ) last on true
       where ($3::boolean or c.user_id = $1)
       order by c.updated_at desc`,
      [req.user.id, admin ? 'USER' : 'ADMIN', admin]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/conversations  { subject, body }  -> nouvelle discussion (clients uniquement)
router.post('/conversations', async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (isAdmin(req)) return res.status(403).json({ message: 'Les administrateurs répondent aux discussions des utilisateurs' });
    const subject = String(req.body.subject ?? '').trim();
    if (subject.length < 3) return res.status(400).json({ message: 'Le sujet doit contenir au moins 3 caractères' });
    if (!/\p{L}/u.test(subject)) return res.status(400).json({ message: 'Le sujet doit contenir au moins une lettre' });
    if (subject.length > 150) return res.status(400).json({ message: 'Le sujet ne doit pas dépasser 150 caractères' });
    const { body, error } = cleanBody(req.body.body);
    if (error) return res.status(400).json({ message: error });

    await client.query('begin');
    const { rows } = await client.query(
      'insert into conversations (user_id, subject) values ($1, $2) returning id',
      [req.user.id, subject]
    );
    await client.query(
      `insert into messages (conversation_id, sender_id, sender_role, body) values ($1, $2, 'USER', $3)`,
      [rows[0].id, req.user.id, body]
    );
    await client.query('commit');
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    await client.query('rollback').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/messages/conversations/:id  -> discussion + messages (et la marque comme lue)
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conv = await findConversation(req);
    if (!conv) return res.status(404).json({ message: 'Discussion introuvable' });

    const { rows } = await pool.query(
      `select m.id, m.body, m.sender_role, m.created_at, m.sender_id, u.name as sender_name
       from messages m left join users u on u.id = m.sender_id
       where m.conversation_id = $1 order by m.created_at asc`,
      [conv.id]
    );
    await pool.query(
      `update conversations set ${isAdmin(req) ? 'admin_read_at' : 'user_read_at'} = now() where id = $1`,
      [conv.id]
    );

    res.json({
      id: conv.id,
      subject: conv.subject,
      created_at: conv.created_at,
      user_name: conv.user_name,
      user_email: conv.user_email,
      messages: rows,
    });
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ message: 'Discussion introuvable' });
    next(err);
  }
});

// POST /api/messages/conversations/:id/messages  { body }  -> répondre dans une discussion
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conv = await findConversation(req);
    if (!conv) return res.status(404).json({ message: 'Discussion introuvable' });
    const { body, error } = cleanBody(req.body.body);
    if (error) return res.status(400).json({ message: error });

    const role = isAdmin(req) ? 'ADMIN' : 'USER';
    const { rows } = await pool.query(
      `insert into messages (conversation_id, sender_id, sender_role, body) values ($1, $2, $3, $4)
       returning id, body, sender_role, created_at, sender_id`,
      [conv.id, req.user.id, role, body]
    );
    await pool.query(
      `update conversations set updated_at = now(), ${role === 'ADMIN' ? 'admin_read_at' : 'user_read_at'} = now() where id = $1`,
      [conv.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ message: 'Discussion introuvable' });
    next(err);
  }
});

export default router;
