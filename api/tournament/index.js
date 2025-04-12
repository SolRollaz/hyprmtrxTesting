// File: /api/tournament/index.js

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const authMiddleware = require("../../middleware/authMiddleware");
const GameChallengeOpen = require("../../Schema/GameChallengeOpen");

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      game_name,
      title,
      description,
      reward,
      expires_at,
      rules = {},
      anti_cheat = {},
      payout_structure = {},
      max_participants = 0,
      unlimited_participants = false,
      auto_restart = false
    } = req.body;

    if (
      !game_name ||
      !title ||
      !reward?.token ||
      !reward?.amount ||
      !reward?.reward_wallet ||
      !expires_at
    ) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields"
      });
    }

    const challenge_id = uuidv4();

    const newChallenge = new GameChallengeOpen({
      game_id: game_name,
      challenge_id,
      title,
      description,
      participants: [],
      max_participants,
      unlimited_participants,
      status: "open",
      rules,
      anti_cheat,
      payout_structure,
      reward,
      auto_restart,
      results: [],
      expires_at
    });

    await newChallenge.save();

    return res.json({
      status: "success",
      challenge_id
    });
  } catch (err) {
    console.error("[POST /tournament/create]", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to create tournament"
    });
  }
});

module.exports = router;
