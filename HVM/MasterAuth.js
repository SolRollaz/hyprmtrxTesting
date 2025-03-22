// File: /HVM/MasterAuth.js

import User from "../Schema/userSchema.js"; // ✅ User schema
import AddUser from "../HVM/AddUser.js"; // ✅ User creator
import JWTManager from "../HVM/JWTManager.js"; // ✅ Token generator
import AuthValidator from "../HVM/AuthValidator.js"; // ✅ Signature verifier

class MasterAuth {
    /**
     * @param {MongoClient} mongoClient 
     * @param {string} dbName 
     */
    constructor(mongoClient, dbName) {
        if (!mongoClient || !dbName) {
            throw new Error("❌ MasterAuth requires both MongoClient and DB name.");
        }

        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager(mongoClient, dbName); // ✅ FIXED
    }

    /**
     * Verifies the wallet signature
     * - Returns token if user exists
     * - Returns `awaiting_username` if new wallet
     */
    async verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName = null) {
        try {
            const message = this.generateAuthMessage(walletAddress);
            console.log(`🔐 Verifying signed message for wallet: ${walletAddress}`);

            const isAuthenticated = await this.authValidator.validateWallet(
                authType,
                walletAddress,
                signedMessage,
                message
            );

            if (!isAuthenticated) {
                return {
                    status: "failure",
                    message: "Wallet authentication failed. Please try again."
                };
            }

            // ✅ Check if user exists
            const existingUser = await User.findOne({ "auth_wallets.ETH": walletAddress });

            if (existingUser) {
                const token = await this.jwtManager.generateToken(
                    existingUser.user_name,
                    existingUser.auth_wallets,
                    "ETH" // ✅ Replace later with actual network if needed
                );

                console.log("✅ Auth success - existing user:", existingUser.user_name);
                return {
                    status: "success",
                    message: "Wallet authenticated successfully.",
                    token,
                    userName: existingUser.user_name
                };
            }

            // ❌ No user yet → Request player name before continuing
            return {
                status: "awaiting_username",
                message: "Please choose a player name to complete registration.",
                walletAddress
            };
        } catch (error) {
            console.error("❌ Error verifying signed message:", error.message);
            return {
                status: "failure",
                message: "Internal server error during authentication."
            };
        }
    }

    /**
     * Standard message for wallet auth signing
     */
    generateAuthMessage(walletAddress) {
        return `Sign this message to authenticate with your wallet: ${walletAddress}`;
    }
}

export default MasterAuth;
