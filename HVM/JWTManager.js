import jwt from "jsonwebtoken";
import SystemConfig from "../systemConfig.js"; // Ensure the correct path with `.js` extension for ES modules

class JWTManager {
    constructor(mongoClient, dbName) {
        if (!mongoClient) {
            throw new Error("MongoClient instance is required to initialize JWTManager.");
        }
        if (!dbName) {
            throw new Error("Database name is required to initialize JWTManager.");
        }

        // Initialize properties
        this.mongoClient = mongoClient;
        this.dbName = dbName;
        this.jwtSecret = process.env.JWT_SECRET || "DEFAULT_SECRET"; // Default JWT secret for fallback
        this.systemConfig = new SystemConfig(); // SystemConfig to fetch network data
        this.usersCollection = this.mongoClient.db(this.dbName).collection("users"); // Access the users collection

        console.log("JWTManager initialized with DB Name:", this.dbName);
    }

    /**
     * Generate a JWT token for a user.
     * @param {string} user_name - The username.
     * @param {object} authWallets - User's authenticated wallets.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB') for the token.
     * @returns {string} - The JWT token.
     */
    async generateToken(user_name, authWallets, network) {
        try {
            // Validate network using SystemConfig
            const networkConfig = this.systemConfig.getNetworkConfig(network);

            // Prepare token payload
            const payload = {
                user_name,
                authWallets,
                networkConfig, // Adds network-specific configuration to the payload
            };

            // Sign the token
            const token = jwt.sign(payload, this.jwtSecret, { expiresIn: "1h" });

            // Optionally store the token in MongoDB
            await this.storeToken(user_name, token);

            console.log(`Token generated for user: ${user_name}, Network: ${network}`);
            return token;
        } catch (error) {
            console.error("Error generating token:", { user_name, network, error: error.message });
            throw new Error("Failed to generate token.");
        }
    }

    /**
     * Store the generated token in the MongoDB users collection.
     * @param {string} user_name - The username.
     * @param {string} token - The JWT token.
     */
    async storeToken(user_name, token) {
        try {
            const result = await this.usersCollection.updateOne(
                { user_name },
                { $push: { tokens: token } }, // Add the token to the user's token array
                { upsert: true } // Create a new document if the user does not exist
            );

            if (result.modifiedCount > 0) {
                console.log(`Token stored successfully for user: ${user_name}`);
            } else if (result.upsertedCount > 0) {
                console.log(`New user document created for: ${user_name}`);
            } else {
                console.warn(`No changes made to user document for: ${user_name}`);
            }
        } catch (error) {
            console.error("Error storing token in MongoDB:", { user_name, error: error.message });
            throw new Error("Failed to store token in database.");
        }
    }

    /**
     * Validate the JWT token.
     * @param {string} token - The JWT token to validate.
     * @returns {object} - Decoded payload if valid.
     */
    async validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            console.log("Token validated successfully:", decoded);
            return decoded;
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                console.warn("Token expired:", error.message);
                throw new Error("Token has expired.");
            }
            console.error("Invalid token:", error.message);
            throw new Error("Invalid token.");
        }
    }

    /**
     * Revoke a token by removing it from the user's stored tokens.
     * @param {string} user_name - The username.
     * @param {string} token - The JWT token to revoke.
     */
    async revokeToken(user_name, token) {
        try {
            const result = await this.usersCollection.updateOne(
                { user_name },
                { $pull: { tokens: token } } // Remove the token from the user's token array
            );

            if (result.modifiedCount > 0) {
                console.log(`Token revoked successfully for user: ${user_name}`);
            } else {
                console.warn(`Token not found or already revoked for user: ${user_name}`);
            }
        } catch (error) {
            console.error("Error revoking token:", { user_name, error: error.message });
            throw new Error("Failed to revoke token.");
        }
    }
}

export default JWTManager;
