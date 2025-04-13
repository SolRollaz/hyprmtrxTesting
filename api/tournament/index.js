// File: /api/tournament/index.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import GameWallets from "../../Schema/gameWalletsSchema.js";
import GameInfo from "../../Schema/gameDataSchema.js"; // ✅ Correct schema
import { ethers } from "ethers";
import SystemConfig from "../../systemConfig.js";

const router = express.Router();
const depositThrottle = new Map();
const systemConfig = new SystemConfig();

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      game_id,
      challenge_id,
      title,
      description,
      max_participants,
      unlimited_participants,
      rules,
      anti_cheat,
      payout_structure,
      reward,
      winner_logic,
      auto_restart,
      expires_at,
      end_when_all_submitted,
      gameKey
    } = req.body;

    if (
      !game_id || !challenge_id || !title ||
      !reward?.token || !reward?.amount || !reward?.reward_wallet || !expires_at
    ) {
      return res.status(400).json({ status: "error", message: "Missing required fields." });
    }

    if (winner_logic) {
      const validModes = ["highest", "lowest"];
      if (!validModes.includes(winner_logic.mode)) {
        return res.status(400).json({ status: "error", message: "Invalid winner_logic.mode" });
      }
      if (typeof winner_logic.metric !== "string" || !winner_logic.metric.trim()) {
        return res.status(400).json({ status: "error", message: "Invalid winner_logic.metric" });
      }
      if (winner_logic.formula && typeof winner_logic.formula !== "string") {
        return res.status(400).json({ status: "error", message: "winner_logic.formula must be a string" });
      }
    }

    const exists = await GameChallengeOpen.findOne({ challenge_id });
    if (exists) {
      return res.status(409).json({ status: "error", message: "Challenge ID already exists." });
    }

    const game = await GameInfo.findOne({ game_name: game_id });
    const isOwner = game?.registered_by === req.user.username;
    const hasKey = gameKey && gameKey === game?.game_key;

    if (!isOwner && !hasKey) {
      return res.status(403).json({ status: "error", message: "Unauthorized to create tournaments for this game." });
    }

    const newChallenge = new GameChallengeOpen({
      game_id,
      challenge_id,
      title,
      description,
      max_participants,
      unlimited_participants,
      rules,
      anti_cheat,
      payout_structure,
      reward,
      winner_logic,
      auto_restart,
      expires_at: new Date(expires_at),
      end_when_all_submitted: !!end_when_all_submitted
    });

    await newChallenge.save();

    await HyprmtrxTrx.create({
      user: req.user.username,
      type: "create_challenge",
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      timestamp: new Date(),
      data: {
        challenge_id,
        game_id,
        title,
        reward,
        max_participants,
        unlimited_participants,
        winner_logic,
        auto_restart,
        end_when_all_submitted
      }
    });

    try {
      const closeHook = await import("../tournament/closeTournament.js");
      if (typeof closeHook.default === "function") {
        closeHook.default({
          challenge_id,
          end_when_all_submitted: !!end_when_all_submitted,
          expires_at: new Date(expires_at)
        });
      }
    } catch {
      console.warn("⚠️ closeTournament.js not yet implemented or failed to load.");
    }

    return res.json({ status: "success", challenge_id });
  } catch (err) {
    console.error("[POST /tournament/create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

router.post("/depositConfirm", authMiddleware, async (req, res) => {
  try {
    const { game_name, network, token_address } = req.body;
    const throttleKey = `${game_name}:${network}`;
    const now = Date.now();

    if (depositThrottle.has(throttleKey)) {
      const lastCall = depositThrottle.get(throttleKey);
      if (now - lastCall < 5000) {
        return res.status(429).json({ status: "error", message: "Please wait 5 seconds before checking again." });
      }
    }
    depositThrottle.set(throttleKey, now);

    const record = await GameWallets.findOne({
      game_name,
      network: network.toUpperCase(),
      token_address,
      type: "PrizePools"
    });

    if (!record) {
      return res.status(404).json({ status: "error", message: "Tournament wallet not found." });
    }

    const provider = systemConfig.providers[record.network];
    if (!provider) {
      return res.status(400).json({ status: "error", message: "Provider not configured." });
    }

    const tokenContract = new ethers.Contract(token_address, [
      "function balanceOf(address owner) view returns (uint256)"
    ], provider);

    const rawBalance = await tokenContract.balanceOf(record.wallet);
    const balance = parseFloat(ethers.utils.formatEther(rawBalance));

    if (balance > record.token_balance) {
      const depositAmount = balance - record.token_balance;
      const current = record.hgtpBalances.get(token_address) || 0;
      record.hgtpBalances.set(token_address, current + depositAmount);
    }

    record.token_balance = balance;
    await record.save();

    await HyprmtrxTrx.create({
      user: req.user.username,
      type: "tournament_wallet_check",
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      timestamp: new Date(),
      data: {
        wallet: record.wallet,
        network: record.network,
        token_address,
        token_balance: balance,
        hgtp_balance: record.hgtpBalances.get(token_address)
      }
    });

    return res.json({
      status: "success",
      message: "Tournament deposit confirmed.",
      token_balance: record.hgtpBalances.get(token_address) || 0
    });
  } catch (err) {
    console.error("[POST /tournament/depositConfirm]", err);
    return res.status(500).json({ status: "error", message: "Deposit check failed." });
  }
});

export default router;
