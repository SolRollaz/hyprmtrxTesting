// File: /api/sell/SellEndpoint.js

const { getExpectedTokenAmount } = require('../../HVM/valueChecker');
const Redis = require('ioredis');
const NodeCache = require('node-cache');
const logger = require('winston');
const systemConfig = require('../../systemConfig');
const GameData = require('../../Schema/gameDataSchema');
const axios = require('axios');

const TTL_SECONDS = 180;
const redis = new Redis(systemConfig.REDIS_URL);
const fallbackCache = new NodeCache({ stdTTL: TTL_SECONDS });

class SellEndpoint {
  static async handleValueCheck(req, res) {
    const { priceInUSDC, tokenContractAddress, network, itemId, itemType } = req.body;
    if (!priceInUSDC || !tokenContractAddress || !network || !itemId || !itemType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const expectedAmount = await getExpectedTokenAmount(priceInUSDC, tokenContractAddress, network);
      const cacheKey = `${req.user.userId}-${itemId}`;
      try {
        await redis.setex(cacheKey, TTL_SECONDS, expectedAmount.toString());
      } catch (err) {
        fallbackCache.set(cacheKey, expectedAmount);
        logger.warn(`Redis fallback used: ${err.message}`);
      }
      return res.json({ expectedAmount });
    } catch (err) {
      logger.error(`Value check error: ${err.message}`);
      return res.status(500).json({ error: 'Value check failed' });
    }
  }

  static async handleSell(req, res) {
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
      expectedAmount = fallbackCache.get(cacheKey);
      logger.warn(`Using fallback for cache get: ${err.message}`);
    }

    if (!expectedAmount) {
      return res.status(410).json({ error: 'Expected value expired. Please reinitiate purchase.' });
    }

    if (Math.abs(amountPaid - expectedAmount) > 0.000001) {
      return res.status(400).json({ error: 'Incorrect payment amount' });
    }

    return res.json({ success: true, message: 'Payment verified and item recorded.' });
  }

  static async handleConfirmPurchase(req, res) {
    const { gameKey, purchasedApis, notifyUrl } = req.body;
    if (!gameKey || !Array.isArray(purchasedApis)) {
      return res.status(400).json({ error: 'Missing gameKey or purchasedApis array' });
    }

    try {
      const game = await GameData.findOne({ gameKey });
      if (!game) return res.status(404).json({ error: 'Game not found' });

      purchasedApis.forEach(api => {
        game.hyprmtrx_apis[api] = true;
      });

      await game.save();

      if (notifyUrl) {
        try {
          await axios.post(notifyUrl, {
            gameKey,
            activatedApis: purchasedApis,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          logger.warn(`Webhook notification failed: ${err.message}`);
        }
      }

      return res.json({ success: true, message: 'APIs activated successfully.' });
    } catch (err) {
      logger.error(`Confirm purchase error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to confirm purchase' });
    }
  }
}

module.exports = SellEndpoint;
