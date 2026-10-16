import express from 'express';
import cors from 'cors';
import { env } from './lib/env';
import { optionalAuth } from './lib/auth';
import { errorHandler } from './lib/http';
import { auth } from './routes/auth';
import { campaigns } from './routes/campaigns';
import { drafts } from './routes/drafts';
import { contributions } from './routes/contributions';
import { review } from './routes/review';
import { me } from './routes/me';
import { notifications } from './routes/notifications';
import { ai } from './routes/ai';
import { uploads, UPLOAD_DIR } from './routes/uploads';
import { REACH_CONFIG, CHANNELS } from '../../../shared';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
if (env.simLatencyMs) app.use((_req, _res, next) => setTimeout(next, env.simLatencyMs));
app.use(optionalAuth);

app.get('/health', (_req, res) => res.json({ ok: true }));
/** Public estimate assumptions so the app and server always agree. */
app.get('/config', (_req, res) => res.json({ reach: REACH_CONFIG, channels: CHANNELS, aiEnabled: !!env.anthropicKey }));

app.use('/auth', auth);
app.use('/campaigns', campaigns);
app.use('/drafts', drafts);
app.use('/contributions', contributions);
app.use('/review', review);
app.use('/me', me);
app.use('/notifications', notifications);
app.use('/ai', ai);
app.use('/uploads', uploads);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

app.listen(env.port, '0.0.0.0', () => console.log(`API listening on :${env.port}`));
