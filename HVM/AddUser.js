import User from "../Schema/userSchema.js";

class AddUser {
    /**
     * Create a new user account using only the external ETH wallet.
     * @param {string} walletAddress - ETH address user authenticated with
     * @param {string} userName - Chosen player name
     * @returns {Promise<User|null>}
     */
    static async createNewUser(walletAddress, userName) {
        try {
            const newUser = new User({
                user_name: userName,

                auth_wallets: {
                    ETH: walletAddress
                },

                // ⚠️ Do NOT assign anything to hyprmtrx_wallets at creation time
                hyprmtrx_wallets: [],

                WEB3_transaction_history: [],
                HPMX_transaction_history: [],
                owned_nfts: [],
                HPMX_network_balances: [],
                account_status: "active",
                created_at: new Date()
            });

            await newUser.save();
            console.log(`✅ New user created: ${userName}`);

            return newUser;
        } catch (error) {
            console.error("❌ Error creating new user:", error.message);
            return null;
        }
    }
}

export default AddUser;
