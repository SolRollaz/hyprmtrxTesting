// File: /api/tournament/tournamentWallet.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameWallets from "../../Schema/gameWalletsSchema.js";
import GamePrivateKeys from "../../Schema/GamePrivateKeys.js";
import WalletInitializer from "../../HVM/WalletInitializer.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import crypto from "crypto";

const router = express.Router();

function generatePrivateKey(network) {
  if (network === "DAG") {
    return crypto.randomBytes(32).toString("hex");
  }
  return ethers.Wallet.createRandom().privateKey;
}

router.post("/wallet", authMiddleware, async (req, res) => {
  try {
    const { game_name, network, token_address } = req.body;
    const userId = req.user.id;

    if (!game_name || !network || !token_address) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const existing = await GameWallets.findOne({
      game_name,
      network,
      token_address,
      type: "PrizePools"
    });

    if (existing) {
      return res.json({
        status: "success",
        wallet: existing.wallet,
        qrcode: existing.qrcode,
        token_balance: existing.hgtpBalances.get(token_address) || 0
      });
    }

    let privateKey;
    let existingKeys = await GamePrivateKeys.findOne({ game_name });

    if (existingKeys) {
      const match = existingKeys.wallets.find(w => w.network === network && w.label === "prize_pool");
      if (match) privateKey = existingKeys.getDecryptedKey(match.address);
    }

    if (!privateKey) {
      privateKey = generatePrivateKey(network);
      if (!existingKeys) {
        existingKeys = await GamePrivateKeys.create({ game_name, wallets: [] });
      }
      const initializer = new WalletInitializer(game_name);
      await initializer.initializeWallets([{ network, private_key: privateKey }]);
      const address = initializer.getInitializedWallets()[network].address;
      await existingKeys.addWallet("prize_pool", network, address, privateKey);
    }

    const initializer = new WalletInitializer(game_name);
    await initializer.initializeWallets([{ network, private_key }]);
    const address = initializer.getInitializedWallets()[network].address;

    const qrPath = path.join("QR_Codes", `${game_name}_Tournament_Wallet.png`);
    await QRCode.toFile(qrPath, address);

    const newWallet = await GameWallets.create({
      user: userId,
      game_name,
      network,
      type: "PrizePools",
      address,
      wallet: address,
      token_address,
      qrcode: qrPath,
      eth_balance: 0,
      token_balance: 0
    });

    await HyprmtrxTrx.create({
      user: req.user.username,
      type: "tournament_wallet_created",
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      timestamp: new Date(),
      data: {
        game_name,
        network,
        wallet: address,
        token_address
      }
    });

    return res.json({
      status: "success",
      wallet: address,
      qrcode: qrPath,
      token_balance: 0
    });

  } catch (err) {
    console.error("[POST /tournament/wallet]", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

export default router;
