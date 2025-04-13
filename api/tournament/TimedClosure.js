// File: /api/tournament/TimedClosure.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import TournamentLogger from "./TournamentLogger.js";

export default class TimedClosure {
  /**
   * Auto-close all expired tournaments
   * Should be invoked via a cron job
   * @returns {Promise<Object>} Result summary
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
        const { challenge_id, expires_at } = tournament;

        if (now < new Date(expires_at)) {
          TournamentLogger.info(`TimedClosure.skip: Tournament ${challenge_id} not expired yet.`);
          continue;
        }

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

        TournamentLogger.info(`TimedClosure.closed: Tournament ${challenge_id} successfully closed.`);
        results.push({ challenge_id, ...result });
      }

      return {
        status: "success",
        closed_count: results.length,
        details: results
      };
    } catch (err) {
      TournamentLogger.error(`[TimedClosure] ${err.message}`);
      return { status: "error", message: err.message };
    }
  }
}
