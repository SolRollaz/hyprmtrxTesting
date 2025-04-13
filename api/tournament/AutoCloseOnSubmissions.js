// File: /api/tournament/AutoCloseOnSubmissions.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";

export default class AutoCloseOnSubmissions {
  static async check(challenge_id) {
    try {
      if (!challenge_id) throw new Error("Missing challenge_id");

      const tournament = await GameChallengeOpen.findOne({ challenge_id });
      if (!tournament) return { status: "error", message: "Tournament not found" };

      if (!tournament.end_when_all_submitted) {
        return { status: "skipped", reason: "Not configured for auto close on submissions." };
      }

      const { max_participants, results } = tournament;

      if (!max_participants || results.length < max_participants) {
        return { status: "waiting", submitted: results.length, required: max_participants };
      }

      const closeResult = await CloseTournament.execute({
        challenge_id,
        trigger: "auto_submission"
      });

      return closeResult;
    } catch (err) {
      console.error("[AutoCloseOnSubmissions]", err.message);
      return { status: "error", message: err.message };
    }
  }
}

