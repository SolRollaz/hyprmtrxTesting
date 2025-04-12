// File: /api/tournament/tournamentWallet.js

import express from "express";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import crypto from "crypto";
import { ethers } from "ethers";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameWallets from "../../Schema/gameWalletsSchema.js";
import GamePrivateKeys from "../../Schema/GamePrivateKeys.js";
import WalletInitializer from "../../HVM/WalletInitializer.js";

const router = express.Router();

function generatePrivateKey(network) {
  return network === "DAG"
    ? crypto.randomBytes(32).toString("hex")
    : ethers.Wallet.createRandom().privateKey;
}

function normalizeNetworkKey(net) {
  return net.toUpperCase();
}

router.post("/generate-tournament-wallet", authMiddleware, async (req, res) => {
  try {
    const { game_name, network } = req.body;
    if (!game_name || !network) {
      return res.status(400).json({ status: "error", message: "Missing game_name or network." });
    }

    const netKey = normalizeNetworkKey(network);
    const existing = await GameWallets.findOne({ game_name, network: netKey, type: "PrizePools" });

    if (existing) {
      return res.json({
        status: "success",
        wallet: existing.wallet,
        qrcode: `/QR_Codes/${game_name}_Tournament_Wallet.png`
      });
    }

    let keyRecord = await GamePrivateKeys.findOne({ game_name });
    let privateKey;

    if (!keyRecord) {
      privateKey = generatePrivateKey(netKey);
      keyRecord = await GamePrivateKeys.create({ game_name, wallets: [] });
      await keyRecord.addWallet("prize_pool", netKey, null, privateKey); // address added later
    } else {
      const found = keyRecord.wallets.find(w => w.label === "prize_pool" && w.network === netKey);
      if (found) privateKey = keyRecord.getDecryptedKey(found.address);
      else {
        privateKey = generatePrivateKey(netKey);
        await keyRecord.addWallet("prize_pool", netKey, null, privateKey);
      }
    }

    const initializer = new WalletInitializer(game_name);
    await initializer.initializeWallets([{ network: netKey, private_key: privateKey }]);

    const walletAddress = initializer.getInitializedWallets()?.[netKey]?.address;
    if (!walletAddress) throw new Error("Wallet initialization failed.");

    const qrPath = path.resolve("QR_Codes", `${game_name}_Tournament_Wallet.png`);
    await QRCode.toFile(qrPath, walletAddress);

    await GameWallets.create({
      game_name,
      network: netKey,
      address: walletAddress,
      type: "PrizePools",
      token_address: "",
      qrcode: `/QR_Codes/${game_name}_Tournament_Wallet.png`
    });

    return res.json({
      status: "success",
      wallet: walletAddress,
      qrcode: `/QR_Codes/${game_name}_Tournament_Wallet.png`
    });
  } catch (err) {
    console.error("[POST /generate-tournament-wallet]", err);
    return res.status(500).json({ status: "error", message: "Internal error creating tournament wallet." });
  }
});

export default router;
