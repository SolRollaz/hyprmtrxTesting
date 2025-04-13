// File: /api/tournament/ManualClosure.js

import GameChallengeOpen from "../../Schema/GameChallengeOpen.js";
import CloseTournament from "./closeTournament.js";
import HyprmtrxTrx from "../../Schema/hyprmtrxTrxSchema.js";
import GameInfo from "../../Schema/gameDataSchema.js";
import TournamentLogger from "./TournamentLogger.js";

export default class ManualClosure {
  /**
   * Manually trigger a tournament close with proper validation and logging
   * @param {Object} params
   * @param {string} params.challenge_id - Tournament ID
   * @param {string} params.username - Authenticated user
   * @param {string} params.gameKey - Provided game key
   * @returns {Promise<Object>} Closure result
   */
  static async execute({ challenge_id, username, gameKey }) {
    try {
      if (!challenge_id || (!username && !gameKey)) {
        return { status: "error", message: "Missing required fields for manual closure." };
      }

      const tournament = await GameChallengeOpen.findOne({ challenge_id });
      if (!tournament) {
        return { status: "error", message: "Tournament not found or already closed." };
      }

      const game = await GameInfo.findOne({ game_name: tournament.game_id });
      if (!game) {
        return { status: "error", message: "Associated game not found." };
      }

      const isOwner = game.registered_by === username;
      const keyValid = gameKey === game.game_key;

      if (!isOwner && !keyValid) {
        return { status: "error", message: "Unauthorized to close this tournament." };
      }

      const result = await CloseTournament.execute({
        challenge_id,
        trigger: "manual"
      });

      await HyprmtrxTrx.create({
        user: username || "system",
        type: "manual_close",
        ip: "manual",
        timestamp: new Date(),
        data: {
          challenge_id,
          game_id: tournament.game_id
        }
      });

      TournamentLogger.info(`ManualClosure: Tournament ${challenge_id} closed by ${username || "system"}.`);
      return result;
    } catch (err) {
      TournamentLogger.error(`[ManualClosure] ${err.message}`);
      return { status: "error", message: err.message };
    }
  }
}
