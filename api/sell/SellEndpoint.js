// File: /api/sell/SellEndpoint.js (API sales only)

const { getExpectedTokenAmount } = require('../../HVM/valueChecker');
const Redis = require('ioredis');
const NodeCache = require('node-cache');
const logger = require('winston');
const systemConfig = require('../../systemConfig');
const GameData = require('../../Schema/gameDataSchema');
const TransactionLog = require('../../Schema/hyprmtrxTrxSchema');
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

    return res.json({ success: true, message: 'Payment accepted.' });
  }

  static async handleConfirmPurchase(req, res) {
    const { gameKey, purchasedApis, notifyUrl, itemType, priceInUSDC, tokenContractAddress } = req.body;
    if (!gameKey || itemType !== 'api') {
      return res.status(400).json({ error: 'Invalid or missing fields for API purchase' });
    }

    try {
      if (!Array.isArray(purchasedApis)) {
        return res.status(400).json({ error: 'Missing purchasedApis array for API activation' });
      }

      const game = await GameData.findOne({ gameKey });
      if (!game) return res.status(404).json({ error: 'Game not found' });

      purchasedApis.forEach(api => {
        game.hyprmtrx_apis[api] = true;
      });

      await game.save();

      const logDetails = {
        userId: req.user.userId,
        gameKey,
        itemType,
        tokenContractAddress,
        priceInUSDC,
        timestamp: new Date().toISOString(),
        details: { purchasedApis }
      };
      await TransactionLog.create(logDetails);

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
