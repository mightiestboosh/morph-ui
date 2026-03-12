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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/settings', settingsRouter);

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
