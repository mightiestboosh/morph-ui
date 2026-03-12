import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { ChatAgent } from '../agent/chat-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const titleClient = new Anthropic();

async function generateTitle(conversationId: string): Promise<string | null> {
  try {
    const msgs = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, conversationId),
      orderBy: [asc(schema.messages.createdAt)],
    });

    if (msgs.length === 0) return null;

    // Build a summary of the conversation for titling
    const summary = msgs
      .slice(0, 20)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    console.log(`Generating title for conversation ${conversationId} (${msgs.length} messages)...`);

    const response = await titleClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system: 'Generate a short, descriptive title (3-6 words) for this conversation. Respond with ONLY the title text, no quotes, no punctuation at the end.',
      messages: [{ role: 'user', content: summary }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      const title = textBlock.text.trim().slice(0, 100);
      console.log(`Auto-titled conversation ${conversationId}: "${title}"`);
      await db
        .update(schema.conversations)
        .set({ title, updatedAt: new Date().toISOString() })
        .where(eq(schema.conversations.id, conversationId));
      return title;
    }
  } catch (err: any) {
    console.error('Auto-title generation failed:', err?.message || err);
  }
  return null;
}

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
      model: model || 'claude-sonnet-4-6',
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

    // Auto-title: on first user message and every 5th user message
    const msgCount = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, conversationId),
    });
    const userMsgCount = msgCount.filter((m) => m.role === 'user').length;
    if (userMsgCount === 1 || userMsgCount % 5 === 0) {
      try {
        const newTitle = await generateTitle(conversationId);
        if (newTitle) {
          sendEvent('title_update', { conversationId, title: newTitle });
        } else if (userMsgCount === 1) {
          // Fallback: use truncated first message as title
          const fallback = message.replace(/[{}"]/g, '').slice(0, 50).trim();
          if (fallback && fallback !== 'New Chat') {
            await db.update(schema.conversations).set({ title: fallback }).where(eq(schema.conversations.id, conversationId));
            sendEvent('title_update', { conversationId, title: fallback });
          }
        }
      } catch (err) {
        console.error('Title generation error:', err);
        // Fallback on error too
        if (userMsgCount === 1) {
          const fallback = message.replace(/[{}"]/g, '').slice(0, 50).trim();
          if (fallback) {
            try {
              await db.update(schema.conversations).set({ title: fallback }).where(eq(schema.conversations.id, conversationId));
              sendEvent('title_update', { conversationId, title: fallback });
            } catch { /* ignore */ }
          }
        }
      }
    }

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
