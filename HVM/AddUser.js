import mongoose from "mongoose";
import User from "../Schema/userSchema.js"; // Include the `.js` extension for the schema
const mongoUri = process.env.MONGO_URI; // Environment variable for MongoDB URI

class AddUser {
    constructor(systemConfig) {
        this.systemConfig = systemConfig;
        if (!mongoUri) {
            throw new Error("MongoDB URI is not defined. Ensure MONGO_URI is set in the environment variables.");
        }
    }

    /**
     * This method adds a new user and creates a dynamic collection based on the username.
     * @param {string} user_name - The user name of the new user.
     * @param {Array} generatedWallets - List of wallets for the user.
     * @param {string} wallet_address - The main wallet address of the user.
     * @returns {Promise<void>}
     */
    async addNewUser(user_name, generatedWallets, wallet_address) {
        try {
            // Validate username to prevent illegal collection names
            if (!user_name || typeof user_name !== "string") {
                throw new Error("Invalid username. Username must be a non-empty string.");
            }
            const sanitizedUserName = user_name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

            // Dynamically create a collection based on the user_name
            const userCollectionName = `user_${sanitizedUserName}`;
            const userSchema = new mongoose.Schema({
                user_name: { type: String, required: true, unique: true },
                auth_wallets: {
                    DAG: { type: String, required: true },
                    AVAX: { type: String, required: true },
                    BNB: { type: String, required: true },
                    ETH: { type: String, required: true },
                },
                hyprmtrx_wallets: [
                    {
                        network: { type: String, required: true },
                        address: { type: String, required: true },
                    },
                ],
                created_at: { type: Date, default: Date.now },
            });

            // Create the model dynamically based on the collection name
            const DynamicUserModel =
                mongoose.models[userCollectionName] || // Reuse existing model if already created
                mongoose.model(userCollectionName, userSchema);

            // Extract wallet addresses for the user
            const authWallets = {
                DAG: generatedWallets.find(w => w.network === "DAG")?.address || "",
                AVAX: generatedWallets.find(w => w.network === "AVAX")?.address || "",
                BNB: generatedWallets.find(w => w.network === "BNB")?.address || "",
                ETH: generatedWallets.find(w => w.network === "ETH")?.address || "",
            };

            // Ensure all required wallets are provided
            if (Object.values(authWallets).some(wallet => !wallet)) {
                throw new Error("Missing wallet addresses for required networks (DAG, AVAX, BNB, ETH).");
            }

            // Create the new user data object
            const user = new DynamicUserModel({
                user_name,
                auth_wallets: authWallets,
                hyprmtrx_wallets: generatedWallets.map(wallet => ({
                    network: wallet.network,
                    address: wallet.address,
                })),
            });

            // Save the new user to the database in the dynamically created collection
            await user.save();
            console.log("New user added to collection:", user_name);
        } catch (error) {
            console.error("Error adding user:", {
                message: error.message,
                user_name,
                generatedWallets,
            });
            throw new Error("Failed to add user.");
        }
    }
}

export default AddUser;
