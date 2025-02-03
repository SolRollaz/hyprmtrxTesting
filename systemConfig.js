import 'dotenv/config'; // Load environment variables from .env file
import { JsonRpcProvider } from "ethers"; // Blockchain provider for RPC interactions
import path from "path"; // Path utilities for managing file paths
import fs from "fs"; // File system module (if needed for dynamic configs)

class SystemConfig {
    constructor() {
        // Initialize blockchain networks first
        this.networks = this.initializeNetworks();

        // MongoDB configuration
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/default_db", // Placeholder URI
            dbName: process.env.MONGO_DB_NAME || "default_db", // Placeholder database name
        };

        // Debug: Log MongoDB configuration
        console.log("SystemConfig Mongo URI:", this.mongoConfig.uri);
        console.log("SystemConfig Mongo DB Name:", this.mongoConfig.dbName);

        // Validate Mongo URI
        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        // WalletConnect configuration
        this.walletConnect = {
            projectId: process.env.WALLETCONNECT_PROJECT_ID || "1b54a5d583ce208cc28c1362cdd3d437", // Placeholder WalletConnect Project ID
            chains: this.getChainsConfig(), // Dynamically get chains configuration
            metadata: {
                name: process.env.APP_NAME || "hyprmtrx", // Fallback app name
                description: process.env.APP_DESCRIPTION || "WEB3 Authentication via HyperMatrix", // Fallback description
                url: process.env.APP_URL || "https://hyprmtrx.xyz", // Fallback app URL
                icons: [process.env.APP_ICON_URL || "https://hyprmtrx.xyz/favicon.png"], // Fallback app icon
            },
            qrCodeBaseUrl: process.env.QR_CODE_BASE_URL || "https://hyprmtrx.xyz/qr-codes", // Placeholder QR code base URL
        };

        // Debug: Log supported networks
        console.log("Supported Networks:", Object.keys(this.networks));

        // Initialize blockchain providers
        this.providers = this.initializeProviders();
    }

    /**
     * Initialize blockchain networks configuration.
     * @returns {Object} - Networks configuration.
     */
    initializeNetworks() {
        return {
            ETH: {
                name: "Ethereum",
                rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID", // Placeholder RPC URL
                feeWallet: process.env.FEE_WALLET_ETH || "0x0000000000000000000000000000000000000000", // Placeholder wallet address
            },
            BNB: {
                name: "Binance Smart Chain",
                rpcUrl: process.env.RPC_URL_BNB || "https://bsc-dataseed.binance.org/", // Placeholder RPC URL
                feeWallet: process.env.FEE_WALLET_BNB || "0x0000000000000000000000000000000000000000", // Placeholder wallet address
            },
        };
    }

    /**
     * Get chains configuration for WalletConnect.
     * Dynamically reads chains from network configuration.
     * @returns {Array} - Array of chain configurations.
     */
    getChainsConfig() {
        if (!this.networks || Object.keys(this.networks).length === 0) {
            throw new Error("Networks configuration is missing or invalid.");
        }

        return Object.values(this.networks).map(({ name, rpcUrl }) => ({
            id: this.getChainIdByName(name),
            rpcUrl,
        }));
    }

    /**
     * Map network names to chain IDs.
     * @param {string} name - Network name.
     * @returns {number} - Chain ID for the network.
     */
    getChainIdByName(name) {
        const chainIdMap = {
            Ethereum: 1,
            "Binance Smart Chain": 56,
        };
        return chainIdMap[name] || 0;
    }

    /**
     * Initialize blockchain providers for each network using RPC URLs.
     * @returns {Object} - Providers keyed by network name.
     */
    initializeProviders() {
        const providers = {};
        for (const [key, config] of Object.entries(this.networks)) {
            console.log(`Initializing provider for ${key} with RPC URL: ${config.rpcUrl}`);
            try {
                providers[key] = new JsonRpcProvider(config.rpcUrl);
                console.log(`Provider for ${key} initialized successfully.`);
            } catch (error) {
                console.error(`Failed to initialize provider for ${key}:`, error.message);
            }
        }
        return providers;
    }

    /**
     * Get the WalletConnect project ID.
     * @returns {string} - WalletConnect project ID.
     */
    getWalletConnectProjectId() {
        return this.walletConnect.projectId;
    }

    /**
     * Get configuration for WalletConnect.
     * @returns {Object} - WalletConnect configuration object.
     */
    getWalletConnectConfig() {
        return this.walletConnect;
    }

    /**
     * Get the MongoDB connection URI.
     * @returns {string} - MongoDB URI.
     */
    getMongoUri() {
        return this.mongoConfig.uri;
    }

    /**
     * Get the MongoDB database name.
     * @returns {string} - MongoDB database name.
     */
    getMongoDbName() {
        return this.mongoConfig.dbName;
    }

    /**
     * Get the provider for a specific network.
     * @param {string} network - Network key (e.g., 'ETH', 'BNB').
     * @returns {JsonRpcProvider} - Provider instance for the specified network.
     */
    getProvider(network) {
        const provider = this.providers[network];
        if (!provider) {
            throw new Error(`Provider not found for network: ${network}`);
        }
        return provider;
    }

    /**
     * Get a list of all supported networks.
     * @returns {Array<string>} - List of supported network keys.
     */
    getSupportedNetworks() {
        return Object.keys(this.networks);
    }
}

export default SystemConfig;
