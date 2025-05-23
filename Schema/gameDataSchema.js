// File: /schema/gameDataSchema.js
import mongoose from "mongoose";

// 🔥 Define Schema for Game Registration
const gameInfoSchema = new mongoose.Schema({
  game_name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    default: "No description provided.",
    trim: true
  },
  game_logo_path: {
    type: String,
    required: true,
    trim: true
  },
  game_banner_path: {
    type: String,
    required: true,
    trim: true
  },
  registered_by: {
    type: String,
    required: true,
    trim: true
  },
  networks: {
    type: [String],
    required: true,
    enum: ["base", "avax", "bnb", "dag"]
  },
  game_engine: {
    type: String,
    required: true,
    trim: true
  },
  game_platforms: {
    type: [String],
    required: true,
    enum: [
      "steam",
      "android",
      "apple",
      "ps5",
      "nintendo",
      "webgl",
      "pc",
      "xbox",
      "meta_quest",
      "vr",
      "linux",
      "chromeos",
      "ios_arcade"
    ]
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  rewards_pools: {
    type: [String],
    default: []
  },
  prize_pools: {
    type: [String],
    default: []
  },
  rewards_token_address: {
    type: String,
    trim: true
  },
  rewards_token_networks: {
    type: [String],
    required: true,
    enum: ["base", "avax", "bnb", "dag"]
  },
  accepted_tokens: {
    type: [String],
    default: []
  },
  auto_accept_liquid_tokens: {
    type: Boolean,
    default: false
  },
  min_liquidity_volume: {
    type: Number,
    default: 10000,
    min: 1000
  },
  native_quarters_balance: {
    type: Number,
    default: 0,
    min: 0
  },
  hyprmtrx_apis: {
    web3_starter: { type: Boolean, default: false },
    web3_max: { type: Boolean, default: false },
    GameFi: { type: Boolean, default: false },
    AI_Agent: { type: Boolean, default: false },
    max_tps: { type: Boolean, default: false },
    arbitrage: { type: Boolean, default: false },
    mims: { type: Boolean, default: false },
    multichain_asset: { type: Boolean, default: false },
    gameQuarters: { type: Boolean, default: false },
    hgtp_token: { type: Boolean, default: false }
  }
});

// ✅ Auto-update `last_updated`
gameInfoSchema.pre("save", function (next) {
  this.last_updated = Date.now();
  next();
});

const GameInfo = mongoose.model("GameInfo", gameInfoSchema);
export default GameInfo;
