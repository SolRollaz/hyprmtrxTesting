// File: /api/sell/index.js

const express = require('express');
const jwt = require('jsonwebtoken');
const sessionStore = require('../../sessionstore');
const systemConfig = require('../../systemConfig');
const Redis = require('ioredis');
const NodeCache = require('node-cache');
const winston = require('winston');
const SellEndpoint = require('./SellEndpoint');

const app = express();
const PORT = process.env.PORT || 9055;
const TTL_SECONDS = 180;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

const redis = new Redis(systemConfig.REDIS_URL, {
  maxRetriesPerRequest: 2,
  connectTimeout: 5000,
  lazyConnect: false,
  enableOfflineQueue: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry #${times}, delaying ${delay}ms`);
    return delay;
  },
});

redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));

const fallbackCache = new NodeCache({ stdTTL: TTL_SECONDS });

app.use(express.json());

// Middleware: Verify JWT and fetch session data
app.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const decoded = jwt.verify(token, systemConfig.JWT_SECRET);
    const session = await sessionStore.get(decoded.userId);
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    req.user = {
      userId: decoded.userId,
      walletAddress: session.walletAddress,
      gameNetworkId: session.gameNetworkId,
    };
    next();
  } catch (err) {
    res.status(403).json({ error: 'Unauthorized' });
  }
});

app.post('/value-check', SellEndpoint.handleValueCheck);
app.post('/sell', SellEndpoint.handleSell);

app.get('/health', async (req, res) => {
  try {
    const pong = await redis.ping();
    return res.json({ status: 'ok', redis: pong });
  } catch (err) {
    logger.error(`Health check failed: ${err.message}`);
    return res.status(503).json({ status: 'fail', redis: 'unreachable' });
  }
});

app.listen(PORT, () => {
  console.log(`Sell API listening on port ${PORT}`);
});
