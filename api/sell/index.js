// File: /api/sell/index.js

const express = require('express');
const jwt = require('jsonwebtoken');
const sessionStore = require('../../sessionstore');
const systemConfig = require('../../systemConfig');
const { getExpectedTokenAmount } = require('./valueChecker');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 9055;
const TTL_SECONDS = 180;
const expectedValueCache = new NodeCache({ stdTTL: TTL_SECONDS });

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
    expectedValueCache.set(cacheKey, expectedAmount);
    return res.json({ expectedAmount });
  } catch (err) {
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
  const expectedAmount = expectedValueCache.get(cacheKey);

  if (!expectedAmount) {
    return res.status(410).json({ error: 'Expected value expired. Please reinitiate purchase.' });
  }

  if (Math.abs(amountPaid - expectedAmount) > 0.000001) {
    return res.status(400).json({ error: 'Incorrect payment amount' });
  }

  // TODO: Log transaction and continue verification flow

  return res.json({ success: true, message: 'Payment verified and item recorded.' });
});

app.listen(PORT, () => {
  console.log(`Sell API listening on port ${PORT}`);
});
