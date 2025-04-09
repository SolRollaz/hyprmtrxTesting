// File: /api/sell/index.js

const express = require('express');
const jwt = require('jsonwebtoken');
const sessionStore = require('../../sessionstore');
const SellEndpoint = require('./SellEndpoint');
const QuartersEndpoint = require('./QuartersEndpoint');
const ConfirmPurchase = require('./confirmPurchase');

const app = express();
const PORT = process.env.PORT || 9055;

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await sessionStore.get(decoded.userId);
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    req.user = {
      userId: decoded.userId,
      walletAddress: session.walletAddress,
      gameNetworkId: session.gameNetworkId,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
});

app.post('/value-check', SellEndpoint.handleValueCheck);
app.post('/sell', SellEndpoint.handleSell);

app.post('/confirm-purchase', async (req, res) => {
  const { itemType } = req.body;

  if (itemType === 'quarters') {
    return await QuartersEndpoint.handleConfirmQuarters(req, res);
  }

  return await ConfirmPurchase.handle(req, res);
});

app.listen(PORT, () => {
  console.log(`Sell API running on port ${PORT}`);
});
