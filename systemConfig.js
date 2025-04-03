// File: /systemConfig.js

import 'dotenv/config';
import { JsonRpcProvider } from "ethers";

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
            projectId: process.env.WALLETCONNECT_PROJECT_ID,
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
                rpcUrl: process.env.RPC_URL_ETHEREUM,
                feeWallet: process.env.FEE_WALLET_ETH,
                feeWallet2: process.env.FEE_WALLET2_ETH,
                paymentWallet: process.env.Payement_Wallet_ETH,
            },
            BNB: {
                name: "Binance Smart Chain",
                rpcUrl: process.env.RPC_URL_BNB,
                feeWallet: process.env.FEE_WALLET_BNB,
                feeWallet2: process.env.FEE_WALLET2_BNB,
                paymentWallet: process.env.Payement_Wallet_BNB,
            },
            AVAX: {
                name: "Avalanche",
                rpcUrl: process.env.RPC_URL_AVAX,
                feeWallet: process.env.FEE_WALLET_AVAX,
                feeWallet2: process.env.FEE_WALLET2_AVAX,
                paymentWallet: process.env.Payement_Wallet_AVAX,
            },
            BASE: {
                name: "Base",
                rpcUrl: process.env.RPC_URL_BASE,
                feeWallet: process.env.FEE_WALLET_BASE,
                feeWallet2: process.env.FEE_WALLET2_BASE,
                paymentWallet: process.env.Payement_Wallet_BASE,
            },
            DAG: {
                name: "Constellation DAG",
                rpcUrl: process.env.RPC_URL_DAG || "https://mainnet.constellationnetwork.io",
                feeWallet: process.env.FEE_WALLET_DAG,
                feeWallet2: process.env.FEE_WALLET2_DAG,
                paymentWallet: process.env.Payement_Wallet_DAG,
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
            "Constellation DAG": 0
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
