import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import chatRouter from './api/chat.js';
import conversationsRouter from './api/conversations.js';
import settingsRouter from './api/settings.js';
import voiceCommandRouter from './api/voice-command.js';

const app = express();

app.use(cors());
app.use(express.json());

// API key check/set
app.get('/api/api-key/status', (_req, res) => {
  res.json({ hasKey: !!process.env.ANTHROPIC_API_KEY });
});

app.post('/api/api-key', (req, res) => {
  const { key } = req.body;
  if (!key || !key.startsWith('sk-ant-')) {
    res.status(400).json({ error: 'Invalid API key format' });
    return;
  }
  process.env.ANTHROPIC_API_KEY = key;
  res.json({ ok: true });
});

app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/voice-command', voiceCommandRouter);

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
