// File: api/reward/index.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const GameWallet = require('../../Schema/gameWalletsSchema');
const GamePrivateKey = require('../../Schema/GamePrivateKeys');
const WalletInitializer = require('../../HVM/WalletInitializer');
const QRCode = require('qrcode');
const crypto = require('crypto');

function generatePrivateKey(network) {
  if (network === 'DAG') {
    return crypto.randomBytes(32).toString('hex');
  }
  const wallet = require('ethers').Wallet.createRandom();
  return wallet.privateKey;
}

function normalizeNetworkKey(net) {
  return net.toUpperCase();
}

router.post('/wallet', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network, token_address } = req.body;

    if (!network || !token_address) {
      return res.status(400).json({ status: 'error', message: 'Missing network or token address' });
    }

    const netKey = normalizeNetworkKey(network);
    const existing = await GameWallet.findOne({ user: userId, network: netKey, token_address });

    let walletRecord = existing;

    if (!walletRecord) {
      const existingKey = await GamePrivateKey.findOne({ user: userId, network: netKey });
      let privateKey = existingKey?.private_key;

      if (!privateKey) {
        privateKey = generatePrivateKey(netKey);
        await GamePrivateKey.create({ user: userId, network: netKey, private_key: privateKey });
      }

      const initializer = new WalletInitializer(userId);
      await initializer.initializeWallets([{ network: netKey, private_key: privateKey }]);

      const walletAddress = initializer.getInitializedWallets()?.[netKey]?.address;
      const qr = await QRCode.toDataURL(walletAddress);

      walletRecord = await GameWallet.create({
        user: userId,
        network: netKey,
        token_address,
        wallet: walletAddress,
        qrcode: qr,
        eth_balance: 0,
        token_balance: 0
      });
    }

    return res.json({
      status: 'success',
      wallet: walletRecord.wallet,
      qrcode: walletRecord.qrcode,
      eth_balance: walletRecord.eth_balance,
      token_balance: walletRecord.token_balance
    });
  } catch (err) {
    console.error('[POST /reward/wallet]', err);
    return res.status(500).json({ status: 'error', message: 'Internal error initializing wallet' });
  }
});

module.exports = router;

