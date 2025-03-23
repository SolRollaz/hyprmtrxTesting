import User from "../Schema/userSchema.js";
import AddUser from "../HVM/AddUser.js";
import JWTManager from "../HVM/JWTManager.js";
import AuthValidator from "../HVM/AuthValidator.js";

class MasterAuth {
    constructor(mongoClient, dbName) {
        if (!mongoClient || !dbName) {
            throw new Error("❌ MasterAuth requires both MongoClient and DB name.");
        }

        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager(mongoClient, dbName);
    }

    /**
     * Verifies the wallet signature.
     * Returns:
     * - success → token + userName
     * - awaiting_username → wallet needs username assignment
     * - failure → invalid signature or error
     */
    async verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName = null) {
        try {
            const authMessage = this.generateAuthMessage(walletAddress);
            console.log(`🔐 Validating signature for wallet: ${walletAddress}`);

            const isValid = await this.authValidator.validateWallet(
                authType,
                walletAddress,
                signedMessage,
                authMessage
            );

            if (!isValid) {
                return {
                    status: "failure",
                    message: "Wallet signature verification failed."
                };
            }

            const user = await User.findOne({ "auth_wallets.ETH": walletAddress });

            if (user) {
                const token = await this.jwtManager.generateToken(
                    user.user_name,
                    user.auth_wallets,
                    "ETH"
                );

                console.log(`✅ Authenticated: ${user.user_name}`);
                return {
                    status: "success",
                    message: "Wallet authenticated.",
                    token,
                    userName: user.user_name
                };
            }

            // ❌ New wallet - needs player name
            return {
                status: "awaiting_username",
                message: "Please enter a username to complete registration.",
                walletAddress
            };

        } catch (err) {
            console.error("❌ Signature verification error:", err.message);
            return {
                status: "failure",
                message: "Internal authentication error."
            };
        }
    }

    generateAuthMessage(walletAddress) {
        return `Sign this message to authenticate with your wallet: ${walletAddress}`;
    }
}

export default MasterAuth;
