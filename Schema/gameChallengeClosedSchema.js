import mongoose from "mongoose";

const resultEntrySchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const payoutSchema = new mongoose.Schema({
  user_name: { type: String, required: true },
  amount: { type: Number, required: true },
  token: { type: String, required: true },
  network: { type: String, required: true },
  transaction_id: { type: String, required: true }
}, { _id: false });

const gameChallengeClosedSchema = new mongoose.Schema({
  game_id: { type: String, required: true, index: true },
  challenge_id: { type: String, required: true, unique: true },

  title: { type: String, required: true },
  description: { type: String, default: "" },

  participants: { type: [String], default: [] },
  max_participants: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["closed"],
    default: "closed"
  },

  rules: { type: mongoose.Schema.Types.Mixed, default: {} },
  anti_cheat: { type: mongoose.Schema.Types.Mixed, default: {} },

  reward: {
    token: { type: String, required: true },
    amount: { type: Number, required: true },
    reward_wallet: { type: String, required: true }
  },

  results: { type: [resultEntrySchema], default: [] },
  winners: { type: [resultEntrySchema], default: [] },
  payouts: { type: [payoutSchema], default: [] },

  auto_restart: { type: Boolean, default: false },

  expires_at: { type: Date, required: true },
  closed_at: { type: Date, default: Date.now }
});

const GameChallengeClosed = mongoose.model("GameChallengeClosed", gameChallengeClosedSchema);
export default GameChallengeClosed;
