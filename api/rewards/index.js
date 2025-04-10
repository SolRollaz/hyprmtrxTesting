// File: api/reward/index.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const GameWallet = require('../../Schema/gameWalletsSchema');
const GamePrivateKey = require('../../Schema/GamePrivateKeys');
const WalletInitializer = require('../../HVM/WalletInitializer');
const HyprmtrxTrx = require('../../Schema/hyprmtrxTrxSchema');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { ethers } = require('ethers');

function generatePrivateKey(network) {
  if (network === 'DAG') {
    return crypto.randomBytes(32).toString('hex');
  }
  const wallet = ethers.Wallet.createRandom();
  return wallet.privateKey;
}

function normalizeNetworkKey(net) {
  return net.toUpperCase();
}

router.post('/wallet', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { network, token_address, token_pair_url } = req.body;

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
        token_pair_url: token_pair_url || null,
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

router.post('/depositConfirm', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const { wallet } = req.body;

    const record = await GameWallet.findOne({ user: userId, wallet });
    if (!record) {
      return res.status(404).json({ status: 'error', message: 'Wallet not found' });
    }

    const config = require('../../systemConfig');
    const provider = config.providers[record.network];
    if (!provider) {
      return res.status(400).json({ status: 'error', message: 'Network provider not available' });
    }

    const ethBalance = await provider.getBalance(record.wallet);
    const ethInEth = parseFloat(ethers.utils.formatEther(ethBalance));

    const tokenContract = new ethers.Contract(record.token_address, [
      "function balanceOf(address owner) view returns (uint256)"
    ], provider);

    const tokenRaw = await tokenContract.balanceOf(record.wallet);
    const tokenInEth = parseFloat(ethers.utils.formatEther(tokenRaw));

    record.eth_balance = ethInEth;
    record.token_balance = tokenInEth;
    await record.save();

    await HyprmtrxTrx.create({
      user: userId,
      type: 'wallet_balance_check',
      ip: userIp,
      timestamp: new Date(),
      data: {
        wallet: record.wallet,
        network: record.network,
        eth_balance: ethInEth,
        token_balance: tokenInEth,
        token_address: record.token_address
      }
    });

    if (ethInEth === 0) {
      return res.json({ status: 'error', message: 'ETH deposit not detected yet' });
    }

    return res.json({
      status: 'success',
      eth_balance: ethInEth,
      token_balance: tokenInEth
    });
  } catch (err) {
    console.error('[POST /reward/depositConfirm]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to check wallet balances' });
  }
});

module.exports = router;
