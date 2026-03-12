import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const router = Router();

// List all conversations
router.get('/', async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.updatedAt));
  res.json(rows);
});

// Get conversation with messages
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, id),
  });

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const msgs = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(schema.messages.createdAt);

  res.json({ ...conversation, messages: msgs });
});

// Create new conversation
router.post('/', async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const id = req.body.id || uuid();
  const title = req.body.title || 'New Chat';

  await db.insert(schema.conversations).values({
    id,
    title,
    createdAt: now,
    updatedAt: now,
  });

  res.status(201).json({ id, title, createdAt: now, updatedAt: now });
});

// Delete conversation
router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, id));
  res.status(204).end();
});

// Update conversation title
router.patch('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { title } = req.body;

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  await db
    .update(schema.conversations)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(schema.conversations.id, id));

  res.json({ ok: true });
});

export default router;
