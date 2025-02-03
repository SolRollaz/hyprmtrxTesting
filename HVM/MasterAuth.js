import AuthValidator from "./AuthValidator.js";
import JWTManager from "./JWTManager.js";
import SystemConfig from "../systemConfig.js";

class MasterAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, database name, and SystemConfig are required to initialize MasterAuth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;

        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager(this.client, this.dbName);
    }

    /**
     * Generate an authentication message for the user to sign.
     * @param {string} walletAddress - The wallet address.
     * @returns {string} - The message to be signed.
     */
    generateAuthMessage(walletAddress) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${timestamp}`;
    }

    /**
     * Verify the signed message from the user's wallet.
     * @param {string} walletAddress - The wallet address.
     * @param {string} signedMessage - The signed message from the wallet.
     * @param {string} authType - The authentication type.
     * @param {string} gameName - The game name.
     * @param {string} userName - The user's name.
     * @returns {object} - The verification result.
     */
    async verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName) {
        try {
            const message = this.generateAuthMessage(walletAddress);
            console.log(`Verifying signed message for wallet: ${walletAddress}`);

            const isAuthenticated = await this.authValidator.validateWallet(authType, walletAddress, signedMessage, message);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            const token = await this.jwtManager.generateToken(userName, walletAddress, gameName);
            console.log("Wallet successfully authenticated and token generated:", token);

            return {
                status: "success",
                message: "Wallet successfully authenticated.",
                token,
            };
        } catch (error) {
            console.error("Error verifying signed message:", error.message);
            return { status: "failure", message: "Internal server error during authentication." };
        }
    }
}

export default MasterAuth;
