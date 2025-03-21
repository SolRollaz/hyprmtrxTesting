import mongoose from "mongoose";

// 🔥 Token Schema
const tokenSchema = new mongoose.Schema({
    contract_address: {
        type: String,
        required: true,
        unique: true, // ✅ Ensure contract addresses are unique
        lowercase: true, // ✅ Normalize contract addresses to lowercase for consistency
        trim: true, // ✅ Remove any unnecessary spaces
        index: true // ✅ Index for faster lookups
    },
    token_name: {
        type: String,
        required: true,
        trim: true,
        set: (name) => name.replace(/\b\w/g, char => char.toUpperCase()) // ✅ Convert to Title Case (e.g., "hypr token" → "Hypr Token")
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true, // ✅ Always store symbols in uppercase (e.g., "eth" → "ETH")
        trim: true
    },
    network: {
        type: String,
        enum: ["Ethereum", "Binance", "Avalanche", "DAG", "Base"], // ✅ List all supported networks
        required: true,
    },
    decimals: {
        type: Number,
        default: 18, // ✅ Default decimals if not specified
        min: 0, // ✅ Ensure decimals are a valid number
        max: 36 // ✅ Prevent extreme decimal values
    },
    logo_url: {
        type: String,
        default: "/Token_Registry/Token_Images/token_logo_placeholder.png", // ✅ Default logo if missing
        validate: {
            validator: (v) => /^https?:\/\/[^\s]+$/.test(v), // ✅ Ensure it's a valid URL
            message: "Invalid URL format for logo_url"
        }
    },
    last_updated: {
        type: Date,
        default: Date.now
    }
});

// ✅ Auto-update `last_updated` whenever a token is modified
tokenSchema.pre("save", function (next) {
    this.last_updated = Date.now();
    next();
});

// ✅ Create Token Model
const Token = mongoose.model("Token", tokenSchema);

export default Token;
