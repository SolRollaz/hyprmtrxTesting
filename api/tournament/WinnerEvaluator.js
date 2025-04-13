// File: /api/tournament/WinnerEvaluator.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import TournamentLogger from "./TournamentLogger.js";

export default class WinnerEvaluator {
  /**
   * Evaluate winners based on tournament criteria and payout structure.
   * @param {string} challenge_id
   * @returns {Promise<Object>} Result
   */
  static async execute(challenge_id) {
    try {
      if (!challenge_id) throw new Error("Missing challenge_id");

      const tournament = await GameChallengeOpen.findOne({ challenge_id });
      if (!tournament || !Array.isArray(tournament.results) || tournament.results.length === 0) {
        return { status: "skipped", message: "No results to evaluate." };
      }

      const { results, criteria, payouts } = tournament;

      if (!criteria || !criteria.field || !criteria.order) {
        return { status: "error", message: "Tournament missing evaluation criteria." };
      }

      if (!Array.isArray(payouts) || payouts.length === 0) {
        return { status: "error", message: "No payout structure defined." };
      }

      const sortField = criteria.field;
      const sortOrder = criteria.order === "asc" ? 1 : -1;

      const sorted = results.slice().sort((a, b) => {
        const aVal = a.data?.[sortField] ?? -Infinity;
        const bVal = b.data?.[sortField] ?? -Infinity;
        return sortOrder * (aVal - bVal);
      });

      const winners = [];

      for (let i = 0; i < payouts.length && i < sorted.length; i++) {
        winners.push({
          user_name: sorted[i].user_name,
          rank: i + 1,
          score: sorted[i].data?.[sortField] ?? null,
          payout: payouts[i].amount ?? 0
        });
      }

      tournament.winners = winners;
      await tournament.save();

      TournamentLogger.info(`WinnerEvaluator: Winners assigned for ${challenge_id}`);
      return { status: "success", winners };
    } catch (err) {
      TournamentLogger.error(`[WinnerEvaluator] ${err.message}`);
      return { status: "error", message: err.message };
    }
  }
}
