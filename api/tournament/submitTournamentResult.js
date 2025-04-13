// File: /api/tournament/submitTournamentResult.js

import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import Game from "../../Schema/Game.js";

const router = express.Router();

router.post("/submit-result", authMiddleware, async (req, res) => {
  try {
    const { challenge_id, user_name, result_data, is_final, gameKey } = req.body;

    if (!challenge_id || !user_name || !result_data || !gameKey) {
      return res.status(400).json({ status: "error", message: "Missing required fields." });
    }

    const challenge = await GameChallengeOpen.findOne({ challenge_id });
    if (!challenge) {
      return res.status(404).json({ status: "error", message: "Challenge not found." });
    }

    const game = await Game.findOne({ game_name: challenge.game_id });
    if (!game) {
      return res.status(404).json({ status: "error", message: "Game not found." });
    }

    const usernameMatch = req.user?.username === game.created_by;
    const gameKeyMatch = gameKey === game.game_key;

    if (!usernameMatch || !gameKeyMatch) {
      return res.status(403).json({ status: "error", message: "Invalid ownership credentials." });
    }

    // Update or insert result
    const existing = challenge.results.find(r => r.user_name === user_name);
    if (existing) {
      existing.data = result_data;
    } else {
      challenge.results.push({ user_name, data: result_data });
    }

    // Final submission handling
    if (is_final) {
      if (!challenge.final_submissions) challenge.final_submissions = [];
      if (!challenge.final_submissions.includes(user_name)) {
        challenge.final_submissions.push(user_name);
      }

      const allFinal = challenge.participants.length > 0 &&
        challenge.final_submissions.length === challenge.participants.length;

      if (allFinal) {
        console.log(`✅ All players submitted final results for ${challenge_id}, auto-closing...`);
        // await triggerAutoClose(challenge_id);
      }
    }

    await challenge.save();

    return res.json({
      status: "success",
      message: `Result submitted${is_final ? " and marked final" : ""}.`
    });
  } catch (err) {
    console.error("[POST /tournament/submit-result]", err);
    return res.status(500).json({ status: "error", message: "Submission failed." });
  }
});

export default router;
