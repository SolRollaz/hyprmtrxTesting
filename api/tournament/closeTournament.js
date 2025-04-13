// File: /api/tournament/closeTournament.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import GameChallengeClosed from "../../Schema/GameChallengeClosed.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import WinnerEvaluator from "./WinnerEvaluator.js";
import PayoutAllocator from "./PayoutAllocator.js";
import ArchiveTournament from "./ArchiveTournament.js";

export default class CloseTournament {
  static async execute({ challenge_id, trigger = "manual" }) {
    try {
      if (!challenge_id) throw new Error("Missing challenge_id");

      const tournament = await GameChallengeOpen.findOne({ challenge_id });
      if (!tournament) throw new Error("Tournament not found or already closed");

      const {
        game_id, title, description, reward,
        rules, anti_cheat, participants, winner_logic,
        payout_structure, results, max_participants, expires_at
      } = tournament;

      // Determine closure type
      if (trigger === "auto_submission") {
        if (!max_participants || results.length < max_participants) {
          throw new Error("Not all participants submitted results");
        }
      }

      // 1. Evaluate winners
      const winners = WinnerEvaluator.evaluate({ results, winner_logic });

      // 2. Allocate payouts
      const payouts = PayoutAllocator.allocate({ winners, reward, payout_structure });

      // 3. Archive into Closed collection
      const closedDoc = await ArchiveTournament.save({
        game_id,
        challenge_id,
        title,
        description,
        reward,
        rules,
        anti_cheat,
        results,
        winners,
        payouts,
        participants,
        max_participants,
        winner_logic,
        expires_at
      });

      // 4. Delete Open tournament
      await GameChallengeOpen.deleteOne({ challenge_id });

      // 5. Log in transaction log
      await HyprmtrxTrx.create({
        user: "system",
        type: "tournament_closed",
        ip: "system",
        timestamp: new Date(),
        data: {
          challenge_id,
          reason: trigger,
          winners,
          payouts
        }
      });

      return { status: "success", challenge_id };
    } catch (err) {
      console.error("[CloseTournament]", err.message);
      return { status: "error", message: err.message };
    }
  }
}
