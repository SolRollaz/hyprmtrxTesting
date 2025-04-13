// File: /api/tournament/depositConfirm.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameWallets from "../../Schema/gameWalletsSchema.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import { ethers } from "ethers";
import SystemConfig from "../../systemConfig.js";

const router = express.Router();
const config = new SystemConfig();
const depositRateLimit = new Map();

router.post("/depositConfirm", authMiddleware, async (req, res) => {
  try {
    const { game_name, network, token_address } = req.body;
    const userId = req.user.id;
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (!game_name || !network || !token_address) {
      return res.status(400).json({ status: "error", message: "Missing game_name, network or token_address." });
    }

    const throttleKey = `${userId}:${game_name}:${network}:${token_address}`;
    const now = Date.now();
    if (depositRateLimit.has(throttleKey) && now - depositRateLimit.get(throttleKey) < 5000) {
      return res.status(429).json({ status: "error", message: "Please wait 5 seconds before retrying." });
    }
    depositRateLimit.set(throttleKey, now);

    const record = await GameWallets.findOne({
      game_name,
      network,
      token_address,
      type: "PrizePools"
    });

    if (!record) {
      return res.status(404).json({ status: "error", message: "Tournament wallet not found." });
    }

    const provider = config.providers[network.toUpperCase()];
    if (!provider) {
      return res.status(400).json({ status: "error", message: "Network provider unavailable." });
    }

    const ethRaw = await provider.getBalance(record.wallet);
    const ethBalance = parseFloat(ethers.utils.formatEther(ethRaw));

    const tokenContract = new ethers.Contract(token_address, [
      "function balanceOf(address) view returns (uint256)"
    ], provider);

    const tokenRaw = await tokenContract.balanceOf(record.wallet);
    const tokenReal = parseFloat(ethers.utils.formatEther(tokenRaw));
    const previous = record.token_balance || 0;

    // If new token deposit detected, update HGTP
    if (tokenReal > previous) {
      const diff = tokenReal - previous;
      const hgtp = record.hgtpBalances.get(token_address) || 0;
      record.hgtpBalances.set(token_address, hgtp + diff);
    }

    record.eth_balance = ethBalance;
    record.token_balance = tokenReal;
    await record.save();

    await HyprmtrxTrx.create({
      user: req.user.username,
      type: "tournament_wallet_check",
      ip,
      timestamp: new Date(),
      data: {
        game_name,
        wallet: record.wallet,
        network,
        eth_balance: ethBalance,
        token_balance: tokenReal,
        hgtp_balance: record.hgtpBalances.get(token_address),
        token_address
      }
    });

    return res.json({
      status: ethBalance > 0 ? "success" : "error",
      message: ethBalance > 0 ? "ETH deposit confirmed" : "ETH deposit not detected yet",
      eth_balance: ethBalance,
      token_balance: record.hgtpBalances.get(token_address) || 0
    });

  } catch (err) {
    console.error("[POST /tournament/depositConfirm]", err);
    return res.status(500).json({ status: "error", message: "Failed to confirm deposit." });
  }
});

export default router;
