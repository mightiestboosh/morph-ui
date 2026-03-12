import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { ChatAgent } from '../agent/chat-agent.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { conversationId, message, model } = req.body;

  if (!conversationId || !message) {
    res.status(400).json({ error: 'conversationId and message are required' });
    return;
  }

  try {
    // Auto-create conversation if it doesn't exist
    const existing = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });

    const now = new Date().toISOString();

    if (!existing) {
      await db.insert(schema.conversations).values({
        id: conversationId,
        title: message.slice(0, 80),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(schema.conversations)
        .set({ updatedAt: now })
        .where(eq(schema.conversations.id, conversationId));
    }

    // Save user message
    await db.insert(schema.messages).values({
      id: uuid(),
      conversationId,
      role: 'user',
      content: message,
      createdAt: now,
    });

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const agent = new ChatAgent({
      conversationId,
      model: model || 'claude-sonnet-4-20250514',
      onEvent: sendEvent,
    });

    const result = await agent.run(message);

    // Save assistant message
    await db.insert(schema.messages).values({
      id: uuid(),
      conversationId,
      role: 'assistant',
      content: result.content,
      a2uiSurfaces: result.surfaces.length ? JSON.stringify(result.surfaces) : null,
      toolCalls: result.toolCalls.length ? JSON.stringify(result.toolCalls) : null,
      createdAt: new Date().toISOString(),
    });

    sendEvent('done', {});
    res.end();
  } catch (err: any) {
    console.error('Chat error:', err);
    // If headers already sent, send SSE error event
    if (res.headersSent) {
      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      sendEvent('error', { message: err.message || 'Internal server error' });
      res.end();
    } else {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
});

export default router;
