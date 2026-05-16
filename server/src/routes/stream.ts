import { Router } from 'express';
import { sseHub } from '../lib/sse.js';

const router = Router();

// SSE endpoint for real-time updates
router.get('/', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected' })}\n\n`);

  // Register client
  sseHub.addClient(res);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default router;
