// File: api/sell/confirmPurchase.js

const GameData = require('../../Schema/gameDataSchema');
const TransactionLog = require('../../Schema/hyprmtrxTrxSchema');
const logger = require('winston');
const axios = require('axios');

class ConfirmPurchase {
  static async handle(req, res) {
    try {
      const {
        gameKey,
        itemType,
        priceInUSDC,
        tokenContractAddress,
        purchasedApis = [],
        notifyUrl
      } = req.body;

      if (!gameKey || itemType !== 'api' || !Array.isArray(purchasedApis)) {
        return res.status(400).json({ error: 'Missing or invalid fields' });
      }

      const game = await GameData.findOne({ gameKey });
      if (!game) return res.status(404).json({ error: 'Game not found' });

      game.hyprmtrx_apis = game.hyprmtrx_apis || {};
      purchasedApis.forEach(api => {
        game.hyprmtrx_apis[api] = true;
      });

      // Always enable quarters (included with base)
      game.hyprmtrx_quarters = true;

      await game.save();

      const logEntry = {
        userId: req.user?.userId || 'unknown',
        gameKey,
        itemType,
        tokenContractAddress,
        priceInUSDC,
        timestamp: new Date().toISOString(),
        details: {
          purchasedApis,
          quartersEnabled: true
        }
      };

      await TransactionLog.create(logEntry);

      if (notifyUrl) {
        try {
          await axios.post(notifyUrl, {
            gameKey,
            activatedApis: purchasedApis,
            quarters: true,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          logger.warn(`Webhook failed: ${err.message}`);
        }
      }

      return res.json({
        success: true,
        message: 'APIs activated successfully.',
        activatedApis: purchasedApis,
        quarters: true
      });

    } catch (err) {
      logger.error(`Confirm purchase error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to confirm purchase' });
    }
  }
}

module.exports = ConfirmPurchase;
