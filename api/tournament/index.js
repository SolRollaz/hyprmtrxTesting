// File: /api/challenges/index.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import GameWallets from "../../Schema/gameWalletsSchema.js";
import QRCode from "qrcode";

const router = express.Router();

// ✅ Create Tournament Challenge
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
      expires_at
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
        return res.status(400).json({ status: "error", message: "Invalid winner_logic.formula" });
      }
    }

    const exists = await GameChallengeOpen.findOne({ challenge_id });
    if (exists) {
      return res.status(409).json({ status: "error", message: "Challenge ID already exists." });
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
      expires_at: new Date(expires_at)
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
        auto_restart
      }
    });

    return res.json({ status: "success", challenge_id });
  } catch (err) {
    console.error("[POST /challenges/create]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

// ✅ Fetch Tournament Wallet Address + QR Code
router.post("/wallet", authMiddleware, async (req, res) => {
  try {
    const { game_name } = req.body;
    if (!game_name) {
      return res.status(400).json({ status: "error", message: "Missing game_name" });
    }

    const existing = await GameWallets.findOne({
      game_name,
      type: "PrizePools"
    });

    if (!existing) {
      return res.status(404).json({ status: "error", message: "Tournament wallet not found. Please initialize one first." });
    }

    return res.json({
      status: "success",
      wallet: existing.address,
      qrcode: existing.qrcode
    });
  } catch (err) {
    console.error("[POST /challenges/wallet]", err);
    return res.status(500).json({ status: "error", message: "Failed to fetch tournament wallet" });
  }
});

export default router;
