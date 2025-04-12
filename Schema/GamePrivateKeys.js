import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) throw new Error("❌ ENCRYPTION_KEY is missing in the .env file!");

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (text) => {
  const [iv, encryptedText] = text.split(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), Buffer.from(iv, "hex"));
  let decrypted = decipher.update(Buffer.from(encryptedText, "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

const gamePrivateKeySchema = new mongoose.Schema({
  game_name: { type: String, required: true, index: true },

  wallets: [{
    label: { type: String, enum: ["reward_pool", "prize_pool"], required: true },
    network: { type: String, enum: ["DAG", "AVAX", "BNB", "ETH"], required: true },
    address: { type: String, required: true, unique: true },
    encrypted_private_key: { type: String, required: true }
  }],

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ✅ Check if wallet exists before adding
gamePrivateKeySchema.methods.hasWallet = function (label, network) {
  return this.wallets.some(w => w.label === label && w.network === network);
};

// ✅ Add new wallet (throws if duplicate already exists)
gamePrivateKeySchema.methods.addWallet = function (label, network, address, privateKey) {
  if (this.hasWallet(label, network)) {
    throw new Error(`Wallet already exists for ${network} [${label}]`);
  }

  const encryptedKey = encrypt(privateKey);
  this.wallets.push({ label, network, address, encrypted_private_key: encryptedKey });
  this.updated_at = new Date();
  return this.save();
};

gamePrivateKeySchema.methods.getDecryptedKey = function (walletAddress) {
  const wallet = this.wallets.find(w => w.address === walletAddress);
  return wallet ? decrypt(wallet.encrypted_private_key) : null;
};

const GamePrivateKeys = mongoose.model("GamePrivateKeys", gamePrivateKeySchema);
export default GamePrivateKeys;
