import { MongoClient } from "mongodb";
import { ethers } from "ethers"; // Required for ETH-based wallets
import dagWallet from "dag-wallet"; // DAG wallet generation
import VaultHandler from "./VaultHandler.js";
import AddUser from "./AddUser.js";
import QRCodeManager from "./QRCodeManager.js";

class WalletManager {
    constructor(systemConfig) {
        if (!systemConfig) {
            throw new Error("SystemConfig is required to initialize WalletManager.");
        }
        this.systemConfig = systemConfig;

        // Debug: Log MongoDB configuration
        console.log("SystemConfig Mongo URI:", systemConfig.getMongoUri());
        console.log("SystemConfig Mongo DB Name:", systemConfig.getMongoDbName());

        // Validate Mongo URI
        const mongoUri = systemConfig.getMongoUri();
        if (!mongoUri || !mongoUri.startsWith("mongodb")) {
            throw new Error(`Invalid or undefined Mongo URI: ${mongoUri}`);
        }

        // Initialize MongoDB client and dependencies
        this.dbClient = new MongoClient(mongoUri, { useUnifiedTopology: true });
        this.dbName = systemConfig.getMongoDbName();
        this.privateKeyCollection = "private_keys";
        this.vaultHandler = new VaultHandler();
        this.addUser = new AddUser(systemConfig);
        this.qrCodeManager = new QRCodeManager();

        // Connect to MongoDB
        this.connectToDatabase();
    }

    /**
     * Connect to MongoDB database.
     */
    async connectToDatabase() {
        try {
            await this.dbClient.connect();
            console.log("Successfully connected to MongoDB.");
        } catch (error) {
            console.error("Error connecting to MongoDB:", error.message);
            throw new Error("Failed to connect to MongoDB.");
        }
    }

    /**
     * Close the MongoDB database connection.
     */
    async close() {
        await this.dbClient.close();
        console.log("Closed MongoDB connection.");
    }

    /**
     * Store encrypted private keys for the user in MongoDB.
     * @param {string} userName - User's name.
     * @param {Array} generatedWallets - Array of wallet details.
     */
    async storePrivateKeys(userName, generatedWallets) {
        try {
            const db = this.dbClient.db(this.dbName);
            const encryptedWallets = generatedWallets.map(wallet => ({
                network: wallet.network,
                address: wallet.address,
                encryptedPrivateKey: this.vaultHandler.encrypt(wallet.private_key),
            }));

            await db.collection(this.privateKeyCollection).updateOne(
                { userName },
                { $set: { wallets: encryptedWallets } },
                { upsert: true }
            );
            console.log(`Private keys stored successfully for user: ${userName}`);
        } catch (error) {
            console.error(`Error storing private keys for user: ${userName}`, error.message);
            throw new Error("Failed to store private keys.");
        }
    }

    /**
     * Generate wallets for specified networks and store them in MongoDB.
     * @param {string} userName - User's name.
     * @param {string} walletAddress - User's primary wallet address.
     * @param {Array} networks - Array of network names (default: ["Base", "DAG", "ETH", "BNB", "AVAX"]).
     * @returns {Array} - Generated wallet details.
     */
    async generateWalletsForNetworks(userName, walletAddress, networks = ["Base", "DAG", "ETH", "BNB", "AVAX"]) {
        if (!userName || !walletAddress) {
            throw new Error("Invalid input: userName and walletAddress are required.");
        }
        if (!Array.isArray(networks) || networks.length === 0) {
            throw new Error("Invalid input: networks must be a non-empty array.");
        }

        const generatedWallets = [];
        for (const network of networks) {
            try {
                const wallet = await this._generateWalletForNetwork(network);
                if (wallet) {
                    generatedWallets.push(wallet);
                    console.log(`Generated wallet for network ${network} for user: ${userName}`);
                }
            } catch (error) {
                console.warn(`Failed to generate wallet for network ${network}:`, error.message);
            }
        }

        await this.storePrivateKeys(userName, generatedWallets);
        await this.addUser.addNewUser(userName, generatedWallets, walletAddress);
        await this.qrCodeManager.generateQRCodeForWallets(userName, generatedWallets);

        return generatedWallets;
    }

    /**
     * Generate a wallet for a specific network.
     * @param {string} network - Network name.
     * @returns {Object} - Wallet details (network, address, private_key).
     */
    async _generateWalletForNetwork(network) {
        switch (network) {
            case "Base":
            case "ETH":
            case "BNB":
            case "AVAX": {
                const wallet = ethers.Wallet.createRandom();
                return { network, address: wallet.address, private_key: wallet.privateKey };
            }
            case "DAG": {
                const wallet = dagWallet.createWallet();
                return { network, address: wallet.address, private_key: wallet.keyPair.privateKey };
            }
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }

    /**
     * Retrieve encrypted private keys from MongoDB.
     * @param {string} userName - User's name.
     * @returns {Array} - List of decrypted wallets.
     */
    async retrievePrivateKeys(userName) {
        try {
            const db = this.dbClient.db(this.dbName);
            const userData = await db.collection(this.privateKeyCollection).findOne({ userName });

            if (!userData || !userData.wallets) {
                console.warn(`No wallets found for user: ${userName}`);
                return [];
            }

            // Decrypt wallets
            return userData.wallets.map(wallet => ({
                network: wallet.network,
                address: wallet.address,
                private_key: this.vaultHandler.decrypt(wallet.encryptedPrivateKey),
            }));
        } catch (error) {
            console.error(`Error retrieving private keys for user: ${userName}`, error.message);
            throw new Error("Failed to retrieve private keys.");
        }
    }

    /**
     * Update wallet address for a specific network.
     * @param {string} userName - User's name.
     * @param {string} network - Network name.
     * @param {string} newAddress - New wallet address.
     */
    async updateWalletAddress(userName, network, newAddress) {
        try {
            const db = this.dbClient.db(this.dbName);

            // Find user and update wallet address
            const updateResult = await db.collection(this.privateKeyCollection).updateOne(
                { userName, "wallets.network": network },
                { $set: { "wallets.$.address": newAddress } }
            );

            if (updateResult.modifiedCount > 0) {
                console.log(`Wallet address updated for network ${network} for user: ${userName}`);
            } else {
                console.warn(`No update performed for user: ${userName}, network: ${network}`);
            }
        } catch (error) {
            console.error(`Error updating wallet address for user: ${userName}`, error.message);
            throw new Error("Failed to update wallet address.");
        }
    }
}

export default WalletManager;
