import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    user_name: { type: String, required: true, unique: true },

    auth_wallets: { 
        type: {
            DAG: { type: String, required: true },
            AVAX: { type: String, required: true },
            BNB: { type: String, required: true },
            ETH: { type: String, required: true },
        }, 
        required: true,
        default: {} 
    }, 

    hyprmtrx_wallets: { 
        type: [{
            network: { type: String, required: true },
            address: { type: String, required: true },
        }],
        required: true,
        default: [] 
    },

    tokens: {
        type: {
            session_token: { type: String, default: null },
            network_token: { type: String, default: null }
        },
        default: {}
    },

    platform_ids: {
        type: {
            Google_ID: { type: String, default: null },
            PSN_ID: { type: String, default: null },
            Steam_ID: { type: String, default: null },
            Nintendo_ID: { type: String, default: null },
            Apple_ID: { type: String, default: null },
            XBOX_ID: { type: String, default: null },
            Epic_ID: { type: String, default: null },
            BattleNet_ID: { type: String, default: null },
            Ubisoft_ID: { type: String, default: null },
            Rockstar_ID: { type: String, default: null },
            Roblox_ID: { type: String, default: null },
            Discord_ID: { type: String, default: null },
            Twitch_ID: { type: String, default: null },
            Xcom_ID: { type: String, default: null }
        },
        default: {}
    },

    login_attempts: { type: Number, default: 0 },
    last_login_ip: { type: String, default: null },
    account_status: { type: String, enum: ["active", "banned", "suspended", "pending_verification"], default: "active" },
    last_login_at: { type: Date, default: null },
    last_activity_at: { type: Date, default: null },
    account_created_from: { type: String, enum: ["web", "mobile", "API", "network"], default: "web" },
    referral_code: { type: String, default: null },

    transaction_history: { 
        type: [{
            type: { type: String, enum: ["deposit", "withdrawal", "NFT_purchase"], required: true },
            amount: { type: Number, required: true },
            currency: { type: String, required: true },
            transaction_id: { type: String, required: true, unique: true },
            timestamp: { type: Date, default: Date.now }
        }],
        default: []
    }, 

    developer_mode: { type: Boolean, default: false },

    // ✅ New Section: Owned NFTs
    owned_nfts: {
        type: [{
            contract_address: { type: String, required: true }, // Smart contract address of NFT
            token_id: { type: String, required: true }, // Unique Token ID
            network: { type: String, required: true }, // Blockchain network (ETH, BNB, AVAX, etc.)
            metadata_uri: { type: String, default: null }, // Optional metadata link (IPFS, API, etc.)
            image_url: { type: String, default: null }, // Image URL of NFT
            name: { type: String, default: null }, // NFT Name
            description: { type: String, default: null }, // NFT Description
            verified_ownership: { type: Boolean, default: false }, // Verified if user actually owns the NFT
            acquired_at: { type: Date, default: Date.now } // Date the NFT was added
        }],
        default: []
    },

    created_at: { type: Date, default: Date.now }
});

// ✅ Method to add an NFT to the user's collection
userSchema.methods.addNFT = function (nft) {
    this.owned_nfts.push({
        contract_address: nft.contract_address,
        token_id: nft.token_id,
        network: nft.network,
        metadata_uri: nft.metadata_uri || null,
        image_url: nft.image_url || null,
        name: nft.name || null,
        description: nft.description || null,
        verified_ownership: nft.verified_ownership || false,
        acquired_at: new Date()
    });

    return this.save();
};

// ✅ Create and export the model
const User = mongoose.model("User", userSchema);

export default User;
