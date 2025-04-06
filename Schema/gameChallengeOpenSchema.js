import mongoose from "mongoose";

const resultEntrySchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const gameChallengeOpenSchema = new mongoose.Schema({
  game_id: { type: String, required: true, index: true },
  challenge_id: { type: String, required: true, unique: true },
  created_by: { type: String, required: true },

  title: { type: String, required: true },
  description: { type: String, default: "" },

  participants: { type: [String], default: [] },
  max_participants: { type: Number, default: 0 },
  unlimited_participants: { type: Boolean, default: false }, // ✅ Explicit flag

  status: {
    type: String,
    enum: ["open", "locked", "in_progress"],
    default: "open"
  },

  rules: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  anti_cheat: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  payout_structure: {
    type: mongoose.Schema.Types.Mixed, // ✅ Game-defined payout logic
    default: {}
  },

  reward: {
    token: { type: String, required: true },
    amount: { type: Number, required: true },
    reward_wallet: { type: String, required: true }
  },

  results: {
    type: [resultEntrySchema],
    default: []
  },

  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now }
});

const GameChallengeOpen = mongoose.model("GameChallengeOpen", gameChallengeOpenSchema);

export default GameChallengeOpen;
