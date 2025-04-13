// File: /api/tournament/TimedClosure.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";

export default class TimedClosure {
  /**
   * Auto-close all expired tournaments
   * Should be invoked via a cron job
   */
  static async execute() {
    try {
      const now = new Date();
      const expired = await GameChallengeOpen.find({
        expires_at: { $lte: now },
        status: { $ne: "closed" }
      });

      const results = [];

      for (const tournament of expired) {
        const { challenge_id } = tournament;
        const result = await CloseTournament.execute({
          challenge_id,
          trigger: "auto_time"
        });

        await HyprmtrxTrx.create({
          user: "system",
          type: "auto_time_close",
          ip: "cronjob",
          timestamp: new Date(),
          data: { challenge_id }
        });

        results.push({ challenge_id, ...result });
      }

      return {
        status: "success",
        closed_count: results.length,
        details: results
      };
    } catch (err) {
      console.error("[TimedClosure] Error:", err.message);
      return { status: "error", message: err.message };
    }
  }
}
