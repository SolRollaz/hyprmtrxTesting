// File: /api/tournament/AutoCloseOnSubmissions.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import TournamentLogger from "./TournamentLogger.js";

export default class AutoCloseOnSubmissions {
  static async close(tournament) {
    try {
      if (!tournament || !tournament.challenge_id) return false;
      if (!tournament.end_when_all_submitted) return false;

      const submitted = tournament.results.length;
      const expected = tournament.max_participants;

      if (!expected || submitted < expected) {
        TournamentLogger.info(`AutoClose: Waiting for submissions (${submitted}/${expected})`);
        return false;
      }

      const result = await CloseTournament.execute({
        challenge_id: tournament.challenge_id,
        trigger: "auto_submission"
      });

      await HyprmtrxTrx.create({
        user: "system",
        type: "auto_submission_close",
        ip: "inline_check",
        timestamp: new Date(),
        data: { challenge_id: tournament.challenge_id }
      });

      return result;
    } catch (err) {
      TournamentLogger.error(`[AutoCloseOnSubmissions] ${err.message}`);
      return { status: "error", message: err.message };
    }
  }
}
