import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db/index.js';

const router = Router();

// Get all settings as key-value object
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.select().from(schema.settings);
  const obj: Record<string, string> = {};
  for (const row of rows) {
    obj[row.key] = row.value;
  }
  res.json(obj);
});

// Upsert settings from request body object
router.put('/', async (req: Request, res: Response) => {
  const entries = Object.entries(req.body) as [string, string][];

  for (const [key, value] of entries) {
    await db
      .insert(schema.settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: String(value) },
      });
  }

  res.json({ ok: true });
});

export default router;
