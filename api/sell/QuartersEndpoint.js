// File: /api/sell/QuartersEndpoint.js

const User = require('../../Schema/userSchema');
const GameData = require('../../Schema/gameDataSchema');
const AddUser = require('../../HVM/AddUser');
const TransactionLog = require('../../Schema/hyprmtrxTrxSchema');
const GameWallets = require('../../Schema/gameWalletsSchema');
const logger = require('winston');

class QuartersEndpoint {
  static async handleConfirmQuarters(req, res) {
    const { gameKey, priceInUSDC, tokenContractAddress, challengeId } = req.body;
    if (!gameKey || !priceInUSDC || !tokenContractAddress || !challengeId) {
      return res.status(400).json({ error: 'Missing required fields for quarters purchase' });
    }

    try {
      const userId = req.user.userId;
      let user = await User.findOne({ userId });

      if (!user) {
        await AddUser({ userId, user_name: req.user.walletAddress });
        logger.info(`New user created during quarters purchase: ${userId}`);
        user = await User.findOne({ userId });
        if (!user) return res.status(500).json({ error: 'User creation failed' });
      }

      const game = await GameData.findOne({ gameKey });
      if (!game) return res.status(404).json({ error: 'Game not found' });

      const quartersTag = `${game.game_name}_quarters`;

      const hasWallet = user.hyprmtrx_wallets.find(w => w.network === 'hpmx' && w.address === quartersTag);
      if (!hasWallet) {
        user.hyprmtrx_wallets.push({ network: 'hpmx', address: quartersTag });
      }

      const isBonusToken = (
        tokenContractAddress === game.native_rewards_token ||
        tokenContractAddress === game.hpmx_token_address
      );

      let quartersToAdd = Math.ceil(priceInUSDC / 0.25);
      if (isBonusToken) {
        quartersToAdd = Math.ceil(quartersToAdd * 1.25);
      }

      const balanceEntry = user.HPMX_network_balances.find(b => b.token_contract_address === quartersTag);
      if (balanceEntry) {
        balanceEntry.balance += quartersToAdd;
      } else {
        user.HPMX_network_balances.push({ token_contract_address: quartersTag, balance: quartersToAdd });
      }

      await user.save();

      const prizePoolWallet = await GameWallets.findOne({
        gameKey,
        challengeId,
        type: 'PrizePools'
      });

      if (!prizePoolWallet) {
        logger.warn(`No prize pool wallet found for challenge ${challengeId}`);
      }

      await TransactionLog.create({
        userId,
        gameKey,
        itemType: 'quarters',
        tokenContractAddress,
        priceInUSDC,
        timestamp: new Date().toISOString(),
        details: {
          quartersToAdd,
          quartersTag,
          isBonusToken,
          challengeId,
          prizePoolWallet: prizePoolWallet?.address || null
        }
      });

      return res.json({
        success: true,
        message: `${quartersToAdd} quarters added.`,
        prizePoolWallet: prizePoolWallet?.address || null
      });
    } catch (err) {
      logger.error(`Confirm quarters error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to confirm quarters purchase' });
    }
  }
}

module.exports = QuartersEndpoint;
