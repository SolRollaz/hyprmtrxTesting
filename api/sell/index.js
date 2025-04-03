// File: /api/sell/index.js

const express = require('express');
const jwt = require('jsonwebtoken');
const sessionStore = require('../../sessionstore');
const systemConfig = require('../../systemConfig');
const { getExpectedTokenAmount } = require('../../HVM/valueChecker');
const Redis = require('ioredis');
const NodeCache = require('node-cache');
const winston = require('winston');

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

// Route: /value-check
// Returns expected token amount for given USDC value
app.post('/value-check', async (req, res) => {
  const { priceInUSDC, tokenContractAddress, network, itemId } = req.body;
  if (!priceInUSDC || !tokenContractAddress || !network || !itemId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const expectedAmount = await getExpectedTokenAmount(priceInUSDC, tokenContractAddress, network);
    const cacheKey = `${req.user.userId}-${itemId}`;
    try {
      await redis.setex(cacheKey, TTL_SECONDS, expectedAmount.toString());
    } catch (err) {
      logger.warn(`Redis set failed, falling back to NodeCache: ${err.message}`);
      fallbackCache.set(cacheKey, expectedAmount);
    }
    return res.json({ expectedAmount });
  } catch (err) {
    logger.error(`Value check processing error: ${err.message}`);
    return res.status(500).json({ error: 'Value check failed' });
  }
});

// Route: /sell
// Validates purchase data and logs it (stub logic only)
app.post('/sell', async (req, res) => {
  const { itemId, itemType, priceInUSDC, tokenContractAddress, network, amountPaid } = req.body;
  if (!itemId || !itemType || !priceInUSDC || !tokenContractAddress || !network || !amountPaid) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cacheKey = `${req.user.userId}-${itemId}`;
  let expectedAmount;
  try {
    const cached = await redis.get(cacheKey);
    expectedAmount = cached ? parseFloat(cached) : null;
  } catch (err) {
    logger.warn(`Redis get failed, using NodeCache: ${err.message}`);
    expectedAmount = fallbackCache.get(cacheKey);
  }

  if (!expectedAmount) {
    return res.status(410).json({ error: 'Expected value expired. Please reinitiate purchase.' });
  }

  if (Math.abs(amountPaid - expectedAmount) > 0.000001) {
    return res.status(400).json({ error: 'Incorrect payment amount' });
  }

  // TODO: Log transaction and continue verification flow

  return res.json({ success: true, message: 'Payment verified and item recorded.' });
});

// Route: /health
// Checks Redis connection and API readiness
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
