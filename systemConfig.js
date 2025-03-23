// File: /systemConfig.js

import 'dotenv/config';
import { JsonRpcProvider } from "ethers";
import path from "path";
import fs from "fs";

class SystemConfig {
    constructor() {
        this.networks = this.initializeNetworks();

        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/default_db",
            dbName: process.env.MONGO_DB_NAME || "default_db",
        };

        console.log("SystemConfig Mongo URI:", this.mongoConfig.uri);
        console.log("SystemConfig Mongo DB Name:", this.mongoConfig.dbName);

        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        this.walletConnect = {
            projectId: process.env.WALLETCONNECT_PROJECT_ID || "1b54a5d583ce208cc28c1362cdd3d437",
            chains: this.getChainsConfig(),
            metadata: {
                name: process.env.APP_NAME || "hyprmtrx",
                description: process.env.APP_DESCRIPTION || "WEB3 Authentication via HyperMatrix",
                url: process.env.APP_URL || "https://hyprmtrx.xyz",
                icons: [process.env.APP_ICON_URL || "https://hyprmtrx.xyz/favicon.png"],
            },
            qrCodeBaseUrl: process.env.QR_CODE_BASE_URL || "https://hyprmtrx.xyz/qr-codes",
            relayUrl: "wss://relay.walletconnect.org"
        };

        console.log("Supported Networks:", Object.keys(this.networks));

        this.providers = this.initializeProviders();
    }

    initializeNetworks() {
        return {
            ETH: {
                name: "Ethereum",
                rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID",
                feeWallet: process.env.FEE_WALLET_ETH || "0x0000000000000000000000000000000000000000",
            },
            BNB: {
                name: "Binance Smart Chain",
                rpcUrl: process.env.RPC_URL_BNB || "https://bsc-dataseed.binance.org/",
                feeWallet: process.env.FEE_WALLET_BNB || "0x0000000000000000000000000000000000000000",
            },
            AVAX: {
                name: "Avalanche",
                rpcUrl: process.env.RPC_URL_AVAX || "https://api.avax.network/ext/bc/C/rpc",
                feeWallet: process.env.FEE_WALLET_AVAX || "0x0000000000000000000000000000000000000000",
            },
            BASE: {
                name: "Base",
                rpcUrl: process.env.RPC_URL_BASE || "https://mainnet.base.org",
                feeWallet: process.env.FEE_WALLET_BASE || "0x0000000000000000000000000000000000000000",
            },
        };
    }

    getChainsConfig() {
        if (!this.networks || Object.keys(this.networks).length === 0) {
            throw new Error("Networks configuration is missing or invalid.");
        }

        return Object.values(this.networks).map(({ name, rpcUrl }) => ({
            id: this.getChainIdByName(name),
            rpcUrl,
        }));
    }

    getChainIdByName(name) {
        const chainIdMap = {
            Ethereum: 1,
            "Binance Smart Chain": 56,
            Avalanche: 43114,
            Base: 8453,
        };
        return chainIdMap[name] || 0;
    }

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

    getWalletConnectProjectId() {
        return this.walletConnect.projectId;
    }

    getWalletConnectConfig() {
        return this.walletConnect;
    }

    getMongoUri() {
        return this.mongoConfig.uri;
    }

    getMongoDbName() {
        return this.mongoConfig.dbName;
    }

    getProvider(network) {
        const provider = this.providers[network];
        if (!provider) {
            throw new Error(`Provider not found for network: ${network}`);
        }
        return provider;
    }

    getSupportedNetworks() {
        return Object.keys(this.networks);
    }
}

export default SystemConfig;
