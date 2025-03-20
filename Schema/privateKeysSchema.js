import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config(); // Load encryption key from .env

const encryptionKey = process.env.ENCRYPTION_KEY; // Store securely in .env

if (!encryptionKey) {
    throw new Error("❌ ENCRYPTION_KEY is missing in the .env file!");
}

// 🔐 Encryption Helper Functions
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

// 🔐 PrivateKeys Schema (Using Only user_name)
const privateKeySchema = new mongoose.Schema({
    user_name: { type: String, required: true, index: true }, // ✅ Using user_name for lookup

    wallets: [{
        network: { type: String, enum: ["DAG", "AVAX", "BNB", "ETH"], required: true }, // Blockchain type
        address: { type: String, required: true, unique: true }, // Wallet Address
        encrypted_private_key: { type: String, required: true }, // 🔐 Encrypted Private Key
    }],

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// ✅ Method to Add a Wallet with Encryption
privateKeySchema.methods.addWallet = function (user_name, network, address, privateKey) {
    const encryptedKey = encrypt(privateKey);
    this.wallets.push({ network, address, encrypted_private_key: encryptedKey });
    this.user_name = user_name; // ✅ Ensure user_name is stored
    this.updated_at = new Date();
    return this.save();
};

// ✅ Method to Retrieve and Decrypt a Private Key
privateKeySchema.methods.getDecryptedKey = function (walletAddress) {
    const wallet = this.wallets.find(w => w.address === walletAddress);
    return wallet ? decrypt(wallet.encrypted_private_key) : null;
};

// ✅ Create and Export the Model
const PrivateKeys = mongoose.model("PrivateKeys", privateKeySchema);
export default PrivateKeys;
