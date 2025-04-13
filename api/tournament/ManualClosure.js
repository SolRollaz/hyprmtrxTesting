// File: /api/tournament/ManualClosure.js

import CloseTournament from "./closeTournament.js";
import Game from "../../Schema/gameDataSchema.js";

export default class ManualClosure {
  static async execute({ challenge_id, username, gameKey }) {
    try {
      if (!challenge_id || (!username && !gameKey)) {
        throw new Error("Missing challenge_id or authorization.");
      }

      // Ownership check
      const tournament = await GameChallengeOpen.findOne({ challenge_id });
      if (!tournament) throw new Error("Tournament not found");

      const game = await Game.findOne({ game_name: tournament.game_id });
      const isOwner = game?.registered_by === username;
      const isKeyMatch = game?.game_key === gameKey;

      if (!isOwner && !isKeyMatch) {
        throw new Error("Unauthorized to close tournament.");
      }

      const closeResult = await CloseTournament.execute({
        challenge_id,
        trigger: "manual"
      });

      return closeResult;
    } catch (err) {
      console.error("[ManualClosure]", err.message);
      return { status: "error", message: err.message };
    }
  }
}

