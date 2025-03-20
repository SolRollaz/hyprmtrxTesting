import User from "../models/User.js";
import WalletManager from "../services/WalletManager.js";

class AddUser {
    static async createNewUser(walletAddress, userName) {
        try {
            // ✅ Step 1: Generate blockchain wallets
            const generatedWallets = await WalletManager.generateWallets(walletAddress);

            if (!generatedWallets) {
                console.error("Failed to generate wallets for new user.");
                return null;
            }

            // ✅ Step 2: Create new user entry
            const newUser = new User({
                user_name: userName,
                auth_wallets: {
                    ETH: walletAddress,
                    DAG: generatedWallets.DAG,
                    AVAX: generatedWallets.AVAX,
                    BNB: generatedWallets.BNB
                },
                hyprmtrx_wallets: [
                    { network: "DAG", address: generatedWallets.DAG },
                    { network: "AVAX", address: generatedWallets.AVAX },
                    { network: "BNB", address: generatedWallets.BNB },
                    { network: "ETH", address: walletAddress }
                ],
                WEB3_transaction_history: [],
                HPMX_transaction_history: [],
                owned_nfts: [],
                HPMX_network_balances: [],
                account_status: "active",
                created_at: new Date()
            });

            // ✅ Step 3: Save new user to database
            await newUser.save();
            console.log(`New user created: ${userName}`);

            return newUser;
        } catch (error) {
            console.error("Error creating new user:", error.message);
            return null;
        }
    }
}

export default AddUser;
