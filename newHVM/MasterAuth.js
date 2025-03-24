import JWTManager from "../HVM/JWTManager.js";
import AuthValidator from "../HVM/AuthValidator.js";
import SessionStore from "../HVM/SessionStore.js";

class MasterAuth {
    constructor(mongoClient, dbName) {
        if (!mongoClient || !dbName) {
            throw new Error("❌ MasterAuth requires both MongoClient and DB name.");
        }

        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager(mongoClient, dbName);
    }

    async verifySignedMessage(walletAddress, signedMessage, authType, gameName) {
        try {
            const authMessage = this.generateAuthMessage(walletAddress);

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

            const token = await this.jwtManager.generateToken(
                walletAddress,
                { ETH: walletAddress },
                "ETH"
            );

            SessionStore.storeSession(walletAddress, token);

            return {
                status: "success",
                message: "Wallet authenticated.",
                token
            };

        } catch (err) {
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
