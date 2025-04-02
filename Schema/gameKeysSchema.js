import mongoose from "mongoose";
import bcrypt from "bcrypt";

// 🔥 Define Schema for Storing Game API Keys
const gameKeysSchema = new mongoose.Schema({
  game_name: {
    type: String,
    required: true,
    unique: true, // ✅ Ensure game names are unique
    lowercase: true, // ✅ Normalize game names to lowercase for consistency
    trim: true, // ✅ Remove unnecessary spaces
    index: true // ✅ Index for fast lookups
  },
  secret_key: {
    type: String,
    required: true, // ✅ Secret key must be manually provided
    unique: true, // ✅ Ensure each game has a unique key
    select: false // ✅ Exclude secret_key from queries by default
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
});

// ✅ Hash `secret_key` before saving (if it's new or changed)
gameKeysSchema.pre("save", async function (next) {
  if (this.isModified("secret_key")) {
    const salt = await bcrypt.genSalt(10);
    this.secret_key = await bcrypt.hash(this.secret_key, salt);
  }
  this.last_updated = Date.now();
  next();
});

// ✅ Method to Verify a Secret Key (Secure Authentication)
gameKeysSchema.methods.verifySecretKey = async function (inputKey) {
  return await bcrypt.compare(inputKey, this.secret_key);
};

// ✅ Create GameKeys Model
const GameKeys = mongoose.model("GameKeys", gameKeysSchema);

export default GameKeys;
