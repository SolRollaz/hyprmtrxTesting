// File: /api/tournament/TimedClosure.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";

export default class TimedClosure {
  static async checkAndClose(limit = 50) {
    try {
      const now = new Date();

      const expiredTournaments = await GameChallengeOpen.find({
        expires_at: { $lte: now }
      }).limit(limit);

      if (!expiredTournaments.length) {
        console.log(`[TimedClosure] ✅ No tournaments to close at ${now.toISOString()}`);
        return;
      }

      console.log(`[TimedClosure] 🔎 Found ${expiredTournaments.length} tournaments to close`);

      for (const tournament of expiredTournaments) {
        try {
          const { challenge_id } = tournament;
          const result = await CloseTournament.execute({
            challenge_id,
            trigger: "timed"
          });

          console.log(`[TimedClosure] ✅ Closed ${challenge_id}: ${result.status}`);
        } catch (err) {
          console.warn(`[TimedClosure] ⚠️ Failed to close ${tournament.challenge_id}: ${err.message}`);
        }
      }

    } catch (err) {
      console.error("[TimedClosure] ❌ Global failure:", err.message);
    }
  }
}
