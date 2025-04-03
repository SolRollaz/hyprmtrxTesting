// File: /Schema/PaymentWalletsSchema.js

const mongoose = require('mongoose');

const PaymentWalletsSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  gameKey: {
    type: String,
    required: true,
    unique: true
  },
  devWallets: {
    type: Map,
    of: String, // { base: '0x...', avax: '0x...', bnb: '0x...' }
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'payment_wallets' });

module.exports = mongoose.model('PaymentWallets', PaymentWalletsSchema);
