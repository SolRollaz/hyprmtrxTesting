// File: /Schema/gameWalletsSchema.js

const mongoose = require('mongoose');

const walletTypes = ['Rewards', 'PrizePools'];

const gameWalletsSchema = new mongoose.Schema({
  gameKey: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: walletTypes,
    required: true
  },
  network: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  token_pair_url: {
    type: String,
    required: false,
    default: null
  },
  challengeId: {
    type: String,
    required: function () {
      return this.type === 'PrizePools';
    }
  },
  hgtpBalances: {
    type: Map,
    of: Number,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * To track token deposit updates into hgtpBalances map:
 * GameWallets.updateOne(
 *   { address, network },
 *   { $inc: { [`hgtpBalances.${tokenAddress}`]: tokenAmount } }
 * )
 *
 * On /reward/depositConfirm:
 *   Only increase HGTP balance if new deposit > old recorded
 *   Always return HGTP balance (not raw token balance)
 */

module.exports = mongoose.model('GameWallets', gameWalletsSchema);
