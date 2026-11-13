// Responsable : Sophiatou
import { Router } from 'express';
import pool from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

// GET /api/stats
// Réponse : { total, updatedLast30Days, bySector: [{ name, count }], byRegion: [{ name, count }] }
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const [totals, sectors, regions] = await Promise.all([
      // Total et fiches modifiées depuis 30 jours (archivées exclues)
      pool.query(
        `select count(*)::int as total,
                count(*) filter (where updated_at >= now() - interval '30 days')::int as updated
         from companies
         where not archived`
      ),
      // Top 5 secteurs : un sous-secteur est compté dans son secteur principal
      pool.query(
        `select coalesce(p.name, s.name) as name, count(*)::int as count
         from companies c
         join sectors s on s.id = c.sector_id
         left join sectors p on p.id = s.parent_id
         where not c.archived
         group by 1
         order by 2 desc, 1
         limit 5`
      ),
      // Top 5 régions (régions vides ignorées)
      pool.query(
        `select region as name, count(*)::int as count
         from companies
         where not archived and region is not null and trim(region) <> ''
         group by region
         order by 2 desc, 1
         limit 5`
      ),
    ]);

    res.json({
      total: totals.rows[0].total,
      updatedLast30Days: totals.rows[0].updated,
      bySector: sectors.rows,
      byRegion: regions.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;