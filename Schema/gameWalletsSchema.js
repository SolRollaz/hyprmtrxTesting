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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GameWallets', gameWalletsSchema);
