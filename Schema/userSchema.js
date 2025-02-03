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
        required: true 
    }, // Auth wallets (public keys only) for each network
    hyprmtrx_wallets: { 
        type: [{
            network: { type: String, required: true },
            address: { type: String, required: true },
        }],
        required: true 
    }, // Internal wallets without private keys (public keys only now)
    tokens: { type: [String], default: [] },  // Array of JWT tokens
    created_at: { type: Date, default: Date.now }
});

// Example of how we could populate the wallets for a new user
userSchema.methods.addWallets = function(wallets) {
    // Assume 'wallets' is the generated wallet information for a user
    this.auth_wallets.DAG = wallets.find(w => w.network === "DAG").address;
    this.auth_wallets.AVAX = wallets.find(w => w.network === "AVAX").address;
    this.auth_wallets.BNB = wallets.find(w => w.network === "BNB").address;
    this.auth_wallets.ETH = wallets.find(w => w.network === "ETH").address;

    // Add all wallets (excluding private keys) to hyprmtrx_wallets
    this.hyprmtrx_wallets = wallets.map(wallet => ({
        network: wallet.network,
        address: wallet.address,
    }));
};

const User = mongoose.model("User", userSchema);

export default User;
