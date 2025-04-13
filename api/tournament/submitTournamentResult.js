// api/tournament/submitTournamentResult.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import Game from "../../Schema/Game.js";
import validateResult from "./utils/validateResult.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import { shouldCloseTournament } from "./checkClose.js";

const router = express.Router();

router.post("/submit-result", authMiddleware, async (req, res) => {
  try {
    const {
      gameKey,
      game_id,
      challenge_id,
      user_name,
      result,
      isFinal
    } = req.body;

    if (!gameKey || !game_id || !challenge_id || !user_name || !result) {
      return res.status(400).json({ status: "error", message: "Missing required fields." });
    }

    const game = await Game.findOne({ game_name: game_id });
    if (!game || (game.created_by !== req.user.username && game.game_key !== gameKey)) {
      return res.status(403).json({ status: "error", message: "Unauthorized: Invalid game credentials." });
    }

    const challenge = await GameChallengeOpen.findOne({ challenge_id });
    if (!challenge || challenge.game_id !== game_id) {
      return res.status(404).json({ status: "error", message: "Tournament not found." });
    }

    if (challenge.status === "locked" || challenge.status === "in_progress") {
      return res.status(400).json({ status: "error", message: "Tournament no longer accepting results." });
    }

    // Run anti-cheat validation if anti_cheat blob exists
    if (challenge.anti_cheat && Object.keys(challenge.anti_cheat).length > 0) {
      const valid = validateResult(result, challenge.anti_cheat);
      if (!valid) {
        return res.status(400).json({ status: "error", message: "Anti-cheat validation failed." });
      }
    }

    const existingEntry = challenge.results.find(entry => entry.user_name === user_name);
    if (existingEntry) {
      existingEntry.data = result;
    } else {
      challenge.results.push({ user_name, data: result });
    }

    if (!challenge.participants.includes(user_name)) {
      challenge.participants.push(user_name);
    }

    // Save updated tournament
    await challenge.save();

    // Check if the tournament should be closed
    await shouldCloseTournament(challenge_id);

    // Log the event
    await HyprmtrxTrx.create({
      user: req.user.username,
      type: "submit_tournament_result",
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      timestamp: new Date(),
      data: {
        challenge_id,
        user_name,
        isFinal: !!isFinal
      }
    });

    return res.json({ status: "success", message: "Result submitted." });
  } catch (err) {
    console.error("[POST /tournament/submit-result]", err);
    return res.status(500).json({ status: "error", message: "Internal server error." });
  }
});

export default router;
