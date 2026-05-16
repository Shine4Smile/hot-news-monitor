import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import { startScheduler, triggerCollection, triggerVerification } from './services/scheduler.js';
import keywordsRouter from './routes/keywords.js';
import hotspotsRouter from './routes/hotspots.js';
import notificationsRouter from './routes/notifications.js';
import streamRouter from './routes/stream.js';
import statsRouter from './routes/stats.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/keywords', keywordsRouter);
app.use('/api/hotspots', hotspotsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/stream', streamRouter);
app.use('/api/stats', statsRouter);

// Manual trigger endpoints (convenience)
app.post('/api/trigger/collect', async (_req, res) => {
  try {
    const count = await triggerCollection();
    res.json({ success: true, newHotspots: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trigger/verify', async (_req, res) => {
  try {
    const count = await triggerVerification();
    res.json({ success: true, verified: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database
initDatabase();

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Hot News Monitor API running at http://localhost:${PORT}`);
  console.log('📋 API Endpoints:');
  console.log(`   GET    /api/stats          — 统计数据`);
  console.log(`   GET    /api/keywords       — 关键词列表`);
  console.log(`   POST   /api/keywords       — 添加关键词`);
  console.log(`   GET    /api/hotspots       — 热点列表`);
  console.log(`   GET    /api/notifications   — 通知列表`);
  console.log(`   GET    /api/stream         — SSE 实时推送`);
  console.log(`   POST   /api/trigger/collect — 手动采集`);
  console.log(`   POST   /api/trigger/verify  — 手动验证\n`);

  // Start background scheduler
  startScheduler();

  // Trigger initial collection immediately
  setTimeout(async () => {
    console.log('🔄 Running initial hotspot collection...');
    try {
      const count = await triggerCollection();
      console.log(`✅ Initial collection: ${count} new hotspots`);
    } catch (err) {
      console.error('Initial collection failed:', err);
    }
  }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
