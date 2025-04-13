// File: /api/tournament/TimedClosure.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";

export default class TimedClosure {
  static async checkAndClose() {
    try {
      const now = new Date();

      const expired = await GameChallengeOpen.find({
        expires_at: { $lte: now }
      });

      if (!expired.length) {
        return { status: "idle", message: "No expired tournaments" };
      }

      const results = [];

      for (const t of expired) {
        const res = await CloseTournament.execute({
          challenge_id: t.challenge_id,
          trigger: "timed"
        });
        results.push(res);
      }

      return {
        status: "completed",
        closed: results.length,
        results
      };
    } catch (err) {
      console.error("[TimedClosure]", err.message);
      return { status: "error", message: err.message };
    }
  }
}

